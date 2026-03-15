from flask import Blueprint, jsonify
from services.admin_shp_service import _lire_shp, _col
from services.geo_cache import prechauffer_cache, get_geojson_admin
import os

admin_bp = Blueprint('admin', __name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

@admin_bp.route('/status', methods=['GET'])
def status():
    """Diagnostic complet : colonnes SHP + nb features."""
    result = {}
    for niveau, nom_shp in [
        ('regions','SEN_Admin1'), ('departements','SEN_Admin2'),
        ('arrondissements','SEN_Admin3'), ('communes','SEN_Admin4')
    ]:
        fields, records = _lire_shp(nom_shp)
        shp_path = os.path.join(DATA_DIR, f'{nom_shp}.shp')
        geojson  = get_geojson_admin(niveau)
        # echantillon de noms
        noms = []
        if records:
            c_nom = _col(fields or [], ['NOM','NAME','ADM1_FR','ADM2_FR','ADM3_FR','ADM4_FR',
                                        'ADM1_EN','ADM2_EN','ADM3_EN','ADM4_EN',
                                        'REGION','DEPARTEMEN','ARRONDISSE','COMMUNE'])
            for rec in records[:5]:
                val = rec['attrs'].get(c_nom, 'N/A') if c_nom else 'colonne_introuvable'
                noms.append(str(val))
        result[niveau] = {
            'shp_existe': os.path.exists(shp_path),
            'colonnes': fields or [],
            'nb_records': len(records),
            'nb_features_geojson': len(geojson.get('features', [])),
            'colonne_nom_detectee': _col(fields or [],
                ['NOM','NAME','ADM1_FR','ADM2_FR','ADM3_FR','ADM4_FR',
                 'ADM1_EN','ADM2_EN','ADM3_EN','ADM4_EN',
                 'REGION','DEPARTEMEN','ARRONDISSE','COMMUNE']),
            'exemples_noms': noms,
            'exemple_premiere_feature': geojson['features'][0]['properties'] if geojson.get('features') else {}
        }
    return jsonify({'statut': 'ok', 'data': result})

@admin_bp.route('/prechauffer', methods=['POST'])
def prechauffer():
    try:
        prechauffer_cache()
        return jsonify({'statut': 'ok', 'message': 'Cache prechauffé'})
    except Exception as e:
        return jsonify({'statut': 'erreur', 'message': str(e)}), 500
