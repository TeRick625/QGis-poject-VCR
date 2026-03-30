# pages/dashboard.py
from pathlib import Path
import solara
import solara.lab

# Импортируем все компоненты вкладок
from pages.selection_p import SelectionPage
from pages.analysis import AnalysisPage
from pages.statistic_p import StatisticsPage
from pages.results_and_export import ResultsAndExportPage

from state import current_tab


css_path = Path("assets/style.css")   # путь относительно pages/


@solara.component
def Page():
    solara.Style(css_path)

    # Заголовок страницы внутри Solara (можно будет убрать позже, если хедер полностью в Flask)
    with solara.Column(classes=["pa-4", "pb-0"]):
        solara.Markdown("# Анализатор BioGIS")

    # Горизонтальные вкладки
    with solara.Div(classes=["custom-tabs", "mb-2"]):
        with solara.lab.Tabs(
            value=current_tab,
            align="center",
            background_color="#f8f9fa",
            color="primary",
            grow=True,
        ):
            solara.lab.Tab("1. Выбор области и снимков")
            solara.lab.Tab("2. Анализ и маски")
            solara.lab.Tab("3. Статистика")
            solara.lab.Tab("4. Результаты и экспорт")

    # Основной контент вкладки
    with solara.Column(classes=["main-content-wrapper", "pa-6", "flex-grow-1"]):
        if current_tab.value == 0:
            SelectionPage()
        elif current_tab.value == 1:
            AnalysisPage()
        elif current_tab.value == 2:
            StatisticsPage()
        elif current_tab.value == 3:
            ResultsAndExportPage()
