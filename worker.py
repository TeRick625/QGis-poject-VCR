# worker.py
import os
import time
import json
from app import app, db, Analysis, WorkspaceItem, NeuralNetwork
from algorithms.alg1_aerial import run_aerial_analysis
from algorithms.alg2_satellite import run_satellite_analysis



def execute_task(analysis_id):
    """Логика выполнения задачи (оркестратор)"""
    analysis = Analysis.query.get(analysis_id)
    if not analysis:
        return

    try:
        # Меняем статус на "выполняется"
        analysis.status = "running"
        db.session.commit()
        print(f"[Worker] Задача {analysis_id} запущена в работу...")

        # Достаем параметры, которые фронтенд сохранил при запуске
        ui_params = analysis.algorithm_data.get("ui_configured_parameters", {})
        input_item_id = ui_params.get("input_item_id")
        model_code = ui_params.get("model_code")  # Или берем из связи с NeuralNetwork

        input_item = WorkspaceItem.query.get(input_item_id)
        if not input_item:
            raise ValueError("Объект для анализа не найден в БД")

        result_data = {}

        # === МАРШРУТИЗАЦИЯ ПО ТИПУ АЛГОРИТМА ===
        if model_code == 'aerial_segment':
            print(f"[Worker] 🌲 Запуск аэрофото анализа для item ID: {input_item.id}")
            print(f"[Worker] 📊 Тип объекта в БД: {input_item.type}")
            print(f"[Worker] 📁 source_file из БД: {input_item.source_file}")

            # 🛡️ ЗАЩИТА 1: Проверяем, что выбран именно аэрофотоснимок, а не KML/Полигон
            if input_item.type != 'aero':
                raise ValueError(
                    f"❌ Ошибка выбора: В базе найден объект типа '{input_item.type}', а ожидался 'aero'. Скорее всего, вы кликнули по KML-полигону, а не по самому снимку.")

            # 🛡️ ЗАЩИТА 2: Проверяем, что у снимка вообще есть физический файл в БД
            if not input_item.source_file:
                raise ValueError(
                    f"❌ Ошибка данных: У аэрофотоснимка (ID: {input_item.id}) в базе данных отсутствует путь к файлу (source_file = None).")

            # 1. Формируем АБСОЛЮТНЫЙ путь к файлу
            base_upload_dir = os.path.abspath(app.config["UPLOAD_FOLDER"])
            aero_path = os.path.join(base_upload_dir, input_item.source_file)

            if not os.path.exists(aero_path):
                raise FileNotFoundError(f"❌ Файл аэрофотоснимка не найден на диске по пути: {aero_path}")
            print(f"[Worker] ✅ Файл успешно найден на диске: {aero_path}")

            # 2. Безопасно достаем KML координаты из БД (ищем среди детей)
            kml_coords = None
            kml_item = next((child for child in input_item.children if child.type == 'polygon'), None)

            if kml_item and kml_item.polygon_coords:
                coords_data = kml_item.polygon_coords
                if isinstance(coords_data, str):
                    import json
                    try:
                        kml_coords = json.loads(coords_data)
                    except json.JSONDecodeError:
                        print("[Worker] ⚠️ Ошибка парсинга JSON координат KML")
                else:
                    kml_coords = coords_data
                print(f"[Worker] ✅ KML найден. Точек в полигоне: {len(kml_coords[0]) if kml_coords else 0}")
            else:
                print("[Worker] ℹ️ KML не привязан. Анализ будет выполнен на всю площадь изображения.")

            # 3. Запуск алгоритма
            result_data = run_aerial_analysis(
                aero_file_path=aero_path,
                kml_coords=kml_coords,
                analysis_id=analysis_id
            )

        elif model_code in ['satellite_single', 'satellite_multi']:
            context = {}
            # 👇 ПРАВИЛЬНЫЙ ЗАПРОС: Ищем снимки, привязанные к полигону через associated_kml_id
            saved_sats = WorkspaceItem.query.filter_by(
                associated_kml_id=input_item.id,
                type='satellite'
            ).all()
            if saved_sats:
                gee_ids = [sat.satellite_space_id for sat in saved_sats if sat.satellite_space_id]
                # Очищаем ID от суффиксов, если они есть
                context['gee_image_ids'] = [gid.split('__')[0] for gid in gee_ids]
                print(
                    f"[Worker] ✅ Найдено {len(context['gee_image_ids'])} сохраненных снимков в БД. Передаем в алгоритм.")
            else:
                # Фоллбэк: если юзер не сохранял снимки, а просто задал параметры
                context['search_params'] = {
                    'date_start': ui_params.get('date_start', '2023-01-01'),
                    'date_end': ui_params.get('date_end', '2023-12-31'),
                    'max_cloud': ui_params.get('max_cloud', 20)
                }
                print("[Worker] ⚠️ Сохраненных снимков нет. Уходим в фоллбэк (самостоятельный поиск в GEE).")
            result_data = run_satellite_analysis(
                polygon_coords=input_item.polygon_coords,
                context=context,
                analysis_id=analysis_id
            )
        else:
            raise ValueError(f"Неизвестный код алгоритма: {model_code}")

        # === ПРОВЕРКА РЕЗУЛЬТАТА АЛГОРИТМА ===
        if not result_data.get("success", True):
            # Если алгоритм вернул ошибку, кидаем исключение, чтобы сработал нижний except
            raise Exception(f"Алгоритм вернул ошибку: {result_data.get('error', 'Неизвестная ошибка')}")

        # === УСПЕШНОЕ ЗАВЕРШЕНИЕ ===
        analysis.status = "completed"
        # Сливаем новые метрики с теми, что уже были в algorithm_data
        if analysis.algorithm_data is None:
            analysis.algorithm_data = {}
        analysis.algorithm_data.update(result_data)
        db.session.commit()
        print(f"[Worker] Задача {analysis_id} успешно завершена.")

    except Exception as e:
        # === ОБРАБОТКА ОШИБКИ ===
        db.session.rollback()
        analysis.status = "failed"
        analysis.error_message = str(e)
        db.session.commit()
        print(f"[Worker] Ошибка задачи {analysis_id}: {e}")


def start_worker():
    """Бесконечный цикл опроса базы данных"""
    print("[Worker] Фоновый воркер запущен и ожидает задач...")
    with app.app_context():
        while True:
            # Ищем самую старую задачу в статусе 'pending'
            pending_task = Analysis.query.filter_by(status='pending').order_by(Analysis.timestamp.asc()).first()

            if pending_task:
                execute_task(pending_task.id)
            else:
                # Если задач нет, спим 2 секунды, чтобы не долбить БД запросами
                time.sleep(2)


if __name__ == "__main__":
    start_worker()