"""Routes communes/départements/régions - 100% SHP, zéro base de données."""
from flask import Blueprint, jsonify
from services.admin_shp_service import (
    get_regions,
    get_departements_par_region,
    get_communes_par_departement,
    get_toutes_communes,
    get_commune,
    search_communes,
)
from flask import request

communes_bp = Blueprint('communes', __name__)


@communes_bp.route('/regions', methods=['GET'])
def api_regions():
    return jsonify(get_regions())


@communes_bp.route('/liste', methods=['GET'])
def api_toutes_communes():
    return jsonify(get_toutes_communes())


@communes_bp.route('/search', methods=['GET'])
def api_search():
    q = request.args.get('q', '')
    return jsonify(search_communes(q))


@communes_bp.route('/regions/<int:region_id>/departements', methods=['GET'])
def api_departements(region_id):
    deps = get_departements_par_region(region_id)
    return jsonify(deps)


@communes_bp.route('/departements/<int:dep_id>/communes', methods=['GET'])
def api_communes_dep(dep_id):
    return jsonify(get_communes_par_departement(dep_id))


@communes_bp.route('/<int:commune_id>', methods=['GET'])
def api_commune(commune_id):
    c = get_commune(commune_id)
    if c is None:
        return jsonify({'erreur': 'Commune introuvable'}), 404
    data = dict(c)  # inclut geom
    # Enrichir avec noms département et région
    from services.admin_shp_service import _CACHE, _build_cache
    _build_cache()
    dep = next((d for d in _CACHE['departements'] if d['id'] == c['departement_id']), None)
    if dep:
        data['departement_nom'] = dep['nom']
        reg = next((r for r in _CACHE['regions'] if r['id'] == dep['region_id']), None)
        data['region_nom'] = reg['nom'] if reg else ''
    return jsonify(data)
