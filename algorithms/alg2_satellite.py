# algorithms/alg2_satellite.py
import os
import json
import re
import ee
import urllib.request
from datetime import datetime
from gee_analysis import init_earth_engine

OUTPUT_DIR = "static/results/satellite"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# =========================
# ФУНКЦИИ ИЗ НОУТБУКА
# =========================
def add_indices(img):
    """Расчет NDVI и NDMI (индекс влажности)"""
    ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI')
    ndmi = img.normalizedDifference(['B8', 'B11']).rename('NDMI')
    return img.addBands([ndvi, ndmi])


def get_year_from_id(space_id):
    """Извлекает год из ID снимка GEE (например, 20230414T... -> 2023)"""
    match = re.search(r'(\d{4})\d{4}T', space_id)
    return int(match.group(1)) if match else None


def normalize_coords_for_gee(coords):
    """Приводит координаты к формату GEE [[[lng, lat], ...]]"""
    if isinstance(coords, str): coords = json.loads(coords)
    ring = coords[0] if isinstance(coords[0][0], list) else coords
    first_pt = ring[0]
    if abs(first_pt[0]) <= 90 and abs(first_pt[1]) > 90:
        ring = [[pt[1], pt[0]] for pt in ring]
    return [ring]


# =========================
# ОСНОВНАЯ ФУНКЦИЯ АЛГОРИТМА
# =========================
def run_satellite_analysis(polygon_coords: list, context: dict, analysis_id: int = None):
    print(f"[Alg2] 🛰 Запуск продвинутого GEE-анализа (Тренды + NDMI)...")

    if not init_earth_engine():
        raise Exception("Не удалось подключиться к Google Earth Engine")

    gee_coords = normalize_coords_for_gee(polygon_coords)
    roi = ee.Geometry.Polygon(gee_coords)

    gee_ids = context.get('gee_image_ids', [])
    if not gee_ids:
        raise ValueError("В контексте не найдено ID снимков.")

    print(f"[Alg2] ✅ Загружаем {len(gee_ids)} снимков...")
    images = [ee.Image(gid) for gid in gee_ids]
    collection = ee.ImageCollection(images).map(add_indices)

    prefix = f"analysis_{analysis_id}" if analysis_id else "temp"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    intermediate_masks = []

    # ==========================================
    # БЛОК 1: ПРОМЕЖУТОЧНЫЕ МАСКИ (МЕТОД БАЗОВОГО ГОДА + ФИЛЬТРАЦИЯ ШУМА)
    # ==========================================
    print(f"[Alg2] 📅 Генерируем логику динамики (Метод Базового года + Фильтрация шума)...")
    # 🚨 КРИТИЧЕСКОЕ ДОПОЛНЕНИЕ: Явно извлекаем и сортируем годы из ID снимков
    years = sorted(list(set(get_year_from_id(gid) for gid in gee_ids if get_year_from_id(gid))))

    if not years:
        raise ValueError("Не удалось определить годы для выбранных снимков. Проверьте ID снимков.")
    # Определяем базовый год (самый первый в выборке) - наш эталон "здорового" леса
    baseline_year = years[0]
    baseline_ids = [gid for gid in gee_ids if get_year_from_id(gid) == baseline_year]
    baseline_ndvi = ee.ImageCollection([ee.Image(gid) for gid in baseline_ids]).map(add_indices).select('NDVI').median()

    for year in years:
        year_ids = [gid for gid in gee_ids if get_year_from_id(gid) == year]
        if not year_ids: continue

        year_collection = ee.ImageCollection([ee.Image(gid) for gid in year_ids]).map(add_indices)
        current_ndvi = year_collection.select('NDVI').median()

        if year == baseline_year:
            # Для базового года показываем только уже мертвые зоны (абсолютный жесткий порог)
            decline_year = current_ndvi.lt(0.25).And(current_ndvi.gt(0))
        else:
            # Для остальных лет считаем ПАДЕНИЕ (Дельту) относительно базового года
            delta = current_ndvi.subtract(baseline_ndvi)
            # Если NDVI упал на 0.15 и более - это стресс/начало усыхания
            decline_year = delta.lt(-0.15).And(current_ndvi.gt(0))

        # 🔬 КРИТИЧЕСКАЯ ФИЛЬТРАЦИЯ ШУМА (чтобы точки не прыгали)
        # Считаем размер связных зон и убираем те, что меньше 20 пикселей (шум/тени)
        size = decline_year.connectedPixelCount(maxSize=256, eightConnected=True)
        clean_decline = decline_year.updateMask(size.gte(20)).selfMask()

        # Экспорт маски года (ЖЕЛТЫЙ цвет для динамики стресса)
        year_mask_path = os.path.join(OUTPUT_DIR, f"{prefix}_sat_{year}_stress.png")
        try:
            url_year = clean_decline.getThumbURL({
                'region': roi.getInfo(), 'dimensions': 1024, 'format': 'png',
                'min': 0, 'max': 1, 'palette': ['FFFF00'], 'crs': 'EPSG:4326'
            })
            urllib.request.urlretrieve(url_year, year_mask_path)
            if os.path.getsize(year_mask_path) > 0:
                intermediate_masks.append({
                    "date": str(year),
                    "url": f"/{year_mask_path}",
                    "source_id": f"stress_{year}"
                })
                print(f"[Alg2]   ✅ Маска стресса за {year} сохранена (шум отфильтрован).")
        except Exception as e:
            print(f"[Alg2]   ⚠️ Ошибка экспорта маски за {year}: {e}")
    # ==========================================
    # БЛОК 2: ИТОГОВАЯ МАСКА (ТРЕНД УСЫХАНИЯ)
    # ==========================================
    print(f"[Alg2] 📉 Считаем итоговый тренд усыхания (SensSlope)...")

    if len(gee_ids) >= 3:
        # Добавляем временную шкалу (в годах от 2020)
        start_date = ee.Date('2020-01-01')

        def add_time(img):
            time_years = img.date().difference(start_date, 'year')
            # Добавляем время как БАНД (слой), а не как метаданные!
            # Reducer.sensSlope требует, чтобы и время, и индекс были слоями.
            time_band = ee.Image.constant(time_years).rename('time').toFloat()
            return img.addBands(time_band)  # ✅ Теперь это полноценный слой

        collection_with_time = collection.map(add_time)

        # Считаем наклон тренда (SensSlope) для NDVI и NDMI
        trend_ndvi = collection_with_time.select(['time', 'NDVI']).reduce(ee.Reducer.sensSlope())
        trend_ndmi = collection_with_time.select(['time', 'NDMI']).reduce(ee.Reducer.sensSlope())

        ndvi_slope = trend_ndvi.select('slope')
        ndmi_slope = trend_ndmi.select('slope')
        mean_ndvi = collection_with_time.select('NDVI').mean()

        # 🧬 ФОРМУЛА УСЫХАНИЯ ИЗ НОУТБУКА 🧬
        # NDVI падает, NDMI падает (теряет влагу), средний NDVI низкий
        drying = (ndvi_slope.lt(-0.002)
                  .And(ndmi_slope.lt(-0.006))
                  .And(mean_ndvi.lt(0.82))
                  .And(ndvi_slope.lt(0)))

        drying_mask = drying.selfMask().rename('drying').uint8()

        # 🔬 ФИЛЬТРАЦИЯ ШУМА (Упрощённый надёжный вариант)
        # Бинарная маска усыхания (один слой)
        drying_mask = drying.selfMask().rename('drying').uint8()

        # Считаем размер каждой связной зоны (один слой)
        # connectedPixelCount считает количество пикселей в связных компонентах
        size = drying_mask.connectedPixelCount(maxSize=256, eightConnected=True)

        min_pixels = 15  # Убираем зоны меньше 15 пикселей (шум)

        # Фильтруем: оставляем только зоны размером >= min_pixels
        # updateMask применяет маску (один слой), rename переименовывает
        clean_mask = drying_mask.updateMask(size.gte(min_pixels)).rename('drying_zone_clean')

        final_export = clean_mask
        mode = "gee_sens_slope_trend"
        print(f"[Alg2] 🧬 Тренд рассчитан. Шум отфильтрован (min {min_pixels} px).")
    else:
        # Фоллбэк, если снимков мало (нет смысла считать тренд)
        print(f"[Alg2] ⚠️ Снимков меньше 3, считаем простую медиану NDVI...")
        median_ndvi = collection.select('NDVI').median()
        final_export = median_ndvi.lt(0.3).And(median_ndvi.gt(0)).selfMask().uint8()
        mode = "gee_simple_median"

    # Экспорт итоговой маски (КРАСНЫЙ цвет для тренда)
    final_mask_path = os.path.join(OUTPUT_DIR, f"{prefix}_sat_final_trend_{timestamp}.png")
    try:
        url_final = final_export.getThumbURL({
            'region': roi.getInfo(), 'dimensions': 1024, 'format': 'png',
            'min': 0, 'max': 1, 'palette': ['FF0000'], 'crs': 'EPSG:4326'
        })
        urllib.request.urlretrieve(url_final, final_mask_path)
        print(f"[Alg2] ✅ Итоговая маска тренда сохранена.")
    except Exception as e:
        print(f"[Alg2] ❌ Ошибка экспорта итоговой маски: {e}")
        raise

    # ==========================================
    # БЛОК 3: СТАТИСТИКА
    # ==========================================
    try:
        stats = final_export.reduceRegion(
            reducer=ee.Reducer.mean(), geometry=roi, scale=10, maxPixels=1e13, bestEffort=True
        ).getInfo()
        drying_percent = round(stats.get('drying_zone_clean', stats.get('drying', 0)) * 100, 2)
    except:
        drying_percent = 0.0

    try:
        area_sq_m = roi.area().getInfo()
        total_area_ha = round(area_sq_m / 10000, 2)
    except:
        total_area_ha = 0.0

    drying_area_ha = round(total_area_ha * (drying_percent / 100), 2)

    return {
        "mask_url": f"/{final_mask_path}",  # Итоговый тренд (красный)
        "intermediate_masks": intermediate_masks,  # Динамика по годам (желтые)
        "metrics": {
            "drying_percent": drying_percent,
            "total_area_ha": total_area_ha,
            "drying_area_ha": drying_area_ha,
            "images_processed": len(gee_ids),
            "years_analyzed": len(years)
        },
        "processing_mode": mode
    }