from flask import Blueprint, jsonify, request
from app import db
from models.donnee_sectorielle import DonneeSectorielle, DonneeImportee
from services.import_service import traiter_fichier_importe

donnees_bp = Blueprint('donnees', __name__)

@donnees_bp.route('/sectorielles/<int:commune_id>', methods=['GET'])
def get_donnees_sectorielles(commune_id):
    """Récupère les données sectorielles d'une commune (santé, éducation, eau...)"""
    secteur = request.args.get('secteur')  # filtre optionnel
    query = DonneeSectorielle.query.filter_by(commune_id=commune_id)
    if secteur:
        query = query.filter_by(type_secteur=secteur)
    donnees = query.all()
    return jsonify([d.to_dict() for d in donnees])

@donnees_bp.route('/importer', methods=['POST'])
def importer_donnees():
    """Importer un fichier CSV ou GeoJSON de points de terrain"""
    if 'fichier' not in request.files:
        return jsonify({'erreur': 'Aucun fichier fourni'}), 400

    fichier = request.files['fichier']
    format_source = request.form.get('format', 'geojson')  # csv | geojson | kml | kobo
    carte_id = request.form.get('carte_id')

    geojson_converti, nb_points = traiter_fichier_importe(fichier, format_source)

    donnee = DonneeImportee(
        carte_id=int(carte_id) if carte_id else None,
        nom_fichier=fichier.filename,
        format_source=format_source,
        geojson_converti=geojson_converti,
        nb_points=nb_points
    )
    db.session.add(donnee)
    db.session.commit()

    return jsonify({
        'id': donnee.id,
        'nb_points': nb_points,
        'geojson': geojson_converti
    }), 201

@donnees_bp.route('/kobo', methods=['POST'])
def import_kobo():
    """Import direct depuis KoboCollect via token API"""
    data = request.get_json()
    kobo_token = data.get('kobo_token')
    form_uid = data.get('form_uid')
    carte_id = data.get('carte_id')

    from services.kobo_service import recuperer_donnees_kobo
    geojson, nb_points = recuperer_donnees_kobo(kobo_token, form_uid)

    donnee = DonneeImportee(
        carte_id=carte_id,
        format_source='kobo',
        geojson_converti=geojson,
        nb_points=nb_points,
        nom_fichier=f'kobo_{form_uid}'
    )
    db.session.add(donnee)
    db.session.commit()
    return jsonify({'id': donnee.id, 'nb_points': nb_points, 'geojson': geojson}), 201
