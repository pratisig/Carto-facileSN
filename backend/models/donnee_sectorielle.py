from app import db
from datetime import datetime

class DonneeSectorielle(db.Model):
    """Couches thématiques : santé, éducation, eau, population, etc."""
    __tablename__ = 'donnees_sectorielles'
    id = db.Column(db.Integer, primary_key=True)
    commune_id = db.Column(db.Integer, db.ForeignKey('communes.id'), nullable=False)
    type_secteur = db.Column(db.String(50))  # sante | education | eau | route | population
    nom = db.Column(db.String(200))
    description = db.Column(db.Text)
    geom_point = db.Column(db.Text)  # GeoJSON Point
    geom_polygon = db.Column(db.Text)  # GeoJSON Polygon
    attributs = db.Column(db.JSON)  # ex: {"capacite": 200, "etat": "fonctionnel"}
    source = db.Column(db.String(200))
    annee_collecte = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'commune_id': self.commune_id,
            'type_secteur': self.type_secteur,
            'nom': self.nom,
            'geom_point': self.geom_point,
            'attributs': self.attributs,
            'source': self.source,
            'annee_collecte': self.annee_collecte
        }


class DonneeImportee(db.Model):
    """Données importées par l'utilisateur (CSV, GeoJSON, KoboCollect)"""
    __tablename__ = 'donnees_importees'
    id = db.Column(db.Integer, primary_key=True)
    utilisateur_id = db.Column(db.Integer, db.ForeignKey('utilisateurs.id'), nullable=True)
    carte_id = db.Column(db.Integer, db.ForeignKey('cartes.id'), nullable=True)
    nom_fichier = db.Column(db.String(200))
    format_source = db.Column(db.String(20))  # csv | geojson | kml | kobo
    geojson_converti = db.Column(db.Text)  # résultat normalisé
    nb_points = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'nom_fichier': self.nom_fichier,
            'format_source': self.format_source,
            'nb_points': self.nb_points,
            'created_at': self.created_at.isoformat()
        }
