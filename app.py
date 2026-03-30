import os
os.environ.setdefault("SOLARA_APP", "pages.dashboard")

from flask import Flask, render_template, redirect, url_for, request, session, flash
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
import solara.server.flask

app = Flask(__name__)
CORS(app)

# ================== НАСТРОЙКИ ==================
app.secret_key = "bio_gis_super_secret_key_change_in_production"  # поменяй потом на случайный длинный
app.config["UPLOAD_FOLDER"] = "uploads"
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

# ================== СОЗДАЁМ SOLARA BLUEPRINT ==================
solara_blueprint = solara.server.flask.blueprint
app.register_blueprint(solara_blueprint, url_prefix="/solara")

# ================== СУЩЕСТВУЮЩИЕ API ==================
@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return {"error": "No file"}, 400
    file = request.files["file"]
    date_str = request.form.get("date", "")
    filename = secure_filename(file.filename)
    path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(path)
    return {
        "name": filename,
        "path": path,
        "date": date_str or filename[:10]
    }


@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    polygon = data.get("polygon")
    files = data.get("files", [])
    classes = data.get("classes", [])

    # Заглушка — здесь потом будет вызов твоей нейросети
    results = [{"file": f, "status": "ok", "area_ha": 12.34} for f in files]
    return {"results": results}


# ================== МАРШРУТЫ ==================

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        mode = request.form.get("mode")
        if mode == "guest":
            session["user"] = {"name": "Гость", "role": "guest"}
            flash("Вы вошли как гость", "success")
            return redirect(url_for("index"))
        elif mode == "login":
            # Пока простая заглушка
            email = request.form.get("email")
            session["user"] = {"name": email or "Пользователь", "role": "authenticated"}
            flash("Успешный вход", "success")
            return redirect(url_for("index"))
        elif mode == "register":
            # Заглушка регистрации
            session["user"] = {"name": "Новый пользователь", "role": "authenticated"}
            flash("Аккаунт создан (заглушка)", "success")
            return redirect(url_for("index"))

    return render_template("login.html")


@app.route("/")
def index():
    if "user" not in session:
        return redirect(url_for("login"))
    return render_template("index.html")


@app.route("/analyzer/")
def analyzer():
    if "user" not in session:
        flash("Сначала войдите в систему", "warning")
        return redirect(url_for("login"))
    return render_template("dashboard.html")  # обёртка для Solara


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