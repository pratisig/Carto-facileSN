from flask import Blueprint, jsonify, request
from models.commune import Commune
from services.couche_service import get_catalogue, charger_couche_pour_commune, charger_toutes_couches_commune

couches_bp = Blueprint('couches', __name__)

@couches_bp.route('/catalogue', methods=['GET'])
def catalogue():
    """Liste toutes les couches disponibles avec leur statut."""
    return jsonify(get_catalogue())

@couches_bp.route('/<int:commune_id>/<string:type_couche>', methods=['GET'])
def get_couche_commune(commune_id, type_couche):
    """
    Retourne les données GeoJSON d'une couche pour une commune spécifique.
    Ex: GET /api/couches/42/routes
    """
    commune = Commune.query.get_or_404(commune_id)
    if not commune.geom:
        return jsonify({'erreur': 'Géométrie de commune non disponible'}), 404
    tolerance = float(request.args.get('tolerance', 0.001))
    resultat = charger_couche_pour_commune(commune.geom, type_couche, tolerance)
    return jsonify(resultat)

@couches_bp.route('/<int:commune_id>', methods=['POST'])
def get_couches_multiples(commune_id):
    """
    Retourne plusieurs couches simultanément pour une commune.
    Body JSON: {"couches": ["routes", "cours_eau", "forets"]}
    """
    commune = Commune.query.get_or_404(commune_id)
    if not commune.geom:
        return jsonify({'erreur': 'Géométrie non disponible'}), 404
    data = request.get_json()
    types_couches = data.get('couches', ['routes', 'cours_eau', 'localites'])
    resultat = charger_toutes_couches_commune(commune.geom, types_couches)
    return jsonify(resultat)
