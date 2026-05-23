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
from db_models import db, User, WorkspaceItem

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
    """Создать все таблицы заново (при необходимости)."""
    with app.app_context():
        db.create_all()
        print("✅ Таблицы созданы/обновлены.")


# # Раскомментируйте следующую строку, чтобы пересоздать таблицы при старте:
# with app.app_context():
#     db.create_all()

# ====================== API ENDPOINTS ======================

@app.route("/api/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(save_path)

    return jsonify({
        "success": True,
        "name": filename,
        "path": save_path,
        "date": filename[:10] if len(filename) >= 10 else "—"
    })


@app.route('/api/geotiff/bounds', methods=['POST'])
def geotiff_bounds():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        with rasterio.open(BytesIO(file.read())) as src:
            bounds = src.bounds  # left, bottom, right, top
            if src.crs and src.crs.to_epsg() != 4326:
                left, bottom, right, top = transform_bounds(src.crs, 'EPSG:4326', *bounds)
            else:
                left, bottom, right, top = bounds

            return jsonify({
                "success": True,
                "coordinates": [
                    [bottom, left],  # юго-запад
                    [top, left],     # северо-запад
                    [top, right],    # северо-восток
                    [bottom, right]  # юго-восток
                ]
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/polygon", methods=["POST"])
def save_polygon():
    data = request.get_json()
    if not data or "geojson" not in data:
        return jsonify({"error": "No geojson"}), 400

    # Пока сохраняем в сессию (позже можно в БД или Redis)
    session["current_polygon"] = data["geojson"]
    return jsonify({"success": True, "message": "Полигон сохранён"})


def workspace_item_to_dict(item):
    """Сериализует WorkspaceItem в словарь для JSON."""
    return {
        "id": item.id,
        "name": item.name,
        "type": item.type,
        "format": item.format,
        "dateAdded": item.date_added.isoformat() if item.date_added else None,
        "polygonCoords": item.polygon_coords,         # уже JSON
        "visibleOnMap": item.visible_on_map,
        "layerId": item.layer_id,
        "associatedKml": item.associated_kml_id,
        "imageThumbnail": None  # пока не храним
    }


@app.route("/api/workspace", methods=["GET", "POST"])
def workspace():
    # Гостю запрещено сохранять и загружать
    if "user" not in session:
        return jsonify({"error": "Not logged in"}), 401
    if session["user"]["role"] == "guest":
        return jsonify({"error": "Гости не могут сохранять данные"}), 403

    user_id = session["user"]["id"]

    # ---- GET ----
    if request.method == "GET":
        items = WorkspaceItem.query.filter_by(user_id=user_id).all()
        return jsonify({
            "success": True,
            "data": [workspace_item_to_dict(i) for i in items]
        })

    # ---- POST ----
    if request.method == "POST":
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data"}), 400

        name = data.get("name", "Без имени")
        item_type = data.get("type")
        item_format = data.get("format", "")
        coords = data.get("polygonCoords")   # массив [[lat,lng],...]
        visible = data.get("visibleOnMap", True)
        layer_id = data.get("layerId", None)
        associated_kml = data.get("associatedKml", None)

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
        db.session.commit()

        return jsonify({
            "success": True,
            "data": workspace_item_to_dict(new_item)
        }), 201


@app.route("/api/workspace/<int:item_id>", methods=["PUT", "DELETE"])
def workspace_item(item_id):
    """Обновить или удалить объект рабочей области."""
    if "user" not in session:
        return jsonify({"error": "Not logged in"}), 401
    if session["user"]["role"] == "guest":
        return jsonify({"error": "Гости не могут изменять данные"}), 403

    user_id = session["user"]["id"]
    item = WorkspaceItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({"error": "Объект не найден или нет прав"}), 404

    # ---- DELETE ----
    if request.method == "DELETE":
        db.session.delete(item)
        db.session.commit()
        return jsonify({"success": True})

    # ---- PUT ----
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


# ====================== ROUTES (HTML) ======================
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        mode = request.form.get("mode")

        # Гостевой вход
        if mode == "guest":
            session["user"] = {"name": "Гость", "role": "guest"}
            flash("Вы вошли как гость", "success")
            return redirect(url_for("index"))

        email = request.form.get("email")
        password = request.form.get("password")

        if not email or not password:
            flash("Заполните email и пароль", "danger")
            return redirect(url_for("login"))

        # Регистрация
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

        # Вход
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