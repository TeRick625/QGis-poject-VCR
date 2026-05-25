import os
import ee
import json
from datetime import datetime


def init_earth_engine():
    """
    Автоматическая фоновая авторизация в Google Earth Engine
    с использованием Сервисного аккаунта для серверных приложений.
    """
    try:
        # Проверяем, инициализирован ли уже EE
        ee.Initialize()
        return True
    except Exception:
        # Если нет, пробуем авторизоваться через файл ключа
        key_path = "ee_key.json"
        if not os.path.exists(key_path):
            print(f"❌ Ошибка: Файл ключа {key_path} не найден в корне проекта!")
            return False

        try:
            with open(key_path, 'r') as f:
                key_data = json.load(f)

            # Используем сервисные учетные данные вместо интерактивного окна
            credentials = ee.ServiceAccountCredentials(key_data['client_email'], key_path)
            ee.Initialize(credentials)
            print("✅ Успешная автоматическая авторизация в Google Earth Engine.")
            return True
        except Exception as e:
            print(f"❌ Ошибка инициализации Earth Engine: {str(e)}")
            return False


def run_satellite_analysis(analysis_id, polygon_geojson, ui_params):
    """
    Основная функция запуска алгоритма твоего сокомандника.

    :param analysis_id: ID записи из таблицы analyses (чтобы мы могли обновлять статус в БД)
    :param polygon_geojson: Координаты полигона, который нарисовал пользователь
    :param ui_params: Словарь параметров (даты, облачность, выбранный индекс)
    """
    # 1. Сначала проверяем/включаем авторизацию в EE
    if not init_earth_engine():
        return {"success": False, "error": "Earth Engine authentication failed"}

    print(f"🚀 Запуск спутникового анализа для задачи #{analysis_id}...")

    try:
        # Превращаем переданные фронтендом GeoJSON координаты полигона в объект ee.Geometry
        # Предполагаем, что polygon_geojson - это стандартный словарь координат полигона
        if 'coordinates' in polygon_geojson:
            roi = ee.Geometry.Polygon(polygon_geojson['coordinates'])
        else:
            # На случай, если передан сырой массив координат
            roi = ee.Geometry.Polygon(polygon_geojson)

        # Считываем параметры из модального окна
        max_cloud = ui_params.get("max_cloud", 20)
        # Пример работы с датами (из полей snapshot_dates, которые ты заложил)
        date_start = ui_params.get("date_start", "2024-01-01")
        date_end = ui_params.get("date_end", "2024-09-01")

        # -------------------------------------------------------------------------
        # Здесь будет идти фильтрация Sentinel-2 ('COPERNICUS/S2_SR_HARMONIZED'),
        # расчет NDVI/NDRE, вычитание масок и т.д.
        # -------------------------------------------------------------------------

        # В качестве временного теста/заглушки имитируем успешную работу алгоритма:
        import time
        time.sleep(5)  # Имитируем тяжелые расчеты в течение 5 секунд

        print(f"✅ Анализ #{analysis_id} успешно завершен!")
        return {
            "success": True,
            "result_data": {
                "message": "Расчет индексов выполнен успешно (Заглушка алгоритма)",
                "analyzed_area_ha": 124.5  # Пример каких-то расчетных данных
            }
        }

    except Exception as e:
        print(f"❌ Ошибка в ходе выполнения спутникового анализа: {str(e)}")
        return {"success": False, "error": str(e)}