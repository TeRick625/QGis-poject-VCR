# worker.py
import os
import json
import urllib.request
import traceback
from datetime import datetime
from app import app, db, Analysis, WorkspaceItem, NeuralNetwork
from algorithms.alg1_aerial import run_aerial_analysis
from algorithms.alg2_satellite import run_satellite_analysis
import ee

# Папка для кэширования скачанных спутниковых снимков
SATELLITE_CACHE_DIR = os.path.join(app.config["UPLOAD_FOLDER"], "satellite_cache")
os.makedirs(SATELLITE_CACHE_DIR, exist_ok=True)


def download_gee_image_to_local(space_id, roi_geojson, analysis_id, img_index):
    """
    Скачивает снимок из GEE по его space_id в локальный GeoTIFF.
    """
    try:
        # Очищаем ID от возможных суффиксов
        clean_id = space_id.split('__')[0]
        img = ee.Image(clean_id)

        # Формируем имя файла
        filename = f"analysis_{analysis_id}_sat_{img_index}_{clean_id.replace('/', '_')}.tif"
        out_path = os.path.join(SATELLITE_CACHE_DIR, filename)

        # Если уже скачан (кэш), пропускаем
        if os.path.exists(out_path):
            print(f"[Worker] 📦 Снимок уже в кэше: {out_path}")
            return out_path

        print(f"[Worker] 📥 Скачивание снимка {clean_id} из GEE...")

        # Получаем URL для скачивания (формат GeoTIFF, разрешение 10м для Sentinel)
        url = img.getDownloadURL({
            'region': roi_geojson,
            'scale': 10,
            'format': 'GEO_TIFF',
            'bands': ['B4', 'B3', 'B2', 'B8']  # RGB + NIR для алгоритмов
        })

        urllib.request.urlretrieve(url, out_path)
        print(f"[Worker] ✅ Снимок успешно скачан: {out_path}")
        return out_path

    except Exception as e:
        print(f"[Worker] ❌ Ошибка скачивания из GEE: {e}")
        traceback.print_exc()
        return None


