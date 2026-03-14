# 🗺️ Carto-facileSN

> **Cartographier le Sénégal avec professionnalisme — pour tous, depuis un navigateur.**

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-2.x-lightgrey.svg)](https://flask.palletsprojects.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Sénégal](https://img.shields.io/badge/Couverture-557%20communes-orange.svg)](#)

---

## 🎯 Vision

**Carto-facileSN** est une plateforme web open-source de cartographie automatique du Sénégal, pensée pour répondre aux besoins réels de quatre profils :

| Profil | Usage principal |
|--------|----------------|
| 🎓 Chercheurs | Cartes publiables, import de données, export vectoriel |
| 📚 Étudiants | Cartes académiques, atlas, tutoriels intégrés |
| 🏛️ Collectivités locales | Suivi d'infrastructures, rapports institutionnels |
| 🌍 Services de développement | Ciblage bénéficiaires, intégration KoboCollect, API REST |

---

## ✨ Fonctionnalités

### Cartographie de base
- ✅ 557 communes couvertes (tout le Sénégal)
- ✅ Génération automatique : Région → Département → Commune
- ✅ Couches : localités, routes, cours d'eau, limites administratives
- ✅ Double localisation : commune dans département + région

### Import & Export
- ✅ **Import CSV / GeoJSON / KML** — vos propres données de terrain
- ✅ **Export PNG HD** sans filigrane
- ✅ **Export PDF vectoriel** pour publications et rapports institutionnels
- ✅ **Export Shapefile** pour traitement SIG avancé
- ✅ Grille de coordonnées et projection affichée (WGS84 / UTM 28N)

### Couches thématiques
- ✅ Établissements de santé (MSAS)
- ✅ Établissements scolaires (MEN)
- ✅ Points d'eau et forages (PEPAM/DGPRE)
- ✅ Densité de population (RGPHAE 2013/2023)
- ✅ Zones agro-écologiques
- ✅ Pluviométrie moyenne (ANACIM)
- ✅ Risques climatiques et vulnérabilité

### Outils avancés
- ✅ **Atlas multi-communes** : générer un arrondissement/département entier
- ✅ **Mode annotation** : dessiner, étiqueter sur la carte
- ✅ **Mesures** : distance, surface, périmètre
- ✅ **API REST documentée** pour intégration externe
- ✅ **Connecteur KoboCollect / ODK / Survey123**
- ✅ **Espace collaboratif** : partage et co-édition de cartes
- ✅ **Mode hors-ligne partiel** : pré-chargement des données communales

### Accessibilité
- ✅ **Tarif académique** : quota gratuit sur email universitaire
- ✅ Paiement Wave Mobile Money
- ✅ Modèles de mise en page (mémoires, rapports institutionnels)
- ✅ Tutoriels pédagogiques intégrés
- ✅ Citation automatique dans les exports

---

## 🏗️ Architecture

```
Carto-facileSN/
├── backend/              # API Flask / Python
│   ├── app.py
│   ├── routes/
│   ├── services/
│   └── models/
├── frontend/             # Interface React
│   ├── src/
│   └── public/
├── data/                 # Données géospatiales SN
│   ├── administratif/
│   ├── thematique/
│   └── README.md
├── notebooks/            # Analyses et préparation des données
├── docs/                 # Documentation technique
├── tests/
└── docker-compose.yml
```

---

## 🚀 Installation rapide

```bash
# Cloner le repo
git clone https://github.com/pratisig/Carto-facileSN.git
cd Carto-facileSN

# Backend Python
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Lancer le serveur
python backend/app.py

# Frontend (dans un autre terminal)
cd frontend
npm install
npm start
```

Ou avec Docker :
```bash
docker-compose up --build
```

---

## 📡 API REST — Aperçu

```http
GET  /api/v1/communes                    # Liste toutes les communes
GET  /api/v1/communes/{code}             # Détails d'une commune
GET  /api/v1/communes/{code}/map         # Génère la carte (PNG/PDF)
POST /api/v1/communes/{code}/import      # Import données terrain
GET  /api/v1/regions                     # Liste les régions
GET  /api/v1/departements/{region}       # Départements par région
```

Documentation complète → [docs/api.md](docs/api.md)

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md).

```
git checkout -b feature/ma-fonctionnalite
git commit -m 'feat: description'
git push origin feature/ma-fonctionnalite
```

---

## 📄 Licence

MIT — voir [LICENSE](LICENSE)

---

*Développé avec ❤️ pour le Sénégal — Carto-facileSN, cartographier avec professionnalisme.*
