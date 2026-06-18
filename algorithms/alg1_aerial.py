# algorithms/alg1_aerial.py
import os
import json
import cv2
import torch
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.features import geometry_mask
from datetime import datetime

# Папка для сохранения результатов
OUTPUT_DIR = "static/results/aerial"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# =========================
# 1. АРХИТЕКТУРА UNet (ИСПРАВЛЕНА ПОД ВЕСА forest_unet.pth)
# =========================
class DoubleConv(torch.nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.net = torch.nn.Sequential(
            torch.nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1),
            torch.nn.BatchNorm2d(out_ch),
            torch.nn.ReLU(inplace=True),
            torch.nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1),
            torch.nn.BatchNorm2d(out_ch),
            torch.nn.ReLU(inplace=True)
        )

    def forward(self, x): return self.net(x)


class UNet(torch.nn.Module):
    def __init__(self, n_classes=3, in_channels=3):
        super().__init__()
        self.d1 = DoubleConv(in_channels, 64)
        self.d2 = DoubleConv(64, 128)
        self.d3 = DoubleConv(128, 256)
        self.pool = torch.nn.MaxPool2d(2)

        # Upsample (без весов, как в оригинальном ноутбуке)
        self.up = torch.nn.Upsample(scale_factor=2, mode='bilinear', align_corners=True)

        self.u1 = DoubleConv(256 + 128, 128)
        self.u2 = DoubleConv(128 + 64, 64)
        self.outc = torch.nn.Conv2d(64, n_classes, kernel_size=1)

    def forward(self, x):
        c1 = self.d1(x)
        c2 = self.d2(self.pool(c1))
        c3 = self.d3(self.pool(c2))
        x = self.up(c3)
        x = self.u1(torch.cat([x, c2], dim=1))
        x = self.up(x)
        x = self.u2(torch.cat([x, c1], dim=1))
        return self.outc(x)


