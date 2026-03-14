from app import db

class Region(db.Model):
    __tablename__ = 'regions'
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False, unique=True)
    code = db.Column(db.String(10), unique=True)
    geom = db.Column(db.Text)  # GeoJSON stocké en texte (ou utiliser PostGIS geometry)
    departements = db.relationship('Departement', backref='region', lazy=True)

    def to_dict(self):
        return {'id': self.id, 'nom': self.nom, 'code': self.code}


class Departement(db.Model):
    __tablename__ = 'departements'
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(10))
    region_id = db.Column(db.Integer, db.ForeignKey('regions.id'), nullable=False)
    geom = db.Column(db.Text)
    communes = db.relationship('Commune', backref='departement', lazy=True)

    def to_dict(self):
        return {'id': self.id, 'nom': self.nom, 'code': self.code, 'region_id': self.region_id}


class Commune(db.Model):
    __tablename__ = 'communes'
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(150), nullable=False)
    code = db.Column(db.String(15), unique=True)
    departement_id = db.Column(db.Integer, db.ForeignKey('departements.id'), nullable=False)
    population = db.Column(db.Integer)
    superficie_km2 = db.Column(db.Float)
    geom = db.Column(db.Text)  # GeoJSON
    cartes = db.relationship('Carte', backref='commune', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'nom': self.nom,
            'code': self.code,
            'departement_id': self.departement_id,
            'population': self.population,
            'superficie_km2': self.superficie_km2
        }
