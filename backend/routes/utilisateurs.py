from flask import Blueprint, jsonify, request
from app import db
from models.utilisateur import Utilisateur

utilisateurs_bp = Blueprint('utilisateurs', __name__)

@utilisateurs_bp.route('/inscrire', methods=['POST'])
def inscrire():
    """Inscription d'un nouvel utilisateur (email suffit)"""
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'erreur': 'email requis'}), 400

    if Utilisateur.query.filter_by(email=email).first():
        return jsonify({'erreur': 'email déjà utilisé'}), 409

    quota = 3 if data.get('profil') == 'etudiant' else 0
    user = Utilisateur(
        email=email,
        nom=data.get('nom', ''),
        profil=data.get('profil', 'autre'),
        institution=data.get('institution', ''),
        quota_gratuit=quota
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201

@utilisateurs_bp.route('/<int:user_id>', methods=['GET'])
def get_utilisateur(user_id):
    user = Utilisateur.query.get_or_404(user_id)
    return jsonify(user.to_dict())

@utilisateurs_bp.route('/<int:user_id>/cartes', methods=['GET'])
def get_cartes_utilisateur(user_id):
    """Historique des cartes d'un utilisateur"""
    from models.carte import Carte
    cartes = Carte.query.filter_by(utilisateur_id=user_id).order_by(
        Carte.created_at.desc()
    ).all()
    return jsonify([c.to_dict() for c in cartes])
