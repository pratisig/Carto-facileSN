from flask import Blueprint, jsonify, request, send_file
from app import db
from models.carte import Carte, Paiement
from services.export_service import exporter_png, exporter_pdf
from services.paiement_service import initier_paiement_wave, verifier_paiement_wave

exports_bp = Blueprint('exports', __name__)

@exports_bp.route('/initier', methods=['POST'])
def initier_export():
    """Initier le paiement Wave pour un export HD"""
    data = request.get_json()
    carte_id = data.get('carte_id')
    telephone = data.get('telephone')  # numéro Wave du payeur
    format_export = data.get('format', 'png')  # png ou pdf

    carte = Carte.query.get_or_404(carte_id)

    # Vérifier si quota gratuit disponible
    if data.get('utilisateur_id'):
        from models.utilisateur import Utilisateur
        user = Utilisateur.query.get(data['utilisateur_id'])
        if user and user.profil == 'etudiant' and user.exports_ce_mois < user.quota_gratuit:
            user.exports_ce_mois += 1
            db.session.commit()
            fichier = exporter_png(carte) if format_export == 'png' else exporter_pdf(carte)
            return jsonify({'statut': 'gratuit', 'fichier': fichier})

    paiement = Paiement(
        carte_id=carte_id,
        utilisateur_id=data.get('utilisateur_id'),
        telephone=telephone,
        montant=2000
    )
    db.session.add(paiement)
    db.session.commit()

    resultat_wave = initier_paiement_wave(telephone, 2000, paiement.id)
    paiement.wave_transaction_id = resultat_wave.get('transaction_id')
    db.session.commit()

    return jsonify({
        'paiement_id': paiement.id,
        'wave_checkout_url': resultat_wave.get('checkout_url'),
        'statut': 'en_attente'
    })

@exports_bp.route('/confirmer/<int:paiement_id>', methods=['POST'])
def confirmer_export(paiement_id):
    """Vérifier le paiement et déclencher l'export"""
    paiement = Paiement.query.get_or_404(paiement_id)
    data = request.get_json()
    format_export = data.get('format', 'png')

    statut = verifier_paiement_wave(paiement.wave_transaction_id)
    if statut == 'success':
        paiement.statut = 'success'
        db.session.commit()
        carte = Carte.query.get(paiement.carte_id)
        if format_export == 'pdf':
            fichier = exporter_pdf(carte)
            carte.fichier_pdf = fichier
        else:
            fichier = exporter_png(carte)
            carte.fichier_png = fichier
        carte.statut_export = 'exporte'
        db.session.commit()
        return jsonify({'statut': 'success', 'fichier': fichier})
    else:
        paiement.statut = 'echec'
        db.session.commit()
        return jsonify({'statut': 'echec'}), 402

@exports_bp.route('/telecharger/<int:carte_id>/<string:format>', methods=['GET'])
def telecharger(carte_id, format):
    """Télécharger le fichier exporté"""
    carte = Carte.query.get_or_404(carte_id)
    if format == 'pdf' and carte.fichier_pdf:
        return send_file(carte.fichier_pdf, as_attachment=True)
    elif format == 'png' and carte.fichier_png:
        return send_file(carte.fichier_png, as_attachment=True)
    return jsonify({'erreur': 'Fichier non disponible'}), 404
