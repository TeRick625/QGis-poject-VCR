import solara

# реактивные переменные — общие для всех вкладок
polygon_geojson = solara.reactive(None)           # GeoJSON от DrawControl
selected_classes = solara.reactive([])            # ["Лес", "Вода", "Гарь", …]
uploaded_files = solara.reactive([])              # [{"name": str, "path": str, "date": str}]
analysis_results = solara.reactive(None)          # список dict с результатами по датам
is_analyzing = solara.reactive(False)

# Состояние авторизации (пока упрощённое)
auth_status = solara.reactive("unauthenticated")  # "unauthenticated" | "authenticated" | "guest"

# Данные текущего пользователя (заглушки на будущее)
user_name = solara.reactive("Иван Иванов")          # будет приходить с бэкенда
user_email = solara.reactive("ivan@example.com")    # будет приходить с бэкенда

current_tab = solara.reactive(0)