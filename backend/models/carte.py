from app import db
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
    couches_supplementaires = db.Column(db.JSON)  # ex: [{"type": "sante", "visible": true}]
    donnees_import = db.Column(db.JSON)  # points importés par l'utilisateur
    statut_export = db.Column(db.String(20), default='brouillon')  # brouillon | paye | exporte
    fichier_png = db.Column(db.String(300))
    fichier_pdf = db.Column(db.String(300))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
