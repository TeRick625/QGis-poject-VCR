# pages/results_and_export.py
import solara
from pathlib import Path
import zipfile
import os

from state import analysis_results, uploaded_files, polygon_geojson


@solara.component
def ResultsAndExportPage():
    solara.Markdown("## 4. Результаты и экспорт")

    if not analysis_results.value:
        solara.Warning("Пока нет завершённых анализов. Выполните анализ на вкладке «2. Анализ и маски»")
        return

    if not uploaded_files.value:
        solara.Warning("Нет загруженных снимков")
        return

    solara.Markdown("### Выполненные анализы")

    # Отображаем список проанализированных снимков
    with solara.Card(classes=["pa-6", "mb-8"]):
        for i, file in enumerate(uploaded_files.value):
            analyzed = analysis_results.value and isinstance(analysis_results.value, dict) and \
                       analysis_results.value.get("file_name") == file["name"]

            with solara.Row(classes=["justify-between", "items-center", "py-2"]):
                solara.Text(f"📸 {file['name']}", classes=["font-medium"])

                if analyzed:
                    solara.Success("✓ Проанализирован")
                else:
                    solara.Text("— Не анализировался", classes=["text-slate-400"])

    # Блок экспорта
    solara.Markdown("### Экспорт результатов")

    with solara.Card(classes=["pa-8", "text-center"]):
        solara.Markdown("**Скачать все результаты одним архивом**")
        solara.Text(
            "В архив войдут:\n"
            "• Оригинальные снимки\n"
            "• Маски классификации\n"
            "• Таблицы статистики\n"
            "• Графики\n"
            "• GeoJSON полигона",
            classes=["text-slate-600", "whitespace-pre-line", "my-6"]
        )

        solara.Button(
            "📦 Скачать архив (ZIP)",
            color="success",
            large=True,
            icon_name="mdi-download",
            on_click=lambda: create_and_download_archive(),
        )

    solara.Markdown("### Дополнительно")
    with solara.Row(classes=["gap-4"]):
        solara.Button(
            "Очистить все результаты",
            color="error",
            text=True,
            on_click=lambda: clear_all_results()
        )


# ====================== Вспомогательные функции ======================

def create_and_download_archive():
    """Создаёт ZIP-архив и инициирует скачивание (заглушка)"""
    try:
        export_dir = Path("results/export")
        export_dir.mkdir(parents=True, exist_ok=True)

        zip_path = export_dir / "bio_gis_results.zip"

        with zipfile.ZipFile(zip_path, 'w') as zipf:
            # Добавляем заглушку файлов (в будущем здесь будут реальные файлы)
            zipf.writestr("README.txt", "Результаты анализа BioGIS Tool\nДата: 2026\n")
            if polygon_geojson.value:
                zipf.writestr("polygon.geojson", str(polygon_geojson.value))

            # Можно добавлять реальные файлы из uploads и results
            for f in uploaded_files.value:
                if Path(f["path"]).exists():
                    zipf.write(f["path"], f"original_images/{f['name']}")

        # Solara не имеет встроенного "скачать файл" напрямую, поэтому показываем уведомление
        solara.Success(f"Архив готов! (файл сохранён как {zip_path.name})")
        solara.Info("В реальной версии здесь будет автоматическое скачивание.")

    except Exception as e:
        solara.Error(f"Ошибка при создании архива: {e}")


def clear_all_results():
    """Очистка всех результатов"""
    if analysis_results.value:
        analysis_results.set(None)
    solara.Success("Все результаты очищены")