import os
from pathlib import Path
from datetime import datetime
from io import BytesIO

from flask import Flask, render_template, redirect, url_for, request, session, flash, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import rasterio
from rasterio.warp import transform_bounds

from config import Config
from db_models import db, User, WorkspaceItem, NeuralNetwork, Analysis

import ee
from gee_analysis import init_earth_engine


# ====================== CONFIG ======================
app = Flask(__name__)
CORS(app)

app.secret_key = "bio_gis_super_secret_key_change_in_production"
app.config["UPLOAD_FOLDER"] = "uploads"
app.config["RESULTS_FOLDER"] = "results"
app.config.from_object(Config)

# Инициализация базы данных
db.init_app(app)

# Создаём необходимые папки
Path(app.config["UPLOAD_FOLDER"]).mkdir(exist_ok=True)
Path(app.config["RESULTS_FOLDER"]).mkdir(exist_ok=True)
Path("results/masks").mkdir(exist_ok=True)


# ====================== ФУНКЦИИ УПРАВЛЕНИЯ БД ======================
def init_db():
    with app.app_context():
        db.create_all()
        print("✅ Таблицы созданы/обновлены.")


def seed_neural_networks():
    with app.app_context():
        # Проверяем, есть ли уже записи, чтобы не дублировать их при каждом перезапуске
        if NeuralNetwork.query.count() == 0:
            models = [
                NeuralNetwork(
                    name="Анализ спутниковых снимков (GEE)",
                    code_name="gee_satellite_index",
                    short_desc="Анализ вегетационных индексов (NDVI, NDRE) на основе мультивременных снимков Sentinel-2.",
                    type="satellite",
                    applicable_to="polygon",
                    detail="Использует Google Earth Engine для расчета усыхания кроны по разностям индексов за разные периоды.",
                    is_active=True
                ),
                NeuralNetwork(
                    name="Сегментация крон деревьев (U-Net)",
                    code_name="pytorch_tree_unet",
                    short_desc="Поиск и сегментация отдельных крон деревьев по высокодетальным аэрофотоснимкам.",
                    type="aero",
                    applicable_to="aero",
                    detail="Использует сверточную нейросеть U-Net на PyTorch для выделения границ деревьев и оценки их состояния.",
                    is_active=True
                )
            ]
            db.session.add_all(models)
            db.session.commit()
            print("✅ Базовые алгоритмы успешно добавлены в таблицу neural_networks.")


# Вызываем функции инициализации (можно раскомментировать на один запуск)
# init_db()
# seed_neural_networks()

print("🔄 Проверка подключения к Google Earth Engine...")
init_earth_engine()


