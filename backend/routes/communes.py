from flask import Blueprint, jsonify, request
from models.commune import Region, Departement, Commune
from extensions import db

communes_bp = Blueprint('communes', __name__)


@communes_bp.route('/regions', methods=['GET'])
def get_regions():
    regions = Region.query.order_by(Region.nom).all()
    return jsonify([r.to_dict() for r in regions])


@communes_bp.route('/liste', methods=['GET'])
def get_toutes_communes():
    """Toutes les communes (sans geometrie pour performance)."""
    communes = Commune.query.order_by(Commune.nom).all()
    return jsonify([c.to_dict() for c in communes])


@communes_bp.route('/search', methods=['GET'])
def search_commune():
    q = request.args.get('q', '')
    communes = Commune.query.filter(Commune.nom.ilike(f'%{q}%')).limit(20).all()
    return jsonify([c.to_dict() for c in communes])


@communes_bp.route('/regions/<int:region_id>/departements', methods=['GET'])
def get_departements(region_id):
    deps = Departement.query.filter_by(region_id=region_id).order_by(Departement.nom).all()
    return jsonify([d.to_dict() for d in deps])


@communes_bp.route('/departements/<int:dep_id>/communes', methods=['GET'])
def get_communes_dep(dep_id):
    communes = Commune.query.filter_by(departement_id=dep_id).order_by(Commune.nom).all()
    return jsonify([c.to_dict() for c in communes])


@communes_bp.route('/<int:commune_id>', methods=['GET'])
def get_commune(commune_id):
    commune = Commune.query.get_or_404(commune_id)
    data = commune.to_dict()
    data['geom'] = commune.geom
    # Enrichir avec departement et region
    try:
        dep = Departement.query.get(commune.departement_id)
        if dep:
            data['departement_nom'] = dep.nom
            reg = Region.query.get(dep.region_id)
            data['region_nom'] = reg.nom if reg else None
    except Exception:
        pass
    return jsonify(data)
