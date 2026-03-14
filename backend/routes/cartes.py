from flask import Blueprint, jsonify, request
from app import db
from models.carte import Carte
from models.commune import Commune
from services.carte_service import generer_carte_preview

cartes_bp = Blueprint('cartes', __name__)

@cartes_bp.route('/creer', methods=['POST'])
def creer_carte():
    """Créer une nouvelle carte pour une commune"""
    data = request.get_json()
    commune_id = data.get('commune_id')
    if not commune_id:
        return jsonify({'erreur': 'commune_id requis'}), 400

    commune = Commune.query.get_or_404(commune_id)

    carte = Carte(
        commune_id=commune_id,
        titre=data.get('titre', f'Commune de {commune.nom}'),
        auteur=data.get('auteur', ''),
        source_donnees=data.get('source_donnees', 'ANSD / OpenStreetMap'),
        couleur_zone=data.get('couleur_zone', '#e74c3c'),
        afficher_routes=data.get('afficher_routes', True),
        afficher_cours_eau=data.get('afficher_cours_eau', True),
        afficher_localites=data.get('afficher_localites', True),
        couches_supplementaires=data.get('couches_supplementaires', []),
        donnees_import=data.get('donnees_import', [])
    )
    db.session.add(carte)
    db.session.commit()
    return jsonify(carte.to_dict()), 201

@cartes_bp.route('/<int:carte_id>', methods=['GET'])
def get_carte(carte_id):
    carte = Carte.query.get_or_404(carte_id)
    return jsonify(carte.to_dict())

@cartes_bp.route('/<int:carte_id>/preview', methods=['GET'])
def preview_carte(carte_id):
    """Génère une preview de la carte (PNG base64)"""
    carte = Carte.query.get_or_404(carte_id)
    image_b64 = generer_carte_preview(carte)
    return jsonify({'image_base64': image_b64})

@cartes_bp.route('/<int:carte_id>', methods=['PUT'])
def modifier_carte(carte_id):
    carte = Carte.query.get_or_404(carte_id)
    data = request.get_json()
    for champ in ['titre', 'auteur', 'source_donnees', 'couleur_zone',
                  'afficher_routes', 'afficher_cours_eau', 'afficher_localites',
                  'couches_supplementaires', 'donnees_import']:
        if champ in data:
            setattr(carte, champ, data[champ])
    db.session.commit()
    return jsonify(carte.to_dict())
