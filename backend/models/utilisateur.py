from extensions import db
from datetime import datetime


class Utilisateur(db.Model):
    __tablename__ = 'utilisateurs'
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(150))
    email = db.Column(db.String(200), unique=True)
    telephone = db.Column(db.String(20))
    mot_de_passe_hash = db.Column(db.String(256))
    profil = db.Column(db.String(30), default='standard')  # standard | etudiant | pro | admin
    quota_gratuit = db.Column(db.Integer, default=3)  # exports gratuits/mois
    exports_ce_mois = db.Column(db.Integer, default=0)
    actif = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'nom': self.nom,
            'email': self.email,
            'profil': self.profil,
            'quota_gratuit': self.quota_gratuit,
            'exports_ce_mois': self.exports_ce_mois
        }
