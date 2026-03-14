# Carto-facileSN — Backend Flask

## Structure

```
backend/
├── app.py                  # Point d'entrée Flask
├── config.py               # Configuration (BDD, Wave, uploads)
├── requirements.txt
├── .env.example
├── models/
│   ├── commune.py          # Region, Departement, Commune
│   ├── carte.py            # Carte, Paiement
│   ├── utilisateur.py      # Utilisateur
│   └── donnee_sectorielle.py  # DonneeSectorielle, DonneeImportee
├── routes/
│   ├── communes.py         # GET regions / departements / communes
│   ├── cartes.py           # CRUD cartes + preview
│   ├── exports.py          # Paiement Wave + export PNG/PDF
│   ├── donnees.py          # Import CSV/GeoJSON/KoboCollect
│   └── utilisateurs.py     # Inscription + historique
└── services/
    ├── carte_service.py    # Génération matplotlib
    ├── export_service.py   # Export PNG/PDF haute définition
    ├── import_service.py   # Conversion CSV/GeoJSON/KML
    ├── paiement_service.py # Wave Mobile Money API
    └── kobo_service.py     # KoboToolbox/ODK API
```

## Installation

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # remplir les variables
flask run
```

## Routes API principales

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/communes/regions | Liste des 14 régions |
| GET | /api/communes/regions/{id}/departements | Départements d'une région |
| GET | /api/communes/departements/{id}/communes | Communes d'un département |
| GET | /api/communes/{id} | Détail + géométrie GeoJSON |
| GET | /api/communes/search?q= | Recherche par nom |
| POST | /api/cartes/creer | Créer une nouvelle carte |
| GET | /api/cartes/{id}/preview | Preview base64 PNG |
| PUT | /api/cartes/{id} | Modifier une carte |
| POST | /api/exports/initier | Initier paiement Wave |
| POST | /api/exports/confirmer/{paiement_id} | Confirmer et exporter |
| GET | /api/exports/telecharger/{id}/{format} | Télécharger PNG ou PDF |
| GET | /api/donnees/sectorielles/{commune_id} | Couches thématiques |
| POST | /api/donnees/importer | Upload CSV/GeoJSON/KML |
| POST | /api/donnees/kobo | Import KoboCollect |
| POST | /api/utilisateurs/inscrire | Inscription utilisateur |
| GET | /api/utilisateurs/{id}/cartes | Historique des cartes |
