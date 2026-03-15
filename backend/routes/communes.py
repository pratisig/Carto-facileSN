"""Routes admin 4 niveaux: régions / départements / arrondissements / communes."""
from flask import Blueprint, jsonify, request
from services.admin_shp_service import (
    get_regions,
    get_departements_par_region,
    get_arrondissements_par_departement,
    get_communes_par_departement,
    get_communes_par_arrondissement,
    get_toutes_communes,
    get_tous_arrondissements,
    get_commune,
    get_arrondissement,
    search_communes,
    search_arrondissements,
    _CACHE, _build_cache,
)

communes_bp = Blueprint('communes', __name__)


@communes_bp.route('/regions', methods=['GET'])
def api_regions():
    return jsonify(get_regions())


@communes_bp.route('/regions/<int:region_id>/departements', methods=['GET'])
def api_departements(region_id):
    return jsonify(get_departements_par_region(region_id))


@communes_bp.route('/departements/<int:dep_id>/arrondissements', methods=['GET'])
def api_arrondissements_dep(dep_id):
    return jsonify(get_arrondissements_par_departement(dep_id))


@communes_bp.route('/departements/<int:dep_id>/communes', methods=['GET'])
def api_communes_dep(dep_id):
    return jsonify(get_communes_par_departement(dep_id))


@communes_bp.route('/departements/<int:dep_id>/geom', methods=['GET'])
def api_dep_geom(dep_id):
    """Retourne un département avec sa géométrie pour affichage carte."""
    _build_cache()
    dep = next((d for d in _CACHE['departements'] if d['id'] == dep_id), None)
    if dep is None:
        return jsonify({'erreur': 'Département introuvable'}), 404
    return jsonify(dep)


@communes_bp.route('/arrondissements/<int:arr_id>/communes', methods=['GET'])
def api_communes_arr(arr_id):
    return jsonify(get_communes_par_arrondissement(arr_id))


@communes_bp.route('/arrondissements/<int:arr_id>/geom', methods=['GET'])
def api_arr_geom(arr_id):
    """Retourne un arrondissement avec sa géométrie pour affichage carte."""
    _build_cache()
    arr = next((a for a in _CACHE['arrondissements'] if a['id'] == arr_id), None)
    if arr is None:
        return jsonify({'erreur': 'Arrondissement introuvable'}), 404
    return jsonify(arr)


@communes_bp.route('/liste', methods=['GET'])
def api_toutes_communes():
    return jsonify(get_toutes_communes())


@communes_bp.route('/arrondissements', methods=['GET'])
def api_tous_arrondissements():
    return jsonify(get_tous_arrondissements())


@communes_bp.route('/search', methods=['GET'])
def api_search():
    q = request.args.get('q', '')
    return jsonify(search_communes(q))


@communes_bp.route('/arrondissements/search', methods=['GET'])
def api_search_arr():
    q = request.args.get('q', '')
    return jsonify(search_arrondissements(q))


@communes_bp.route('/<int:commune_id>', methods=['GET'])
def api_commune(commune_id):
    c = get_commune(commune_id)
    if c is None:
        return jsonify({'erreur': 'Commune introuvable'}), 404
    data = dict(c)
    _build_cache()
    dep = next((d for d in _CACHE['departements'] if d['id'] == c['departement_id']), None)
    if dep:
        data['departement_nom'] = dep['nom']
        reg = next((r for r in _CACHE['regions'] if r['id'] == dep['region_id']), None)
        data['region_nom'] = reg['nom'] if reg else ''
    if c.get('arrondissement_id'):
        arr = next((a for a in _CACHE['arrondissements'] if a['id'] == c['arrondissement_id']), None)
        data['arrondissement_nom'] = arr['nom'] if arr else ''
    return jsonify(data)


@communes_bp.route('/arrondissements/<int:arr_id>', methods=['GET'])
def api_arrondissement(arr_id):
    a = get_arrondissement(arr_id)
    if a is None:
        return jsonify({'erreur': 'Arrondissement introuvable'}), 404
    data = dict(a)
    _build_cache()
    dep = next((d for d in _CACHE['departements'] if d['id'] == a['departement_id']), None)
    if dep:
        data['departement_nom'] = dep['nom']
        reg = next((r for r in _CACHE['regions'] if r['id'] == dep['region_id']), None)
        data['region_nom'] = reg['nom'] if reg else ''
    return jsonify(data)
