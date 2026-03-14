# Script de seed — Carto-facileSN

## Prérequis

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # remplir DATABASE_URL
```

## Lancer le seed

```bash
python scripts/seed_database.py
```

Le script exécute dans l'ordre :
1. **Régions** — depuis `LA_REGION_S.shp`
2. **Départements** — depuis `LA_DEPARTEMENT_S.shp`
3. **Communes** — depuis `LA_ARRONDISSEMENT_S.shp` (niveau commune)
4. **Données sectorielles** — aéroports, points d'eau, aires protégées, forêts, cultures, lieux d'intérêt
5. **Couches cartographiques brutes** — routes, cours d'eau, courbes de niveau, chemin de fer, etc.

## Couches disponibles dans `backend/data/`

| Préfixe SHP | Contenu | Type |
|---|---|---|
| `LA_REGION_S` | 14 régions | Polygone |
| `LA_DEPARTEMENT_S` | 45 départements | Polygone |
| `LA_ARRONDISSEMENT_S` | Communes | Polygone |
| `LA_LOCALITE_P` | Localités / villages | Point |
| `LA_FRONTIERE_INTERNATIONALE_FRONTIERE_ETAT_L` | Frontières | Ligne |
| `TR_SEGMENT_ROUTIER_L` | Réseau routier | Ligne |
| `TR_CHEMIN_FER_L` | Chemins de fer | Ligne |
| `TR_AEROPORT_P` | Aéroports | Point |
| `TR_SEGMENT_LIAISON_BAC_P` | Bacs fluviaux | Point |
| `HD_COURS_EAU_SIMPLE_L` | Cours d'eau | Ligne |
| `HD_REGION_HYDRIQUE_S` | Plans d'eau | Polygone |
| `BS_POINT_EAU_P` | Points d'eau (puits, forages) | Point |
| `BS_AGGLOMERATION_S` | Zones bâties | Polygone |
| `BS_REPERE_NAVIGATION_P` | Repères navigation | Point |
| `FO_COURBE_NIVEAU_L` | Courbes de niveau | Ligne |
| `FO_SABLE_S` | Zones sableuses | Polygone |
| `VE_SURFACE_BOISEE_S` | Forêts / savanes | Polygone |
| `VE_SURFACE_CULTIVEE_S` | Surfaces cultivées | Polygone |
| `LX_AIRE_PROTEGEE_S` | Aires protégées | Polygone |
| `LX_LIEU_INTERET_P` | Points d'intérêt | Point |

## Couches OCSOL (GeoSenegal)

Les données d'Occupation et Changement du Sol ne sont **pas incluses** dans le repo.
Elles doivent être téléchargées manuellement depuis :

> https://www.geosenegal.gouv.sn/-donnees-vectorielles-d-occupation-du-sol-.html

Une fois téléchargées, les utiliser via :
- `POST /api/ocsol/upload/{commune_id}` — upload direct depuis l'interface
- `GET /api/ocsol/catalogue` — consulter les années disponibles

## Nouvelles routes API ajoutées

| Méthode | Route | Description |
|---|---|---|
| GET | /api/couches/catalogue | Liste des couches SHP disponibles |
| GET | /api/couches/{commune_id}/{type} | GeoJSON filtré à la commune |
| POST | /api/couches/{commune_id} | Plusieurs couches simultanément |
| GET | /api/ocsol/catalogue | Catalogue OCSOL GeoSenegal |
| POST | /api/ocsol/upload/{commune_id} | Upload OCSOL + découpage commune |
| POST | /api/ocsol/appliquer/{commune_id} | OCSOL déjà stocké en local |
