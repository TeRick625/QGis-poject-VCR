import os
import cv2
import torch
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from datetime import datetime

# Папка для сохранения результатов
OUTPUT_DIR = "static/results/aerial"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# =========================
# МОДЕЛЬ UNet (из ноутбука)
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
            torch.nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.net(x)


class UNet(torch.nn.Module):
    def __init__(self, n_classes=3):
        super().__init__()
        self.d1 = DoubleConv(3, 64)
        self.d2 = DoubleConv(64, 128)
        self.d3 = DoubleConv(128, 256)
        self.u1 = DoubleConv(256 + 128, 128)
        self.u2 = DoubleConv(128 + 64, 64)
        self.pool = torch.nn.MaxPool2d(2)
        self.up = torch.nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False)
        self.outc = torch.nn.Conv2d(64, n_classes, 1)

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
# ФУНКЦИИ ОБРАБОТКИ (из ноутбука)
# =========================
def refine_mask(mask):
    """Улучшение маски: удаление шума, сглаживание, расширение мелких зон"""
    refined = mask.copy()

    healthy = (mask == 1).astype(np.uint8)
    larch = (mask == 2).astype(np.uint8)
    khvoya = (mask == 3).astype(np.uint8)

    k_small = np.ones((3, 3), np.uint8)

    # Морфологические операции для каждого класса
    for cls_mask in [healthy, larch, khvoya]:
        refined_cls = cv2.morphologyEx(cls_mask, cv2.MORPH_CLOSE, k_small, iterations=1)
        refined_cls = cv2.morphologyEx(refined_cls, cv2.MORPH_OPEN, k_small, iterations=1)
        refined[cls_mask == 1] = refined_cls[cls_mask == 1]

    return refined


