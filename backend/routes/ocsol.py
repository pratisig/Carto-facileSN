from flask import Blueprint, jsonify, request
from services.ocsol_service import get_catalogue_ocsol, appliquer_ocsol_local, traiter_upload_ocsol
from models.commune import Commune
import os

ocsol_bp = Blueprint('ocsol', __name__)


@ocsol_bp.route('/catalogue', methods=['GET'])
def catalogue_ocsol():
    return jsonify(get_catalogue_ocsol())


@ocsol_bp.route('/appliquer/<int:commune_id>', methods=['POST'])
def appliquer_ocsol(commune_id):
    """
    Applique un OCSOL déjà présent localement (data/ocsol_ANNEE.shp).
    Body: {"annee": 2015}
    """
    commune = Commune.query.get_or_404(commune_id)
    if not commune.geom:
        return jsonify({'erreur': 'Géométrie de commune absente'}), 404
    data = request.get_json() or {}
    annee = data.get('annee')
    if not annee:
        return jsonify({'erreur': 'Paramètre annee requis (ex: 2015)'}), 400
    resultat = appliquer_ocsol_local(annee, commune.geom)
    return jsonify(resultat)


@ocsol_bp.route('/upload/<int:commune_id>', methods=['POST'])
def upload_ocsol(commune_id):
    """
    Upload un fichier OCSOL (ZIP contenant SHP) et l'applique à la commune.
    Form-data: fichier=<file>, annee=2015
    """
    commune = Commune.query.get_or_404(commune_id)
    if not commune.geom:
        return jsonify({'erreur': 'Géométrie de commune absente'}), 404
    if 'fichier' not in request.files:
        return jsonify({'erreur': 'Aucun fichier fourni'}), 400
    f = request.files['fichier']
    annee = request.form.get('annee', 'inconnu')
    resultat = traiter_upload_ocsol(f, annee, commune.geom)
    return jsonify(resultat)
