# pages/selection_p.py
import solara
from pathlib import Path
import ipyleaflet as leafmap
from ipywidgets import Layout

from state import polygon_geojson, uploaded_files


UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@solara.component
def SelectionPage():
    solara.Markdown("## 1. Выбор области интереса и загрузка снимков")

    with solara.Row(classes=["gap-8"]):
        # Левая колонка — Карта
        with solara.Column(classes=["flex-1"]):
            solara.Markdown("### Выделите полигон на карте")

            m = leafmap.Map(
                center=[55.0, 37.0],
                zoom=6,
                layout=Layout(width="100%", height="650px"),
                scroll_wheel_zoom=True,
            )

            draw_control = leafmap.GeomanDrawControl(
                polygon={"shapeOptions": {"color": "#f00"}},
                edit=True,
                remove=True,
            )

            def on_draw(_target, action, geo_json):
                if action in ["created", "edited"]:
                    polygon_geojson.value = geo_json
                elif action == "deleted":
                    polygon_geojson.value = None

            draw_control.on_draw(on_draw)
            m.add(draw_control)
            m.add(leafmap.FullScreenControl())
            m.add(leafmap.ScaleControl(position="bottomright"))

            if polygon_geojson.value:
                geo_layer = leafmap.GeoJSON(
                    data=polygon_geojson.value,
                    style={"color": "#00ff00", "fillOpacity": 0.25, "weight": 3},
                )
                m.add(geo_layer)

            solara.display(m)

            if polygon_geojson.value:
                solara.Success("Полигон успешно захвачен ✓")
            else:
                solara.Warning("Нарисуйте полигон на карте")

        # Правая колонка — Загрузка и список файлов
        with solara.Column(classes=["w-96"]):
            solara.Markdown("### Загрузка спутниковых снимков")

            def on_file(file_info):
                if not file_info:
                    return
                filename = file_info["name"]
                save_path = UPLOAD_DIR / filename

                file_obj = file_info["file_obj"]
                file_obj.seek(0)
                with open(save_path, "wb") as f:
                    while chunk := file_obj.read(8192):
                        f.write(chunk)

                new_file = {
                    "name": filename,
                    "path": str(save_path),
                    "date": filename[:10] if len(filename) >= 10 else "—",
                }
                uploaded_files.value = uploaded_files.value + [new_file]

                solara.Success(f"Файл загружен: {filename}")

            solara.FileDrop(
                label="Перетащите снимок или кликните",
                on_file=on_file,
            )

            solara.Markdown("### Загруженные снимки")
            if uploaded_files.value:
                with solara.Card(elevation=2, classes=["pa-4"]):
                    for f in uploaded_files.value:
                        solara.Text(f"• {f['name']}  ({f.get('date', '—')})")
            else:
                solara.Text("Пока нет загруженных снимков", classes=["italic", "text-slate-500"])