def build_decline_density(full_mask):
    """Построение карты плотности усыхания"""
    infected = (full_mask == 2).astype(np.float32)  # Класс 2 - усыхание
    density = cv2.GaussianBlur(infected, (51, 51), 0)
    density_norm = cv2.normalize(density, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    heatmap = cv2.applyColorMap(density_norm, cv2.COLORMAP_JET)
    return heatmap, density_norm


# =========================
# ОСНОВНАЯ ФУНКЦИЯ АЛГОРИТМА
# =========================
def run_aerial_analysis(aero_file_path: str, kml_coords: list = None, analysis_id: int = None):
    """
    Алг1: Сегментация аэрофотоснимка на 2 класса (лиственница, хвоя).

    :param aero_file_path: Путь к файлу аэрофотоснимка.
    :param kml_coords: Координаты полигона [[[lat, lng], ...]]. Если None - анализ на весь снимок.
    :param analysis_id: ID задачи для именования выходных файлов.
    :return: dict с метриками и путем к маске.
    """

    # 🛡️ ЗАЩИТА ОТ None
    if not aero_file_path:
        raise ValueError("В алгоритм не передан путь к файлу (aero_file_path is None).")

    print(f"[Alg1] Запуск анализа для файла: {aero_file_path}")

    if not os.path.exists(aero_file_path):
        raise FileNotFoundError(f"Файл аэрофотоснимка не найден: {aero_file_path}")

    # 1. Загрузка изображения
    print(f"[Alg1] Чтение файла: {aero_file_path}")
    if aero_file_path.lower().endswith(('.tif', '.tiff')):
        with rasterio.open(aero_file_path) as src:
            image = src.read()[:3]
            image = np.moveaxis(image, 0, -1)
            transform = src.transform
            crs = src.crs
            print(f"[Alg1] ✅ GeoTIFF загружен. Есть геопривязка (transform).")
    else:
        image = cv2.imread(aero_file_path)
        if image is None:
            raise ValueError(f"OpenCV не смог прочитать файл. Возможно, путь неверный или файл битый: {aero_file_path}")
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        transform = None  # Обычные JPG/PNG не имеют геопривязки
        crs = None
        print(f"[Alg1] ⚠️ Загружен обычный JPG/PNG. Геопривязка (transform) отсутствует.")

    h, w = image.shape[:2]
    print(f"[Alg1] Размер изображения: {w}x{h} пикселей")

    # 2. Подготовка к инференсу модели
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[Alg1] Используемое устройство: {DEVICE}")

    # Загрузка модели (если есть обученные веса)
    model = UNet(n_classes=3).to(DEVICE)
    model_path = os.path.join(os.path.dirname(__file__), "forest_unet.pth")

    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=DEVICE))
        print(f"[Alg1] Модель загружена из {model_path}")
    else:
        print(f"[Alg1] ⚠️ Веса модели не найдены ({model_path}). Используется случайная инициализация.")

    model.eval()

    # 3. Инференс (предсказание)
    # Нормализация изображения
    image_tensor = torch.from_numpy(image).permute(2, 0, 1).unsqueeze(0).float() / 255.0
    image_tensor = image_tensor.to(DEVICE)

    with torch.no_grad():
        output = model(image_tensor)
        pred = torch.argmax(output, dim=1).squeeze(0).cpu().numpy().astype(np.uint8)

    print(f"[Alg1] Предсказание модели завершено")

    # 4. Уточнение маски
    mask = refine_mask(pred)
    print(f"[Alg1] Маска уточнена")

    # 5. Обрезка по KML и статистика
    stats = {"total_pixels": int(h * w), "drying_pixels": 0, "drying_percent": 0.0}

    # ПРОВЕРКА: Можем ли мы обрезать по KML?
    if kml_coords and transform:
        print(f"[Alg1] 🎯 Обрезаем маску по KML-полигону...")
        try:
            # rasterio ожидает координаты в формате GeoJSON [[[lng, lat], ...]]
            # Если твой фронтенд отдает [lat, lng], здесь может потребоваться инверсия.
            # Но пока оставим как есть, предполагая, что в БД уже правильный формат.
            poly_mask = geometry_mask(
                [kml_coords],
                out_shape=(h, w),
                transform=transform,
                invert=True
            )
            mask = np.where(poly_mask, mask, 0)

            total_poly_pixels = np.sum(poly_mask)
            drying_pixels = np.sum((mask == 2) & poly_mask)
            stats["total_pixels"] = int(total_poly_pixels)
            stats["drying_pixels"] = int(drying_pixels)
            stats["drying_percent"] = round((drying_pixels / total_poly_pixels) * 100,
                                            2) if total_poly_pixels > 0 else 0.0
            print(f"[Alg1] ✅ Статистика посчитана ТОЛЬКО внутри полигона. Усыхание: {stats['drying_percent']}%")
        except Exception as e:
            print(f"[Alg1] ❌ Ошибка при наложении KML-маски: {e}. Переходим к анализу всей площади.")
            drying_pixels = np.sum(mask == 2)
            stats["drying_pixels"] = int(drying_pixels)
            stats["drying_percent"] = round((drying_pixels / (h * w)) * 100, 2)

    elif kml_coords and not transform:
        print(
            f"[Alg1] ⚠️ ВНИМАНИЕ: Есть KML, но изображение (JPG) не имеет геопривязки. Наложить координаты невозможно.")
        print(f"[Alg1] ℹ️ Выполняется анализ ВСЕЙ площади изображения.")
        drying_pixels = np.sum(mask == 2)
        stats["drying_pixels"] = int(drying_pixels)
        stats["drying_percent"] = round((drying_pixels / (h * w)) * 100, 2)
    else:
        # KML нет вообще
        print(f"[Alg1] ℹ️ KML не предоставлен. Анализ всей площади изображения.")
        drying_pixels = np.sum(mask == 2)
        stats["drying_pixels"] = int(drying_pixels)
        stats["drying_percent"] = round((drying_pixels / (h * w)) * 100, 2)

    # 6. Построение карты плотности усыхания
    heatmap, density_norm = build_decline_density(mask)

    # 7. Сохранение результирующей маски
    prefix = f"analysis_{analysis_id}" if analysis_id else "temp"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    mask_filename = f"{prefix}_aerial_mask_{timestamp}.png"
    mask_path = os.path.join(OUTPUT_DIR, mask_filename)

    # Сохраняем маску (0 - фон, 1 - здоровые, 2 - усыхание)
    mask_visual = np.where(mask == 1, 127, np.where(mask == 2, 255, 0)).astype(np.uint8)
    cv2.imwrite(mask_path, mask_visual)

    # Также сохраняем heatmap
    heatmap_filename = f"{prefix}_aerial_heatmap_{timestamp}.png"
    heatmap_path = os.path.join(OUTPUT_DIR, heatmap_filename)
    cv2.imwrite(heatmap_path, heatmap)

    print(f"[Alg1] Анализ завершен. Маска сохранена: {mask_path}")

    # 8. Возврат результата
    return {
        "mask_url": f"/{mask_path}",
        "heatmap_url": f"/{heatmap_path}",
        "metrics": {
            "drying_percent": stats["drying_percent"],
            "total_area_ha": round(stats["total_pixels"] * 0.0001, 2),
            "drying_area_ha": round(stats["drying_pixels"] * 0.0001, 2),
            "processing_time_sec": 0
        },
        "classes_found": {
            "healthy": int(np.sum(mask == 1)),
            "larch_drying": int(np.sum(mask == 2)),
            "pine_drying": int(np.sum(mask == 3))
        }
    }