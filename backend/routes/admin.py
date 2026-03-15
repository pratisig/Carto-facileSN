"""Routes admin : diagnostic, reload cache, prechauffage."""
from flask import Blueprint, jsonify
from services.admin_shp_service import _lire_shp, _col, NOM_COLS, PCODE_COLS
import services.admin_shp_service as svc
import services.geo_cache as gc
import os

admin_bp = Blueprint('admin', __name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

NIVEAUX = [
    ('regions',         'SEN_Admin1'),
    ('departements',    'SEN_Admin2'),
    ('arrondissements', 'SEN_Admin3'),
    ('communes',        'SEN_Admin4'),
]


@admin_bp.route('/status', methods=['GET'])
def status():
    """Diagnostic complet : colonnes SHP, noms detectes, nb features."""
    result = {}
    for niveau, nom_shp in NIVEAUX:
        shp_path = os.path.join(DATA_DIR, f'{nom_shp}.shp')
        fields, records = _lire_shp(nom_shp)
        c_nom   = _col(fields or [], NOM_COLS)
        c_pcode = _col(fields or [], PCODE_COLS)
        # Exemples de noms depuis les 5 premiers enregistrements
        exemples = []
        for rec in (records or [])[:5]:
            v = rec['attrs'].get(c_nom, 'N/A') if c_nom else 'col_introuvable'
            exemples.append(str(v))
        # Premier feature GeoJSON en cache
        cache_data = svc._CACHE.get(niveau, [])
        ex_cache = {'nom': cache_data[0]['nom'], 'pcode': cache_data[0]['pcode']} if cache_data else {}
        result[niveau] = {
            'shp_existe':           os.path.exists(shp_path),
            'colonnes':             fields or [],
            'nb_enregistrements':   len(records or []),
            'colonne_nom_detectee': c_nom,
            'colonne_pcode':        c_pcode,
            'exemples_bruts':       exemples,
            'exemple_cache':        ex_cache,
            'nb_cache':             len(cache_data),
        }
    return jsonify({'statut': 'ok', 'donnees': result})


@admin_bp.route('/reload', methods=['GET', 'POST'])
def reload_cache():
    """Vide et recharge completement le cache admin + geo."""
    try:
        # Vider _CACHE admin_shp_service
        svc._CACHE.clear()
        svc._build_cache()
        # Vider lru_cache de geo_cache
        gc.get_geojson_admin.cache_clear()
        gc.get_geojson_thematique.cache_clear()
        gc.prechauffer_cache()
        # Rapport
        rapport = {}
        for niveau in ['regions', 'departements', 'arrondissements', 'communes']:
            items = svc._CACHE.get(niveau, [])
            ex = items[0] if items else {}
            rapport[niveau] = {
                'nb': len(items),
                'exemple_nom':   ex.get('nom',   'N/A'),
                'exemple_pcode': ex.get('pcode',  'N/A'),
            }
        return jsonify({'statut': 'ok', 'message': 'Cache recharge', 'rapport': rapport})
    except Exception as e:
        return jsonify({'statut': 'erreur', 'message': str(e)}), 500


@admin_bp.route('/prechauffer', methods=['GET', 'POST'])
def prechauffer():
    try:
        gc.prechauffer_cache()
        return jsonify({'statut': 'ok', 'message': 'Cache prechauffé'})
    except Exception as e:
        return jsonify({'statut': 'erreur', 'message': str(e)}), 500
