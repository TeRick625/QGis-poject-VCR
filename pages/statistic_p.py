# pages/statistic_p.py
import solara
import pandas as pd
import plotly.express as px

from state import selected_classes, analysis_results, polygon_geojson, uploaded_files


@solara.component
def StatisticsPage():
    solara.Markdown("## 3. Статистика и графики")

    # Проверка готовности данных
    if not polygon_geojson.value:
        solara.Warning("Сначала выделите область интереса на первой вкладке")
        return

    if not uploaded_files.value:
        solara.Warning("Загрузите хотя бы один снимок на первой вкладке")
        return

    if not analysis_results.value:
        solara.Warning("Сначала выполните анализ на вкладке «2. Анализ и маски»")
        solara.Button(
            "Перейти к анализу",
            color="primary",
            on_click=lambda: None  # здесь можно добавить логику переключения вкладки, если захочешь
        )
        return

    # Выбор классов (переносим логику из labels_page)
    solara.Markdown("### Выберите классы для отображения")

    available_labels = ["Лес", "Вода", "Сельхоз", "Гарь", "Дороги", "Другое"]

    with solara.Row(classes=["gap-6", "flex-wrap"]):
        for label in available_labels:
            checked = label in selected_classes.value

            def make_toggle(lbl=label):
                def toggle(new_value: bool):
                    current = selected_classes.value[:]
                    if new_value:
                        if lbl not in current:
                            current.append(lbl)
                    else:
                        if lbl in current:
                            current.remove(lbl)
                    selected_classes.value = current
                return toggle

            solara.Checkbox(
                label=label,
                value=checked,
                on_value=make_toggle(),
            )

    # Демонстрационные данные (в будущем здесь будут реальные результаты анализа)
    df = get_demo_dataframe()

    solara.Markdown("### Сводная таблица по классам")

    with solara.Card(elevation=2, classes=["pa-6"]):
        solara.DataFrame(
            df,
            items_per_page=10,
            scrollable=True,
        )

    solara.Markdown("### Графики распределения")

    with solara.Columns([1, 1], classes=["gap-6"]):

        # Столбчатая диаграмма
        with solara.Card(classes=["pa-4"]):
            solara.Markdown("**Распределение площадей по классам**")
            fig_bar = px.bar(
                df,
                x="Класс",
                y="Площадь_га",
                color="Класс",
                text_auto=True,
                color_discrete_sequence=["#4CAF50", "#2196F3", "#FF5722", "#9C27B0", "#FF9800", "#607D8B"],
                title="Площадь классов покрытия (га)",
            )
            fig_bar.update_layout(height=420)
            solara.FigurePlotly(fig_bar)

        # Круговая диаграмма
        with solara.Card(classes=["pa-4"]):
            solara.Markdown("**Доля каждого класса (%)**")
            fig_pie = px.pie(
                df.groupby("Класс")["Площадь_га"].sum().reset_index(),
                names="Класс",
                values="Площадь_га",
                color="Класс",
                color_discrete_sequence=["#4CAF50", "#2196F3", "#FF5722", "#9C27B0", "#FF9800", "#607D8B"],
                title="Доля классов от общей площади",
            )
            fig_pie.update_layout(height=420)
            solara.FigurePlotly(fig_pie)


# Вспомогательная функция с демо-данными
def get_demo_dataframe() -> pd.DataFrame:
    data = {
        "Класс": ["Лес", "Вода", "Гарь", "Сельхоз", "Дороги", "Другое"] * 2,
        "Год": [2020, 2020, 2020, 2020, 2020, 2020, 2021, 2021, 2021, 2021, 2021, 2021],
        "Площадь_га": [142.3, 38.7, 19.1, 67.4, 12.8, 8.9, 138.6, 41.2, 15.4, 65.1, 13.2, 9.3],
        "Процент": [45.2, 12.3, 6.1, 21.4, 4.1, 2.8, 44.1, 13.1, 4.9, 20.7, 4.2, 3.0],
    }
    return pd.DataFrame(data)