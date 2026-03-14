from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app)
    db.init_app(app)

    from routes.communes import communes_bp
    from routes.cartes import cartes_bp
    from routes.exports import exports_bp
    from routes.donnees import donnees_bp
    from routes.utilisateurs import utilisateurs_bp

    app.register_blueprint(communes_bp, url_prefix='/api/communes')
    app.register_blueprint(cartes_bp, url_prefix='/api/cartes')
    app.register_blueprint(exports_bp, url_prefix='/api/exports')
    app.register_blueprint(donnees_bp, url_prefix='/api/donnees')
    app.register_blueprint(utilisateurs_bp, url_prefix='/api/utilisateurs')

    with app.app_context():
        db.create_all()

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)
