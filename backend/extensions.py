# Point central pour toutes les extensions Flask
# Tous les models et services doivent importer db depuis ici
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
