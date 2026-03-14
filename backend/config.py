import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'carto-facile-sn-dev-key')

    # Render fournit DATABASE_URL avec postgres:// mais SQLAlchemy veut postgresql://
    raw_db_url = os.environ.get('DATABASE_URL', 'sqlite:///cartofacile.db')
    if raw_db_url.startswith('postgres://'):
        raw_db_url = raw_db_url.replace('postgres://', 'postgresql://', 1)
    SQLALCHEMY_DATABASE_URI = raw_db_url

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
    EXPORT_FOLDER = os.path.join(os.path.dirname(__file__), 'exports')
    MAX_CONTENT_LENGTH = 32 * 1024 * 1024  # 32 MB
    ALLOWED_EXTENSIONS = {'geojson', 'kml', 'csv', 'shp', 'zip'}
    WAVE_API_KEY = os.environ.get('WAVE_API_KEY', '')
    WAVE_SECRET = os.environ.get('WAVE_SECRET', '')