# ====================== API ENDPOINTS ======================
@app.route('/api/geotiff/bounds', methods=['POST'])
def geotiff_bounds():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        with rasterio.open(BytesIO(file.read())) as src:
            bounds = src.bounds
            if src.crs and src.crs.to_epsg() != 4326:
                left, bottom, right, top = transform_bounds(src.crs, 'EPSG:4326', *bounds)
            else:
                left, bottom, right, top = bounds

            return jsonify({
                "success": True,
                "coordinates": [
                    [bottom, left],
                    [top, left],
                    [top, right],
                    [bottom, right]
                ]
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


def workspace_item_to_dict(item):
    return {
        "id": item.id,
        "name": item.name,
        "type": item.type,
        "format": item.format,
        "dateAdded": item.date_added.isoformat() if item.date_added else None,
        "polygonCoords": item.polygon_coords,
        "visibleOnMap": item.visible_on_map,
        "layerId": item.layer_id,
        "associatedKml": item.associated_kml_id,
        "imageThumbnail": None,
        "children_ids": [child.id for child in item.children]  # ← добавлено
    }


@app.route("/api/satellite/search", methods=["POST"])
def search_satellite_images():
    if "user" not in session:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json()
    print("\n[BACKEND LOG] Получен запрос на /api/satellite/search")
    print(f"[BACKEND LOG] Данные запроса: {data}")

    kml_id = data.get("kml_id")
    date_start = data.get("date_start")
    date_end = data.get("date_end")
    max_cloud = float(data.get("max_cloud", 15.0))

    if not init_earth_engine():
        return jsonify({"error": "Ошибка авторизации в GEE"}), 500

    try:
        user_id = session["user"]["id"]
        kml_item = WorkspaceItem.query.filter_by(id=kml_id, user_id=user_id).first()

        if not kml_item:
            print(f"[BACKEND LOG] ❌ KML с ID {kml_id} не найден в БД для юзера {user_id}")
            return jsonify({"error": "Полигон не найден"}), 404

        coords = kml_item.polygon_coords
        print(f"[BACKEND LOG] Исходные координаты из БД (тип {type(coords)}): {coords}")

        if isinstance(coords, str):
            import json
            coords = json.loads(coords)

        if isinstance(coords, dict) and "coordinates" in coords:
            coords = coords["coordinates"]
        elif isinstance(coords, dict) and "geometry" in coords and "coordinates" in coords["geometry"]:
            coords = coords["geometry"]["coordinates"]

        print(f"[BACKEND LOG] Спарсенные координаты для полигона GEE: {coords}")

        if len(coords) == 1 and isinstance(coords[0], list) and isinstance(coords[0][0], list):
            roi = ee.Geometry.Polygon(coords)
        else:
            roi = ee.Geometry.Polygon([coords])

        # Проверяем, что GEE видит геометрию нормально
        print(f"[BACKEND LOG] Центр полигона GEE: {roi.centroid().coordinates().getInfo()}")

        collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
            .filterBounds(roi) \
            .filterDate(date_start, date_end) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', max_cloud)) \
            .sort('CLOUDY_PIXEL_PERCENTAGE')

        image_list = collection.limit(12).getInfo()
        features = image_list.get('features', [])

        print(f"[BACKEND LOG] GEE нашел снимков: {len(features)}")

        found_images = []
        for feat in features:
            props = feat.get('properties', {})
            space_id = feat.get('id')
            time_start = props.get('system:time_start')
            acq_date = datetime.fromtimestamp(time_start / 1000.0).strftime('%Y-%m-%d') if time_start else "Неизвестно"
            cloud_pct = round(props.get('CLOUDY_PIXEL_PERCENTAGE', 0), 1)

            ee_image = ee.Image(space_id)
            thumb_url = ee_image.visualize(bands=['B4', 'B3', 'B2'], min=0, max=3000).getThumbURL({
                'region': roi, 'dimensions': 256, 'format': 'png'
            })

            found_images.append({
                "satellite_space_id": space_id,
                "acquisition_date": acq_date,
                "cloud_percentage": cloud_pct,
                "thumbnail_url": thumb_url
            })

        return jsonify({"success": True, "count": len(found_images), "images": found_images})

    except Exception as e:
        print(f"[BACKEND LOG] 💥 КРИТИЧЕСКАЯ ОШИБКА НА СЕРВЕРЕ: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/workspace", methods=["GET", "POST"])
def workspace():
    if "user" not in session:
        return jsonify({"error": "Not logged in"}), 401
    if session["user"]["role"] == "guest":
        return jsonify({"error": "Гости не могут сохранять данные"}), 403

    user_id = session["user"]["id"]

    if request.method == "GET":
        try:
            # 1. Загружаем ВСЕ элементы пользователя для построения связей
            all_items = WorkspaceItem.query.filter_by(user_id=user_id).all()

            # 2. Выделяем ID спутников, у которых есть родительский KML
            # (чтобы убрать их из верхнего уровня таблицы)
            automatically_downloaded_satellite_ids = {
                item.id for item in all_items
                if item.type == "satellite" and item.associated_kml_id is not None
            }

            # 3. Фильтруем элементы для выдачи в основной список таблицы:
            filtered_items = []
            for item in all_items:
                # Если это автоматически скачанный спутник под KML, пропускаем его (он отобразится внутри KML)
                if item.id in automatically_downloaded_satellite_ids:
                    continue

                # Во всех остальных случаях добавляем объект в список:
                # - Сюда попадут KML/полигоны (type == 'polygon')
                # - Сюда попадут Аэрофотоснимки (type == 'aero')
                # - И сюда попадут спутники (type == 'satellite'), загруженные пользователем вручную (associated_kml_id == None)
                filtered_items.append(item)

            # 4. Возвращаем данные строго в исходном CamelCase формате, ожидаемом фронтендом
            return jsonify({
                "success": True,
                "data": [workspace_item_to_dict(i) for i in filtered_items]
            })

        except Exception as e:
            return jsonify({"error": f"Ошибка сервера при получении данных: {str(e)}"}), 500

    if request.method == "POST":
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data"}), 400

        name = data.get("name", "Без имени")
        item_type = data.get("type")
        item_format = data.get("format", "")
        coords = data.get("polygonCoords")
        visible = data.get("visibleOnMap", True)
        layer_id = data.get("layerId", None)
        associated_kml = data.get("associatedKml", None)
        parent_id = data.get("parent_id")

        if item_type not in ("polygon", "satellite", "aero"):
            return jsonify({"error": "Invalid type"}), 400

        new_item = WorkspaceItem(
            user_id=user_id,
            name=name,
            type=item_type,
            format=item_format,
            polygon_coords=coords,
            visible_on_map=visible,
            layer_id=layer_id,
            associated_kml_id=associated_kml
        )
        db.session.add(new_item)
        db.session.flush()

        if parent_id:
            parent = WorkspaceItem.query.get(parent_id)
            if parent and parent.user_id == user_id:
                parent.children.append(new_item)

        db.session.commit()

        return jsonify({
            "success": True,
            "data": workspace_item_to_dict(new_item)
        }), 201


@app.route("/api/satellite/confirm", methods=["POST"])
def confirm_satellite_download():
    if "user" not in session:
        return jsonify({"error": "Пользователь не авторизован"}), 401

    data = request.get_json()
    if not data:
        return jsonify({"error": "Нет данных"}), 400

    kml_id = data.get("kml_id")
    selected_images = data.get("images", [])  # Ожидаем массив объектов с данными снимков

    if not kml_id or not selected_images:
        return jsonify({"error": "Не переданы KML или список выбранных снимков"}), 400

    user_id = session["user"]["id"]
    kml_item = WorkspaceItem.query.filter_by(id=kml_id, user_id=user_id).first()

    if not kml_item:
        return jsonify({"error": "Родительский KML-полигон не найден"}), 404

    saved_count = 0
    duplicate_count = 0

    try:
        for img in selected_images:
            space_id = img.get("satellite_space_id")
            acq_date_str = img.get("acquisition_date")

            if not space_id:
                continue

            # Тот самый составной ключ для защиты от дубликатов в рамках одного KML
            unique_space_id = f"{space_id}__kml_{kml_id}"

            # Проверяем, не скачивали ли мы уже этот снимок для этого полигона
            existing = WorkspaceItem.query.filter_by(satellite_space_id=unique_space_id).first()
            if existing:
                duplicate_count += 1
                continue

            # Конвертируем строку даты в объект datetime для MySQL
            acq_date = None
            if acq_date_str and acq_date_str != "Неизвестно":
                try:
                    acq_date = datetime.strptime(acq_date_str, "%Y-%m-%d")
                except ValueError:
                    pass

            # Создаем новую запись.
            # Обрати внимание: physical source_file пока пустой, так как физически TIF мы не качаем,
            # мы будем использовать мощности Google (gee_ref) для работы с ним в облаке!
            new_sat = WorkspaceItem(
                user_id=user_id,
                name=f"Снимок Sentinel-2 ({acq_date_str})",
                type="satellite",
                format="gee_ref",  # Спец. формат, указывающий алгоритмам, что это виртуальный снимок в GEE
                date_added=datetime.utcnow(),
                associated_kml_id=kml_item.id,  # ПРИВЯЗЫВАЕМ К РОДИТЕЛЮ
                satellite_space_id=unique_space_id,
                acquisition_date=acq_date,
                visible_on_map=False  # По умолчанию скрыт на карте, чтобы не перегружать интерфейс
            )

            db.session.add(new_sat)
            saved_count += 1

        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Успешно привязано снимков: {saved_count}. Пропущено дубликатов: {duplicate_count}.",
            "saved_count": saved_count
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Ошибка при сохранении снимков: {str(e)}"}), 500


@app.route("/api/workspace/<int:item_id>", methods=["PUT", "DELETE"])
def workspace_item(item_id):
    if "user" not in session:
        return jsonify({"error": "Not logged in"}), 401
    if session["user"]["role"] == "guest":
        return jsonify({"error": "Гости не могут изменять данные"}), 403

    user_id = session["user"]["id"]
    item = WorkspaceItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({"error": "Объект не найден или нет прав"}), 404

    if request.method == "DELETE":
        db.session.delete(item)
        db.session.commit()
        return jsonify({"success": True})

    if request.method == "PUT":
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data"}), 400

        if "name" in data:
            item.name = data["name"]
        if "polygonCoords" in data:
            item.polygon_coords = data["polygonCoords"]
        if "visibleOnMap" in data:
            item.visible_on_map = data["visibleOnMap"]
        if "layerId" in data:
            item.layer_id = data["layerId"]
        if "associatedKml" in data:
            item.associated_kml_id = data["associatedKml"]

        db.session.commit()
        return jsonify({
            "success": True,
            "data": workspace_item_to_dict(item)
        })


# ========== НОВЫЙ ЭНДПОИНТ СВЯЗЕЙ ==========
@app.route("/api/workspace/<int:parent_id>/link/<int:child_id>", methods=["POST", "DELETE"])
def link_items(parent_id, child_id):
    if "user" not in session or session["user"]["role"] == "guest":
        return jsonify({"error": "Not allowed"}), 403

    parent = WorkspaceItem.query.get(parent_id)
    child = WorkspaceItem.query.get(child_id)
    if not parent or not child:
        return jsonify({"error": "Item not found"}), 404

    if request.method == "POST":
        if child not in parent.children:
            parent.children.append(child)
            db.session.commit()
        return jsonify({"success": True})

    # DELETE
    if child in parent.children:
        parent.children.remove(child)
        db.session.commit()
    return jsonify({"success": True})


@app.route("/api/analysis/launch", methods=["POST"])
def launch_analysis():
    if "user_id" not in session:
        return jsonify({"error": "Пользователь не авторизован"}), 401

    data = request.get_json() or {}

    # 1. Считываем параметры из запроса фронтенда
    input_item_id = data.get("input_item_id")  # ID полигона или загруженного файла из workspace_items
    model_code = data.get("model_code")  # 'gee_satellite_index' или 'pytorch_tree_unet'
    ui_params = data.get("params", {})  # Специфичные настройки из модалки (даты, облачность и т.д.)

    # 2. Проверяем, существует ли исходный объект в рабочей области пользователя
    input_item = WorkspaceItem.query.filter_by(id=input_item_id, user_id=session["user_id"]).first()
    if not input_item:
        return jsonify({"error": "Исходный объект для анализа не найден в вашей рабочей области"}), 404

    # 3. Ищем выбранный алгоритм в базе
    algo = NeuralNetwork.query.filter_by(code_name=model_code, is_active=True).first()
    if not algo:
        return jsonify({"error": f"Алгоритм '{model_code}' не найден или деактивирован"}), 400

    try:
        # 4. Создаем запись об анализе в состоянии 'pending'
        # Сюда мы сохраняем все конфигурации, которые ты закладывал в модель Analysis
        new_analysis = Analysis(
            user_id=session["user_id"],
            neural_network_id=algo.id,
            item_name=f"Анализ: {input_item.name} ({algo.name})",
            status="pending",
            has_polygon=(input_item.type == "polygon"),
            result_view_type=algo.type,
            snapshot_dates=ui_params.get("dates", []),  # Сохраняем переданные даты, если есть
            algorithm_data={"ui_configured_parameters": ui_params}  # Сохраняем сырые параметры в JSON на будущее
        )

        db.session.add(new_analysis)
        db.session.commit()

        # На следующем этапе здесь появится вызов фонового скрипта!
        # Решение тяжелых задач будет запускаться тут, не подвешивая Flask.

        return jsonify({
            "success": True,
            "message": "Задача на анализ успешно создана и добавлена в очередь",
            "analysis_id": new_analysis.id,
            "status": new_analysis.status
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Ошибка при создании задачи: {str(e)}"}), 500


# ====================== ROUTES (HTML) ======================
@app.route("/login", methods=["GET", "POST"])
def login():
    # без изменений
    if request.method == "POST":
        mode = request.form.get("mode")
        if mode == "guest":
            session["user"] = {"name": "Гость", "role": "guest"}
            flash("Вы вошли как гость", "success")
            return redirect(url_for("index"))

        email = request.form.get("email")
        password = request.form.get("password")
        if not email or not password:
            flash("Заполните email и пароль", "danger")
            return redirect(url_for("login"))

        if mode == "register":
            surname = request.form.get("surname", "").strip()
            name = request.form.get("name", "").strip()
            patronymic = request.form.get("patronymic", "").strip()
            if not surname or not name:
                flash("Фамилия и имя обязательны", "danger")
                return redirect(url_for("login"))

            existing_user = User.query.filter_by(email=email).first()
            if existing_user:
                flash("Пользователь с таким email уже существует", "danger")
                return redirect(url_for("login"))

            hashed_password = generate_password_hash(password)
            new_user = User(
                surname=surname,
                name=name,
                patronymic=patronymic,
                email=email,
                password_hash=hashed_password,
                role="user",
                registration_date=datetime.utcnow().date()
            )
            db.session.add(new_user)
            db.session.commit()

            session["user"] = {
                "id": new_user.id,
                "name": f"{surname} {name}",
                "role": new_user.role,
                "email": new_user.email
            }
            flash("Регистрация прошла успешно! Добро пожаловать.", "success")
            return redirect(url_for("index"))

        if mode == "login":
            user = User.query.filter_by(email=email).first()
            if user and check_password_hash(user.password_hash, password):
                session["user"] = {
                    "id": user.id,
                    "name": f"{user.surname} {user.name}",
                    "role": user.role,
                    "email": user.email
                }
                flash("Вход выполнен", "success")
                return redirect(url_for("index"))
            else:
                flash("Неверный email или пароль", "danger")
                return redirect(url_for("login"))

    return render_template("login.html")


@app.route("/")
def index():
    if "user" not in session:
        return redirect(url_for("login"))
    return render_template("index.html")


@app.route("/analyzer")
def analyzer():
    if "user" not in session:
        flash("Сначала войдите в систему", "warning")
        return redirect(url_for("login"))
    return render_template("analyzer_alpine.html")


@app.route("/profile")
def profile():
    if "user" not in session:
        flash("Сначала войдите в систему", "warning")
        return redirect(url_for("login"))
    if session["user"]["role"] == "guest":
        flash("Гости не имеют доступа к профилю. Зарегистрируйтесь.", "warning")
        return redirect(url_for("login"))
    return render_template("profile.html")


@app.route("/logout")
def logout():
    session.pop("user", None)
    flash("Вы вышли из аккаунта", "info")
    return redirect(url_for("login"))


if __name__ == "__main__":
    app.run(port=5000, debug=True)
