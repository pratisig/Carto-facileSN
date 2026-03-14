from app import db
from datetime import datetime

class Utilisateur(db.Model):
    __tablename__ = 'utilisateurs'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), unique=True, nullable=False)
    nom = db.Column(db.String(150))
    profil = db.Column(db.String(50))  # etudiant | chercheur | collectivite | ong | autre
    institution = db.Column(db.String(200))
    quota_gratuit = db.Column(db.Integer, default=3)  # exports gratuits/mois pour étudiants
    exports_ce_mois = db.Column(db.Integer, default=0)
    est_actif = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    cartes = db.relationship('Carte', backref='utilisateur', lazy=True)
    paiements = db.relationship('Paiement', backref='utilisateur', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'nom': self.nom,
            'profil': self.profil,
            'institution': self.institution,
            'quota_gratuit': self.quota_gratuit,
            'exports_ce_mois': self.exports_ce_mois
        }


class Paiement(db.Model):
    __tablename__ = 'paiements'
    id = db.Column(db.Integer, primary_key=True)
    utilisateur_id = db.Column(db.Integer, db.ForeignKey('utilisateurs.id'), nullable=True)
    carte_id = db.Column(db.Integer, db.ForeignKey('cartes.id'), nullable=False)
    montant = db.Column(db.Integer, default=2000)  # FCFA
    telephone = db.Column(db.String(20))  # numéro Wave
    wave_transaction_id = db.Column(db.String(200))
    statut = db.Column(db.String(20), default='en_attente')  # en_attente | success | echec
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'carte_id': self.carte_id,
            'montant': self.montant,
            'statut': self.statut,
            'wave_transaction_id': self.wave_transaction_id,
            'created_at': self.created_at.isoformat()
        }
