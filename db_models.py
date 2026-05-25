from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


# Паталаха Арсений Сергеевич patalakha.ars$gmail.com 1234qwer
# Чепенко Маргарита - patalakha.chp$gmail.com 1234qwer5t
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    surname = db.Column(db.String(100), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    patronymic = db.Column(db.String(100), default='')
    email = db.Column(db.String(180), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='user')  # 'user', 'admin', 'guest'
    department = db.Column(db.String(255))
    registration_date = db.Column(db.Date)
    avatar = db.Column(db.LargeBinary)
    is_admin = db.Column(db.Boolean, default=False)
    is_approved = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    workspace_items = db.relationship('WorkspaceItem', backref='owner', lazy='dynamic')
    analyses = db.relationship('Analysis', backref='owner', lazy='dynamic')
    # Убрали связь с uploaded_files за ненадобностью


class NeuralNetwork(db.Model):
    __tablename__ = 'neural_networks'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    # Ключевое добавление: строковый id для вызова из кода бэкенда (например: 'tree_crown_unet' или 'gee_ndvi')
    code_name = db.Column(db.String(100), unique=True, nullable=True)
    short_desc = db.Column(db.Text)
    type = db.Column(db.String(50), nullable=False)  # 'multidate', 'satellite', 'aero'
    applicable_to = db.Column(db.String(255))
    detail = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class WorkspaceItem(db.Model):
    __tablename__ = 'workspace_items'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 'polygon', 'satellite', 'aero'
    format = db.Column(db.String(50))
    date_added = db.Column(db.DateTime, default=datetime.utcnow)
    source_file = db.Column(db.String(255))  # путь к физическому файлу на сервере
    polygon_coords = db.Column(db.JSON)  # GeoJSON координаты
    visible_on_map = db.Column(db.Boolean, default=True)
    layer_id = db.Column(db.String(100))
    associated_kml_id = db.Column(db.Integer, db.ForeignKey('workspace_items.id'))
    image_thumbnail = db.Column(db.LargeBinary)

    children = db.relationship(
        'WorkspaceItem',
        secondary='workspace_subitems',
        primaryjoin='WorkspaceItem.id == workspace_subitems.c.parent_id',
        secondaryjoin='WorkspaceItem.id == workspace_subitems.c.child_id',
        backref='parents'
    )


class WorkspaceSubItem(db.Model):
    __tablename__ = 'workspace_subitems'
    parent_id = db.Column(db.Integer, db.ForeignKey('workspace_items.id'), primary_key=True)
    child_id = db.Column(db.Integer, db.ForeignKey('workspace_items.id'), primary_key=True)


class Analysis(db.Model):
    __tablename__ = 'analyses'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    neural_network_id = db.Column(db.Integer, db.ForeignKey('neural_networks.id'))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    item_name = db.Column(db.String(255))

    # Ключевые добавления для отслеживания фоновых задач алгоритмов:
    status = db.Column(db.String(50),
                       default='pending')  # 'pending' (в очереди), 'running' (выполняется), 'completed' (готово), 'failed' (ошибка)
    error_message = db.Column(db.Text, nullable=True)  # Сюда пишем ошибку, если алгоритм упал

    has_polygon = db.Column(db.Boolean, default=False)
    result_view_type = db.Column(db.String(50))
    polygon_opacity = db.Column(db.Float, default=0.5)
    aero_overlay_opacity = db.Column(db.Float, default=0.6)
    snapshot_dates = db.Column(db.JSON)
    snapshot_index = db.Column(db.Integer, default=0)
    range_start = db.Column(db.Integer, default=0)
    range_end = db.Column(db.Integer, default=0)
    deep_analysis_enabled = db.Column(db.Boolean, default=False)
    algorithm_data = db.Column(db.JSON)  # Сюда можно сохранять числовые метрики (н-р, площадь, число деревьев)
    is_saved = db.Column(db.Boolean, default=False)

    # Связь Many-to-Many с результирующими масками/векторами, которые сгенерировал этот анализ
    items = db.relationship('WorkspaceItem', secondary='analysis_items', backref='analyses')


class AnalysisItem(db.Model):
    __tablename__ = 'analysis_items'
    analysis_id = db.Column(db.Integer, db.ForeignKey('analyses.id'), primary_key=True)
    workspace_item_id = db.Column(db.Integer, db.ForeignKey('workspace_items.id'), primary_key=True)