import os


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'bio_gis_super_secret_key_change_in_production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'mysql+pymysql://biogis_user:w1234@127.0.0.1/biogis'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = 'uploads'
    RESULTS_FOLDER = 'results'