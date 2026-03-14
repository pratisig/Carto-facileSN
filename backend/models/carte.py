from extensions import db
from datetime import datetime


class Carte(db.Model):
    __tablename__ = 'cartes'
    id = db.Column(db.Integer, primary_key=True)
    commune_id = db.Column(db.Integer, db.ForeignKey('communes.id'), nullable=False)
    utilisateur_id = db.Column(db.Integer, db.ForeignKey('utilisateurs.id'), nullable=True)
    titre = db.Column(db.String(200))
    auteur = db.Column(db.String(150))
    source_donnees = db.Column(db.String(200), default='ANSD / OpenStreetMap')
    couleur_zone = db.Column(db.String(10), default='#e74c3c')
    afficher_routes = db.Column(db.Boolean, default=True)
    afficher_cours_eau = db.Column(db.Boolean, default=True)
    afficher_localites = db.Column(db.Boolean, default=True)
    couches_supplementaires = db.Column(db.JSON)
    donnees_import = db.Column(db.JSON)
    statut_export = db.Column(db.String(20), default='brouillon')
    fichier_png = db.Column(db.String(300))
    fichier_pdf = db.Column(db.String(300))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    paiements = db.relationship('Paiement', backref='carte', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'commune_id': self.commune_id,
            'titre': self.titre,
            'auteur': self.auteur,
            'source_donnees': self.source_donnees,
            'couleur_zone': self.couleur_zone,
            'statut_export': self.statut_export,
            'created_at': self.created_at.isoformat()
        }


class Paiement(db.Model):
    __tablename__ = 'paiements'
    id = db.Column(db.Integer, primary_key=True)
    carte_id = db.Column(db.Integer, db.ForeignKey('cartes.id'), nullable=False)
    utilisateur_id = db.Column(db.Integer, db.ForeignKey('utilisateurs.id'), nullable=True)
    telephone = db.Column(db.String(20))
    montant = db.Column(db.Integer, default=2000)
    statut = db.Column(db.String(20), default='en_attente')
    wave_transaction_id = db.Column(db.String(200))
    wave_checkout_url = db.Column(db.String(500))
    format_export = db.Column(db.String(10), default='png')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'carte_id': self.carte_id,
            'telephone': self.telephone,
            'montant': self.montant,
            'statut': self.statut,
            'wave_transaction_id': self.wave_transaction_id,
            'created_at': self.created_at.isoformat()
        }
