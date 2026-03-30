# pages/analysis.py
import solara
from state import uploaded_files, analysis_results, is_analyzing, polygon_geojson


@solara.component
def AnalysisPage():
    solara.Markdown("## 2. Анализ и маски")

    # Проверка готовности
    if not polygon_geojson.value:
        solara.Warning("Сначала выделите область интереса на вкладке «1. Выбор области и снимков»")
        return

    if not uploaded_files.value:
        solara.Warning("Загрузите хотя бы один спутниковый снимок на первой вкладке")
        return

    solara.Markdown("### Выберите снимок для анализа")

    # Выбор снимка из списка загруженных
    selected_file_index = solara.use_reactive(0)

    file_names = [f["name"] for f in uploaded_files.value]

    solara.Select(
        label="Снимок для обработки",
        value=file_names[selected_file_index.value] if file_names else "",
        values=file_names,
        on_value=lambda v: selected_file_index.set(file_names.index(v) if v in file_names else 0),
    )

    current_file = uploaded_files.value[selected_file_index.value] if uploaded_files.value else None

    if current_file:
        solara.Success(f"Выбран файл: **{current_file['name']}**")

    # Кнопка запуска анализа
    with solara.Row(classes=["gap-4", "mt-6"]):
        solara.Button(
            "🚀 Запустить анализ нейросетью",
            color="primary",
            large=True,
            disabled=is_analyzing.value,
            on_click=lambda: run_analysis(current_file),
        )

        if is_analyzing.value:
            solara.ProgressLinear(indeterminate=True, color="primary")

    # ────────────────────────────────────────────────
    # Блок результатов анализа
    # ────────────────────────────────────────────────
    if analysis_results.value and current_file:
        solara.Markdown("### Результаты анализа")

        with solara.Columns([1, 1], classes=["gap-6"]):

            # Оригинальный снимок (заглушка)
            with solara.Card(classes=["pa-4"]):
                solara.Markdown("**Оригинальный спутниковый снимок**")
                # Здесь в будущем будет solara.Image(current_file["path"])
                solara.Text("🖼️ [Место для оригинального снимка]", classes=["text-6xl", "text-center", "py-12", "bg-slate-100", "rounded-xl"])

            # Маска после первого прохода нейросети
            with solara.Card(classes=["pa-4"]):
                solara.Markdown("**Маска классификации (нейросеть)**")
                solara.Text("🎨 [Маска сегментации]", classes=["text-6xl", "text-center", "py-12", "bg-emerald-50", "rounded-xl"])

                solara.Button(
                    "Загрузить аэрофотоснимок для повышения точности",
                    color="success",
                    text=True,
                    on_click=lambda: solara.Info("Функция загрузки аэрофото будет добавлена на следующем этапе")
                )

    elif is_analyzing.value:
        solara.Info("Идёт обработка снимка нейросетью... Это может занять некоторое время.")


# Вспомогательная функция (заглушка)
def run_analysis(file_info):
    if not file_info:
        return

    is_analyzing.set(True)

    # Имитация работы нейросети (в будущем здесь будет реальный вызов модели)
    import time
    time.sleep(1.5)   # имитация задержки

    # Заглушка результата
    analysis_results.set({
        "file_name": file_info["name"],
        "status": "success",
        "message": "Анализ завершён",
        "mask_path": "results/mask_demo.png"   # в будущем реальный путь
    })

    is_analyzing.set(False)
    solara.Success(f"Анализ файла {file_info['name']} успешно завершён!")