# worker.py
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
            # Ищем связанный KML в базе данных
            kml_coords = None
            if input_item.associated_kml_id:
                kml_item = WorkspaceItem.query.get(input_item.associated_kml_id)
                if kml_item and kml_item.polygon_coords:
                    kml_coords = kml_item.polygon_coords
                    if isinstance(kml_coords, str):
                        import json
                        kml_coords = json.loads(kml_coords)
            # Запускаем ОДИН И ТОТ ЖЕ алгоритм.
            # Если kml_coords=None, он проанализирует весь снимок.
            # Если kml_coords=[...], он обрежет маску по полигону и посчитает точную площадь.
            result_data = run_aerial_analysis(
                aero_file_path=input_item.source_file,
                kml_coords=kml_coords,
                analysis_id=analysis_id
            )

        elif model_code in ['satellite_single', 'satellite_multi']:
            # Запуск Алг2 (Спутник)
            result_data = run_satellite_analysis(
                polygon_coords=input_item.polygon_coords,
                context=ui_params.get("context", {}),
                analysis_id=analysis_id
            )
        else:
            raise ValueError(f"Неизвестный код алгоритма: {model_code}")

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