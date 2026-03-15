from flask import Blueprint, jsonify, request
from models.commune import Commune
from services.couche_service import (
    get_catalogue, charger_couche_pour_commune, charger_toutes_couches_commune
)
from services.geo_cache import (
    get_geojson_admin, get_geojson_thematique,
    COUCHES_ADMIN, COUCHES_THEMATIQUES
)

couches_bp = Blueprint('couches', __name__)


# ── Catalogue ────────────────────────────────────────────────────────────────

@couches_bp.route('/catalogue', methods=['GET'])
def catalogue():
    return jsonify(get_catalogue())


# ── GeoJSON admin complet (chargement unique côté React) ─────────────────────

@couches_bp.route('/admin/<string:niveau>', methods=['GET'])
def geojson_admin(niveau):
    """
    Retourne le GeoJSON complet d'un niveau administratif.
    Niveaux valides : regions | departements | arrondissements | communes
    Chargé UNE SEULE FOIS en mémoire grâce à lru_cache.

    GET /api/couches/admin/regions
    GET /api/couches/admin/departements
    GET /api/couches/admin/arrondissements
    GET /api/couches/admin/communes
    """
    if niveau not in COUCHES_ADMIN:
        return jsonify({
            'erreur': f'Niveau invalide. Valeurs acceptées: {list(COUCHES_ADMIN.keys())}'
        }), 400
    data = get_geojson_admin(niveau)
    resp = jsonify(data)
    resp.headers['Cache-Control'] = 'public, max-age=86400'
    return resp


# ── GeoJSON thématique complet ────────────────────────────────────────────────

@couches_bp.route('/thematique/<string:couche>', methods=['GET'])
def geojson_thematique(couche):
    """
    Retourne le GeoJSON complet d'une couche thématique.

    GET /api/couches/thematique/routes
    GET /api/couches/thematique/cours_eau
    """
    if couche not in COUCHES_THEMATIQUES:
        return jsonify({
            'erreur': f'Couche inconnue. Disponibles: {list(COUCHES_THEMATIQUES.keys())}'
        }), 400
    data = get_geojson_thematique(couche)
    resp = jsonify(data)
    resp.headers['Cache-Control'] = 'public, max-age=86400'
    return resp


# ── Legacy : couches filtrées par commune (conservé pour compatibilité) ───────

@couches_bp.route('/<int:commune_id>/<string:type_couche>', methods=['GET'])
def get_couche_commune(commune_id, type_couche):
    commune = Commune.query.get_or_404(commune_id)
    if not commune.geom:
        return jsonify({'erreur': 'Géométrie de commune non disponible'}), 404
    resultat = charger_couche_pour_commune(commune.geom, type_couche)
    return jsonify(resultat)


@couches_bp.route('/<int:commune_id>', methods=['POST'])
def get_couches_multiples(commune_id):
    commune = Commune.query.get_or_404(commune_id)
    if not commune.geom:
        return jsonify({'erreur': 'Géométrie non disponible'}), 404
    data = request.get_json() or {}
    types_couches = data.get('couches', ['routes', 'cours_eau', 'localites'])
    resultat = charger_toutes_couches_commune(commune.geom, types_couches)
    return jsonify(resultat)
