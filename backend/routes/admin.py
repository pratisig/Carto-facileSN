from flask import Blueprint, jsonify, request
import os

admin_bp = Blueprint('admin', __name__)
ADMIN_KEY = os.environ.get('ADMIN_KEY', 'carto-admin-2026')


@admin_bp.route('/status', methods=['GET'])
def status():
    from models.commune import Region, Departement, Commune
    from models.donnee_sectorielle import DonneeSectorielle
    from models.carte import Carte
    return jsonify({
        'regions': Region.query.count(),
        'departements': Departement.query.count(),
        'communes': Commune.query.count(),
        'donnees_sectorielles': DonneeSectorielle.query.count(),
    })


@admin_bp.route('/reseed', methods=['GET', 'POST'])
def reseed():
    key = request.headers.get('X-Admin-Key', '') or request.args.get('key', '')
    if key != ADMIN_KEY:
        return jsonify({'erreur': 'Non autorise'}), 403

    from extensions import db
    from models.commune import Region, Departement, Commune
    from models.donnee_sectorielle import DonneeSectorielle
    from models.carte import Carte
    from flask import current_app
    import sys

    logs = []
    try:
        # Supprimer dans l'ordre des foreign keys
        Carte.query.delete();             db.session.flush(); logs.append('Cartes videes')
        DonneeSectorielle.query.delete(); db.session.flush(); logs.append('DonneesSect videes')
        Commune.query.delete();           db.session.flush(); logs.append('Communes videes')
        Departement.query.delete();       db.session.flush(); logs.append('Departements vides')
        Region.query.delete();            db.session.flush(); logs.append('Regions videes')
        db.session.commit()
        logs.append('Tables videes OK')

        # Recharger le module seed
        for k in list(sys.modules.keys()):
            if 'seed_lite' in k:
                del sys.modules[k]

        import scripts.seed_lite as seed_module
        app = current_app._get_current_object()

        rmap = seed_module.seed_regions(app, db, Region)
        dmap = seed_module.seed_departements(app, db, Departement, Region)
        cmap = seed_module.seed_communes(app, db, Commune, Departement)

        return jsonify({
            'statut': 'OK',
            'regions': len(rmap),
            'departements': len(dmap),
            'communes': len(cmap),
            'logs': logs
        })
    except Exception as e:
        db.session.rollback()
        import traceback
        return jsonify({'erreur': str(e), 'trace': traceback.format_exc(), 'logs': logs}), 500
