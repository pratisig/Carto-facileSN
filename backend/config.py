import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'carto-facile-sn-dev-key')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'postgresql://user:password@localhost/cartofacile_db'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
    EXPORT_FOLDER = os.path.join(os.path.dirname(__file__), 'exports')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload
    ALLOWED_EXTENSIONS = {'geojson', 'kml', 'csv', 'shp', 'zip'}
    WAVE_API_KEY = os.environ.get('WAVE_API_KEY', '')
    WAVE_SECRET = os.environ.get('WAVE_SECRET', '')
