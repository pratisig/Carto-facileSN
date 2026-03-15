from flask import Flask, jsonify
from flask_cors import CORS
from extensions import db
from config import Config


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS ouvert pour tous les origines (frontend Netlify/Vercel)
    CORS(app, resources={r"/api/*": {"origins": "*"}},
         supports_credentials=False)

    db.init_app(app)

    with app.app_context():
        from models import commune, carte, donnee_sectorielle, utilisateur

        from routes.communes import communes_bp
        from routes.cartes import cartes_bp
        from routes.exports import exports_bp
        from routes.donnees import donnees_bp
        from routes.utilisateurs import utilisateurs_bp
        from routes.couches import couches_bp
        from routes.ocsol import ocsol_bp

        app.register_blueprint(communes_bp,     url_prefix='/api/communes')
        app.register_blueprint(cartes_bp,       url_prefix='/api/cartes')
        app.register_blueprint(exports_bp,      url_prefix='/api/exports')
        app.register_blueprint(donnees_bp,      url_prefix='/api/donnees')
        app.register_blueprint(utilisateurs_bp, url_prefix='/api/utilisateurs')
        app.register_blueprint(couches_bp,      url_prefix='/api/couches')
        app.register_blueprint(ocsol_bp,        url_prefix='/api/ocsol')

        db.create_all()

    @app.route('/')
    def index():
        return jsonify({
            'app': 'Carto-facileSN API',
            'version': '1.0',
            'statut': 'live',
            'endpoints': {
                'regions':  '/api/communes/regions',
                'communes': '/api/communes/liste',
                'couches':  '/api/couches/catalogue',
                'ocsol':    '/api/ocsol/catalogue',
                'cartes':   '/api/cartes/',
                'exports':  '/api/exports/',
            }
        })

    @app.route('/health')
    def health():
        return jsonify({'statut': 'ok'})

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
