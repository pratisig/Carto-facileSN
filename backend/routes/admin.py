from flask import Blueprint, jsonify, request
import os

admin_bp = Blueprint('admin', __name__)

ADMIN_KEY = os.environ.get('ADMIN_KEY', 'carto-admin-2026')


@admin_bp.route('/status', methods=['GET'])
def status():
    """Retourne le nombre d'entites en base."""
    from models.commune import Region, Departement, Commune
    return jsonify({
        'regions': Region.query.count(),
        'departements': Departement.query.count(),
        'communes': Commune.query.count(),
    })


@admin_bp.route('/reseed', methods=['POST'])
def reseed():
    """Vide et reseede la base. Protege par ADMIN_KEY."""
    key = request.headers.get('X-Admin-Key', '') or request.args.get('key', '')
    if key != ADMIN_KEY:
        return jsonify({'erreur': 'Non autorise'}), 403

    from extensions import db
    from models.commune import Region, Departement, Commune
    import sys
    import io

    logs = []
    try:
        # Vider les tables dans l'ordre
        Commune.query.delete()
        Departement.query.delete()
        Region.query.delete()
        db.session.commit()
        logs.append('Tables videes OK')

        # Capturer les prints du seed
        import backend.scripts.seed_lite as seed_module
        import importlib
        importlib.reload(seed_module)

        from flask import current_app
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
        return jsonify({'erreur': str(e), 'logs': logs}), 500
