from flask import Blueprint, jsonify, request
import os

admin_bp = Blueprint('admin', __name__)
ADMIN_KEY = os.environ.get('ADMIN_KEY', 'carto-admin-2026')


@admin_bp.route('/status', methods=['GET'])
def status():
    from models.commune import Region, Departement, Commune
    return jsonify({
        'regions': Region.query.count(),
        'departements': Departement.query.count(),
        'communes': Commune.query.count(),
    })


@admin_bp.route('/reseed', methods=['GET', 'POST'])
def reseed():
    key = request.headers.get('X-Admin-Key', '') or request.args.get('key', '')
    if key != ADMIN_KEY:
        return jsonify({'erreur': 'Non autorise'}), 403

    from extensions import db
    from models.commune import Region, Departement, Commune
    from flask import current_app
    import importlib, sys

    logs = []
    try:
        Commune.query.delete()
        Departement.query.delete()
        Region.query.delete()
        db.session.commit()
        logs.append('Tables videes OK')

        # Importer et relancer le seed
        if 'backend.scripts.seed_lite' in sys.modules:
            del sys.modules['backend.scripts.seed_lite']
        if 'scripts.seed_lite' in sys.modules:
            del sys.modules['scripts.seed_lite']

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
        import traceback
        return jsonify({'erreur': str(e), 'trace': traceback.format_exc(), 'logs': logs}), 500