# =========================
# 2. ФУНКЦИИ ТАЙЛИНГА (ДЛЯ БОЛЬШИХ ИЗОБРАЖЕНИЙ)
# =========================
def process_with_tiling(image_tensor, model, device, tile_size=512, stride=256):
    C, H, W = image_tensor.shape
    new_h = ((H + 255) // 256) * 256
    new_w = ((W + 255) // 256) * 256
    if new_h < tile_size: new_h = tile_size
    if new_w < tile_size: new_w = tile_size

    padded_tensor = torch.zeros(C, new_h, new_w, device=device)
    padded_tensor[:, :H, :W] = image_tensor
    output_mask = torch.zeros(new_h, new_w, dtype=torch.uint8, device=device)

    for y in range(0, new_h - tile_size + 1, stride):
        for x in range(0, new_w - tile_size + 1, stride):
            tile = padded_tensor[:, y:y + tile_size, x:x + tile_size].unsqueeze(0)
            with torch.no_grad():
                pred = model(tile)
                pred_class = torch.argmax(pred, dim=1).squeeze(0)
            output_mask[y:y + tile_size, x:x + tile_size] = pred_class

    return output_mask[:H, :W].cpu().numpy()


# =========================
# 3. ПРОДВИНУТЫЕ ФИЛЬТРЫ (ИЗ НОУТБУКА СОКОМАНДНИЦЫ)
# =========================
def filter_by_shape(mask, min_area=15, max_area=100000, max_aspect_ratio=5.0):
    """
    Отсеивает пятна, которые по форме не похожи на кроны деревьев.
    Убирает длинные дороги (большой aspect_ratio) и огромные поля/здания.
    """
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filtered_mask = np.zeros_like(mask, dtype=np.uint8)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue

        x, y, w, h = cv2.boundingRect(cnt)
        aspect_ratio = float(w) / h if h > 0 else 0

        # Если пятно слишком вытянуто (как дорога) — игнорируем
        if aspect_ratio > max_aspect_ratio or (h != 0 and (1 / aspect_ratio) > max_aspect_ratio):
            continue

        cv2.drawContours(filtered_mask, [cnt], -1, 1, thickness=cv2.FILLED)

    return filtered_mask.astype(bool)


def filter_by_green_context(target_mask, green_mask, context_radius=20):
    """
    Проверяет, окружено ли "рыжее" пятно (усыхание) "зеленым" контекстом (здоровым лесом).
    Если пятно лежит в чистом поле или на дороге без деревьев вокруг — удаляем его.
    """
    if not np.any(green_mask):
        return np.zeros_like(target_mask, dtype=bool)

    kernel = np.ones((context_radius, context_radius), np.uint8)
    # Расширяем маску здоровых деревьев
    green_dilated = cv2.dilate(green_mask.astype(np.uint8), kernel, iterations=1)

    # Оставляем только те части target_mask, которые пересекаются с расширенным лесом
    filtered = target_mask & (green_dilated > 0)
    return filtered


# =========================
# 4. ОБРАБОТКА МАСКИ И ВИЗУАЛИЗАЦИЯ
# =========================
def refine_mask(pred_mask):
    """
    Финальная очистка маски с использованием контекстных фильтров.
    """
    healthy = (pred_mask == 1).astype(np.uint8)
    # Объединяем классы 2 (лиственница) и 3 (хвоя) в общий класс "инфекция/усыхание"
    infected = ((pred_mask == 2) | (pred_mask == 3)).astype(np.uint8)

    # 1. Фильтр по форме (убираем дороги и здания)
    infected = filter_by_shape(infected, min_area=15, max_area=100000, max_aspect_ratio=5.0)

    # 2. Фильтр по контексту (убираем то, что не окружено лесом)
    infected = filter_by_green_context(infected, healthy, context_radius=25)

    # 3. Морфология для сглаживания границ крон
    kernel = np.ones((3, 3), np.uint8)
    infected = cv2.morphologyEx(infected.astype(np.uint8), cv2.MORPH_CLOSE, kernel, iterations=1)
    infected = cv2.morphologyEx(infected.astype(np.uint8), cv2.MORPH_OPEN, kernel, iterations=1).astype(bool)

    # Собираем финальную маску (0 - фон, 1 - здоровые, 2 - усыхание)
    refined = np.zeros_like(pred_mask, dtype=np.uint8)
    refined[healthy == 1] = 1
    refined[infected] = 2

    return refined


def build_decline_density(full_mask):
    """Построение красивой карты плотности усыхания (Heatmap)"""
    infected = (full_mask == 2).astype(np.float32)
    density = cv2.GaussianBlur(infected, (51, 51), 0)
    density_norm = cv2.normalize(density, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    heatmap = cv2.applyColorMap(density_norm, cv2.COLORMAP_JET)
    return heatmap


def normalize_kml_to_geojson(kml_coords):
    if isinstance(kml_coords, str):
        kml_coords = json.loads(kml_coords)
    ring = kml_coords
    if isinstance(ring[0][0], list): ring = ring[0]
    first_pt = ring[0]
    if abs(first_pt[0]) <= 90 and abs(first_pt[1]) > 90:
        ring = [[pt[1], pt[0]] for pt in ring]
    return {'type': 'Polygon', 'coordinates': [ring]}


# =========================
# 5. ОСНОВНАЯ ФУНКЦИЯ АЛГОРИТМА
# =========================
def run_aerial_analysis(aero_file_path: str, kml_coords: list = None, analysis_id: int = None):
    if not aero_file_path:
        raise ValueError("В алгоритм не передан путь к файлу.")

    print(f"\n[Alg1] 🌲 Запуск анализа для файла: {os.path.basename(aero_file_path)}")
    if not os.path.exists(aero_file_path):
        raise FileNotFoundError(f"Файл не найден: {aero_file_path}")

    transform = None
    original_image_bgr = None

    if aero_file_path.lower().endswith(('.tif', '.tiff')):
        with rasterio.open(aero_file_path) as src:
            image_rgb = src.read()[:3]
            image_rgb = np.moveaxis(image_rgb, 0, -1)
            transform = src.transform
            original_image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    else:
        original_image_bgr = cv2.imread(aero_file_path)
        if original_image_bgr is None: raise ValueError("OpenCV не смог прочитать файл.")
        image_rgb = cv2.cvtColor(original_image_bgr, cv2.COLOR_BGR2RGB)

    h, w = image_rgb.shape[:2]
    print(f"[Alg1] 📏 Размер изображения: {w}x{h} пикселей")

    if transform is None and kml_coords:
        try:
            geojson_poly = normalize_kml_to_geojson(kml_coords)
            ring = geojson_poly['coordinates'][0]
            lngs = [pt[0] for pt in ring]
            lats = [pt[1] for pt in ring]
            transform = from_bounds(min(lngs), min(lats), max(lngs), max(lats), w, h)
        except Exception as e:
            print(f"[Alg1] ❌ Ошибка создания виртуальной привязки: {e}")

    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[Alg1] 🧠 Устройство: {DEVICE}")

    model = UNet(n_classes=3).to(DEVICE)
    model_path = os.path.join(os.path.dirname(__file__), "forest_unet.pth")
    if not os.path.exists(model_path):
        model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "forest_unet.pth")

    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=DEVICE))
        print(f"[Alg1] ⚖️ Веса модели успешно загружены.")
    model.eval()

    image_tensor = torch.from_numpy(image_rgb).permute(2, 0, 1).float() / 255.0
    image_tensor = image_tensor.to(DEVICE)

    print(f"[Alg1] 🧩 Запуск нейросети...")
    if h > 1024 or w > 1024:
        mask = process_with_tiling(image_tensor, model, DEVICE)
    else:
        with torch.no_grad():
            output = model(image_tensor.unsqueeze(0))
            mask = torch.argmax(output, dim=1).squeeze(0).cpu().numpy().astype(np.uint8)

    print(f"[Alg1] 🛠 Применение контекстных фильтров (удаление дорог и шума)...")
    mask = refine_mask(mask)

    stats = {"total_pixels": int(h * w), "drying_pixels": 0, "drying_percent": 0.0}

    if kml_coords and transform:
        try:
            geojson_poly = normalize_kml_to_geojson(kml_coords)
            poly_mask = geometry_mask([geojson_poly], out_shape=(h, w), transform=transform, invert=True)
            mask = np.where(poly_mask, mask, 0)
            total_poly_pixels = np.sum(poly_mask)
            drying_pixels = np.sum((mask == 2) & poly_mask)
            stats["total_pixels"] = int(total_poly_pixels)
            stats["drying_pixels"] = int(drying_pixels)
            stats["drying_percent"] = round((drying_pixels / total_poly_pixels) * 100,
                                            2) if total_poly_pixels > 0 else 0.0
        except Exception as e:
            print(f"[Alg1] ❌ Ошибка наложения KML: {e}")
            drying_pixels = np.sum(mask == 2)
            stats["drying_pixels"] = int(drying_pixels)
            stats["drying_percent"] = round((drying_pixels / (h * w)) * 100, 2)
    else:
        drying_pixels = np.sum(mask == 2)
        stats["drying_pixels"] = int(drying_pixels)
        stats["drying_percent"] = round((drying_pixels / (h * w)) * 100, 2)

    # =========================
    # ВИЗУАЛИЗАЦИЯ (ЦВЕТА ИЗ НОУТБУКА)
    # =========================
    # BGR формат для OpenCV
    COLOR_HEALTHY_BGR = (0, 255, 0)  # Зеленый
    COLOR_INFECTED_BGR = (0, 255, 255)  # Желтый (в notebook был оранжевый/желтый для класса 2)

    # 1. Цветная маска (для сохранения как PNG)
    mask_visual = np.zeros((h, w, 3), dtype=np.uint8)
    mask_visual[mask == 1] = COLOR_HEALTHY_BGR
    mask_visual[mask == 2] = COLOR_INFECTED_BGR

    # 2. Overlay (наложение на оригинал)
    mask_colored = np.zeros_like(original_image_bgr)
    mask_colored[mask == 1] = COLOR_HEALTHY_BGR
    mask_colored[mask == 2] = COLOR_INFECTED_BGR
    overlay = cv2.addWeighted(original_image_bgr, 0.6, mask_colored, 0.4, 0)

    # 3. Heatmap
    heatmap = build_decline_density(mask)

    # Сохранение
    prefix = f"analysis_{analysis_id}" if analysis_id else "temp"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    mask_path = os.path.join(OUTPUT_DIR, f"{prefix}_aerial_mask_{timestamp}.png")
    cv2.imwrite(mask_path, mask_visual)

    heatmap_path = os.path.join(OUTPUT_DIR, f"{prefix}_aerial_heatmap_{timestamp}.png")
    cv2.imwrite(heatmap_path, heatmap)

    overlay_path = os.path.join(OUTPUT_DIR, f"{prefix}_aerial_overlay_{timestamp}.png")
    cv2.imwrite(overlay_path, overlay)

    print(f"[Alg1] 💾 Результаты сохранены. Усыхание: {stats['drying_percent']}%")

    return {
        "mask_url": f"/{mask_path}",
        "heatmap_url": f"/{heatmap_path}",
        "overlay_url": f"/{overlay_path}",
        "metrics": {
            "drying_percent": stats["drying_percent"],
            "total_area_ha": round(stats["total_pixels"] * 0.0001, 2),
            "drying_area_ha": round(stats["drying_pixels"] * 0.0001, 2),
        },
        "classes_found": {
            "healthy": int(np.sum(mask == 1)),
            "larch_drying": int(np.sum(mask == 2))
        }
    }