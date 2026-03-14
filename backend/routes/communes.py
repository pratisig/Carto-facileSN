from flask import Blueprint, jsonify, request
from models.commune import Region, Departement, Commune

communes_bp = Blueprint('communes', __name__)

@communes_bp.route('/regions', methods=['GET'])
def get_regions():
    """Liste toutes les régions du Sénégal"""
    regions = Region.query.order_by(Region.nom).all()
    return jsonify([r.to_dict() for r in regions])

@communes_bp.route('/regions/<int:region_id>/departements', methods=['GET'])
def get_departements(region_id):
    """Départements d'une région"""
    deps = Departement.query.filter_by(region_id=region_id).order_by(Departement.nom).all()
    return jsonify([d.to_dict() for d in deps])

@communes_bp.route('/departements/<int:dep_id>/communes', methods=['GET'])
def get_communes(dep_id):
    """Communes d'un département"""
    communes = Commune.query.filter_by(departement_id=dep_id).order_by(Commune.nom).all()
    return jsonify([c.to_dict() for c in communes])

@communes_bp.route('/<int:commune_id>', methods=['GET'])
def get_commune(commune_id):
    """Détail d'une commune avec géométrie GeoJSON"""
    commune = Commune.query.get_or_404(commune_id)
    data = commune.to_dict()
    data['geom'] = commune.geom  # retourne la géométrie GeoJSON
    return jsonify(data)

@communes_bp.route('/search', methods=['GET'])
def search_commune():
    """Recherche de commune par nom"""
    q = request.args.get('q', '')
    communes = Commune.query.filter(
        Commune.nom.ilike(f'%{q}%')
    ).limit(20).all()
    return jsonify([c.to_dict() for c in communes])
