from flask import Blueprint, jsonify, request
from services.ocsol_service import get_catalogue_ocsol, charger_ocsol_pour_commune
from models.commune import Commune
import os

ocsol_bp = Blueprint('ocsol', __name__)

@ocsol_bp.route('/catalogue', methods=['GET'])
def catalogue_ocsol():
    """Retourne le catalogue OCSOL disponible sur GeoSenegal."""
    return jsonify(get_catalogue_ocsol())

@ocsol_bp.route('/appliquer/<int:commune_id>', methods=['POST'])
def appliquer_ocsol(commune_id):
    """
    Applique un fichier OCSOL (déjà importé) à une commune.
    Body: {"fichier_path": "/chemin/vers/ocsol.shp", "annee": 2015}
    """
    commune = Commune.query.get_or_404(commune_id)
    if not commune.geom:
        return jsonify({'erreur': 'Géométrie de commune absente'}), 404

    data = request.get_json()
    fichier_path = data.get('fichier_path')
    annee = data.get('annee')

    if not fichier_path or not os.path.exists(fichier_path):
        return jsonify({'erreur': 'Fichier OCSOL introuvable. Téléchargez-le d\'abord depuis GeoSenegal.'}), 400

    resultat = charger_ocsol_pour_commune(commune.geom, fichier_path, annee)
    return jsonify(resultat)

@ocsol_bp.route('/upload/<int:commune_id>', methods=['POST'])
def upload_et_appliquer_ocsol(commune_id):
    """
    Upload direct d'un fichier OCSOL et application à la commune.
    Accepte un fichier GeoJSON ou SHP (zippé).
    """
    from flask import current_app
    import uuid

    commune = Commune.query.get_or_404(commune_id)
    if 'fichier' not in request.files:
        return jsonify({'erreur': 'Aucun fichier fourni'}), 400

    f = request.files['fichier']
    annee = request.form.get('annee', None)
    ext = f.filename.rsplit('.', 1)[-1].lower()

    upload_dir = current_app.config.get('UPLOAD_FOLDER', '/tmp')
    os.makedirs(upload_dir, exist_ok=True)
    nom_temp = f'ocsol_{uuid.uuid4().hex[:8]}.{ext}'
    chemin_temp = os.path.join(upload_dir, nom_temp)
    f.save(chemin_temp)

    if ext == 'zip':
        import zipfile
        with zipfile.ZipFile(chemin_temp, 'r') as z:
            z.extractall(os.path.dirname(chemin_temp))
        shp_files = [x for x in os.listdir(os.path.dirname(chemin_temp)) if x.endswith('.shp')]
        if shp_files:
            chemin_temp = os.path.join(os.path.dirname(chemin_temp), shp_files[0])
        else:
            return jsonify({'erreur': 'Aucun .shp trouvé dans le ZIP'}), 400

    resultat = charger_ocsol_pour_commune(commune.geom, chemin_temp, annee)
    return jsonify(resultat)
