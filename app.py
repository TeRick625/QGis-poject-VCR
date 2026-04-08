import os
from pathlib import Path

from flask import Flask, render_template, redirect, url_for, request, session, flash, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

# ====================== CONFIG ======================
app = Flask(__name__)
CORS(app)

app.secret_key = "bio_gis_super_secret_key_change_in_production"
app.config["UPLOAD_FOLDER"] = "uploads"
app.config["RESULTS_FOLDER"] = "results"

# Создаём необходимые папки
Path(app.config["UPLOAD_FOLDER"]).mkdir(exist_ok=True)
Path(app.config["RESULTS_FOLDER"]).mkdir(exist_ok=True)
Path("results/masks").mkdir(exist_ok=True)


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


@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data"}), 400

    polygon = data.get("polygon")
    files = data.get("files", [])

    if not polygon or not files:
        return jsonify({"error": "Polygon and files are required"}), 400

    # Заглушка анализа (здесь позже будет вызов нейросети)
    results = {
        "status": "success",
        "message": "Анализ запущен",
        "files_processed": len(files),
        "mask_paths": [f"/results/masks/mask_{f['name']}.png" for f in files],
        "statistics": {
            "Лес": 142.3,
            "Вода": 38.7,
            "Гарь": 19.1,
            "Сельхоз": 67.4,
            "Дороги": 12.8,
            "Другое": 8.9
        }
    }

    return jsonify(results)


@app.route("/api/polygon", methods=["POST"])
def save_polygon():
    data = request.get_json()
    if not data or "geojson" not in data:
        return jsonify({"error": "No geojson"}), 400

    # Пока сохраняем в сессию (позже можно в БД или Redis)
    session["current_polygon"] = data["geojson"]
    return jsonify({"success": True, "message": "Полигон сохранён"})


# ====================== ROUTES (HTML) ======================

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        mode = request.form.get("mode")
        if mode == "guest":
            session["user"] = {"name": "Гость", "role": "guest"}
            flash("Вы вошли как гость", "success")
            return redirect(url_for("index"))
        elif mode in ["login", "register"]:
            session["user"] = {"name": "Пользователь", "role": "authenticated"}
            flash("Вход выполнен", "success")
            return redirect(url_for("index"))

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
    return render_template("analyzer.html")


@app.route("/profile")
def profile():
    if "user" not in session:
        flash("Сначала войдите в систему", "warning")
        return redirect(url_for("login"))
    return render_template("profile.html")


@app.route("/logout")
def logout():
    session.pop("user", None)
    flash("Вы вышли из аккаунта", "info")
    return redirect(url_for("login"))


if __name__ == "__main__":
    app.run(port=5000, debug=True)