def execute_task(analysis_id):
    """
    Главная функция воркера. Выполняется в фоновом потоке.
    """
    print(f"\n{'=' * 20} WORKER: Старт задачи #{analysis_id} {'=' * 20}")
    analysis = Analysis.query.get(analysis_id)
    if not analysis:
        print("[Worker] Задача не найдена в БД.")
        return

    try:
        # 1. Меняем статус
        analysis.status = "running"
        db.session.commit()

        # 2. Достаем параметры
        ui_params = analysis.algorithm_data.get("ui_configured_parameters", {})
        input_item_id = ui_params.get("input_item_id")
        model_code = ui_params.get("model_code")

        input_item = WorkspaceItem.query.get(input_item_id)
        if not input_item:
            raise ValueError("Объект для анализа не найден в БД")

        result_data = {}
        local_tif_paths = []

        # 3. МАРШРУТИЗАЦИЯ И ПОДГОТОВКА ДАННЫХ
        if model_code == 'aerial_segment':
            # --- АЭРОФОТО ---
            aero_path = os.path.join(app.config["UPLOAD_FOLDER"], input_item.source_file)
            if not os.path.exists(aero_path):
                raise FileNotFoundError(f"Файл аэро не найден: {aero_path}")

            # Ищем связанный KML
            kml_coords = None
            if input_item.associated_kml_id:
                kml_item = WorkspaceItem.query.get(input_item.associated_kml_id)
                if kml_item and kml_item.polygon_coords:
                    kml_coords = kml_item.polygon_coords
            elif input_item.children:
                kml_child = next((c for c in input_item.children if c.type == 'polygon'), None)
                if kml_child and kml_child.polygon_coords:
                    kml_coords = kml_child.polygon_coords

            result_data = run_aerial_analysis(aero_path, kml_coords, analysis_id)

        elif model_code in ['satellite_single', 'satellite_multi']:
            print(f"\n[Worker] 🛰 [DEBUG] Тип input_item: {input_item.type}, ID: {input_item.id}")
            print(f"[Worker] 🛰 [DEBUG] Polygon coords (первые 20 символов): {str(input_item.polygon_coords)[:20]}...")
            context = {}
            gee_ids = []
            # СПОСОБ 1: Прямой SQL-запрос по associated_kml_id (самый надежный)
            sats_from_db = WorkspaceItem.query.filter_by(
                associated_kml_id=input_item.id,
                type='satellite'
            ).all()
            gee_ids = [s.satellite_space_id for s in sats_from_db if s.satellite_space_id]
            print(f"[Worker] 🛰 [DEBUG] Найдено через associated_kml_id: {len(gee_ids)} шт.")
            # СПОСОБ 2: Через SQLAlchemy relationship children (если настроено)
            if not gee_ids and hasattr(input_item, 'children'):
                for child in input_item.children:
                    if child.type == 'satellite' and child.satellite_space_id:
                        gee_ids.append(child.satellite_space_id)
                print(f"[Worker] 🛰 [DEBUG] Найдено через children: {len(gee_ids)} шт.")
            if gee_ids:
                print(f"[Worker] 🛰 [DEBUG] Исходные ID: {gee_ids}")
                context['gee_image_ids'] = [gid.split('__')[0] for gid in gee_ids]
                # 🚨 КРИТИЧЕСКОЕ ДОПОЛНЕНИЕ: Передаем код алгоритма в контекст!
                context['model_code'] = model_code
                print(
                    f"[Worker] 🛰 ✅ Передано в алгоритм {len(context['gee_image_ids'])} ID снимков (Режим: {model_code})")
            else:
                print(f"[Worker] 🛰 ⚠️ В БД не найдено связанных спутников для этого полигона.")
                # Фоллбэк: параметры поиска
                context['search_params'] = {
                    'date_start': ui_params.get('date_start', '2023-01-01'),
                    'date_end': ui_params.get('date_end', '2023-12-31'),
                    'max_cloud': ui_params.get('max_cloud', 20)
                }
                print(f"[Worker] 🛰 📦 Уходим в фоллбэк с параметрами: {context['search_params']}")
            result_data = run_satellite_analysis(polygon_coords=input_item.polygon_coords, context=context,
                                                 analysis_id=analysis_id)
        else:
            raise ValueError(f"Неизвестный код алгоритма: {model_code}")

        # 4. УСПЕШНОЕ ЗАВЕРШЕНИЕ: Сохраняем результаты в БД
        analysis.status = "completed"

        # 🚨 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ (SQLAlchemy JSON Trap)
        # Мы не меняем словарь по ключам, а создаем новый и перезаписываем его целиком!
        current_data = analysis.algorithm_data or {}

        current_data["result_files"] = {
            "original_url": result_data.get("original_url"),
            "mask_url": result_data.get("mask_url"),
            "heatmap_url": result_data.get("heatmap_url"),
            "overlay_url": result_data.get("overlay_url")
        }
        current_data["metrics"] = result_data.get("metrics", {})
        current_data["classes_found"] = result_data.get("classes_found", {})
        current_data["intermediate_masks"] = result_data.get("intermediate_masks", [])

        # ПЕРЕЗАПИСЫВАЕМ ЦЕЛИКОМ -> Это триггерит SQLAlchemy на реальное обновление БД!
        analysis.algorithm_data = current_data

        db.session.commit()
        print(f"[Worker] 🎉 Задача #{analysis_id} УСПЕШНО ЗАВЕРШЕНА! Данные реально ушли в БД.")

    except Exception as e:
        print(f"[Worker] 💥 КРИТИЧЕСКАЯ ОШИБКА В ЗАДАЧЕ #{analysis_id}: {str(e)}")
        traceback.print_exc()
        analysis.status = "failed"
        analysis.error_message = str(e)
        db.session.commit()