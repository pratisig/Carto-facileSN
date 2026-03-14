#!/usr/bin/env python3
"""
Script de peuplement complet de la base de données Carto-facileSN.
Lit les SHP depuis backend/data/ et insère régions, départements,
arrondissements, communes, localités et couches thématiques.

Usage:
    cd backend
    python scripts/seed_database.py
"""

import os
import sys
import json
import geopandas as gpd
from shapely.geometry import mapping
from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app import create_app, db
from models.commune import Region, Departement, Commune
from models.donnee_sectorielle import DonneeSectorielle

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

# Mapping des préfixes SHP -> type de couche
SHP_LAYERS = {
    'LA_REGION_S':                    {'type': 'admin', 'niveau': 'region'},
    'LA_DEPARTEMENT_S':               {'type': 'admin', 'niveau': 'departement'},
    'LA_ARRONDISSEMENT_S':            {'type': 'admin', 'niveau': 'arrondissement'},
    'LA_LOCALITE_P':                  {'type': 'localite'},
    'LA_FRONTIERE_INTERNATIONALE_FRONTIERE_ETAT_L': {'type': 'frontiere'},
    'TR_SEGMENT_ROUTIER_L':           {'type': 'route'},
    'TR_CHEMIN_FER_L':                {'type': 'chemin_fer'},
    'TR_AEROPORT_P':                  {'type': 'transport', 'sous_type': 'aeroport'},
    'TR_SEGMENT_LIAISON_BAC_P':       {'type': 'transport', 'sous_type': 'bac'},
    'HD_COURS_EAU_SIMPLE_L':          {'type': 'eau', 'sous_type': 'cours_eau'},
    'HD_REGION_HYDRIQUE_S':           {'type': 'eau', 'sous_type': 'region_hydrique'},
    'BS_POINT_EAU_P':                 {'type': 'eau', 'sous_type': 'point_eau'},
    'BS_AGGLOMERATION_S':             {'type': 'bati', 'sous_type': 'agglomeration'},
    'BS_REPERE_NAVIGATION_P':         {'type': 'navigation'},
    'FO_COURBE_NIVEAU_L':             {'type': 'relief', 'sous_type': 'courbe_niveau'},
    'FO_SABLE_S':                     {'type': 'relief', 'sous_type': 'sable'},
    'VE_SURFACE_BOISEE_S':            {'type': 'vegetation', 'sous_type': 'foret'},
    'VE_SURFACE_CULTIVEE_S':          {'type': 'vegetation', 'sous_type': 'culture'},
    'LX_AIRE_PROTEGEE_S':             {'type': 'environnement', 'sous_type': 'aire_protegee'},
    'LX_LIEU_INTERET_P':              {'type': 'poi'},
    'TO_ENTITE_ANNOTATION_P':         {'type': 'annotation'},
    'TO_ENTITE_NOMMEE_P':             {'type': 'entite_nommee'},
}

def charger_shp(nom_base):
    """Charge un SHP depuis data/ et retourne un GeoDataFrame en WGS84."""
    chemin = os.path.join(DATA_DIR, f'{nom_base}.shp')
    if not os.path.exists(chemin):
        print(f'  [ABSENT] {nom_base}.shp')
        return None
    try:
        gdf = gpd.read_file(chemin)
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
        print(f'  [OK] {nom_base}.shp  -> {len(gdf)} entités')
        return gdf
    except Exception as e:
        print(f'  [ERREUR] {nom_base}: {e}')
        return None

def geom_to_json(geom):
    """Convertit une géométrie Shapely en string GeoJSON."""
    if geom is None or geom.is_empty:
        return None
    return json.dumps(mapping(geom))

# ─────────────────────────────────────────
# 1. Régions
# ─────────────────────────────────────────
def seed_regions(app):
    print('\n>>> Peuplement des régions...')
    gdf = charger_shp('LA_REGION_S')
    if gdf is None:
        return {}

    region_map = {}  # nom -> id
    col_nom = _detecter_colonne(gdf, ['NOM', 'REGION', 'NAME', 'nom', 'name'])
    col_code = _detecter_colonne(gdf, ['CODE', 'CODE_REG', 'code'])

    with app.app_context():
        for _, row in gdf.iterrows():
            nom = str(row.get(col_nom, '')).strip().title() if col_nom else f'Region_{_}'
            code = str(row.get(col_code, '')).strip() if col_code else None
            if not nom or nom == 'Nan':
                continue
            existing = Region.query.filter_by(nom=nom).first()
            if not existing:
                r = Region(nom=nom, code=code, geom=geom_to_json(row.geometry))
                db.session.add(r)
                db.session.flush()
                region_map[nom] = r.id
            else:
                region_map[nom] = existing.id
        db.session.commit()
        print(f'  -> {len(region_map)} régions')
    return region_map

# ─────────────────────────────────────────
# 2. Départements
# ─────────────────────────────────────────
def seed_departements(app, region_map):
    print('\n>>> Peuplement des départements...')
    gdf = charger_shp('LA_DEPARTEMENT_S')
    if gdf is None:
        return {}

    dep_map = {}
    col_nom = _detecter_colonne(gdf, ['NOM', 'DEPARTEMEN', 'NAME', 'nom'])
    col_code = _detecter_colonne(gdf, ['CODE', 'CODE_DEP', 'code'])
    col_reg = _detecter_colonne(gdf, ['NOM_REGION', 'REGION', 'region'])

    with app.app_context():
        regions = {r.nom: r.id for r in Region.query.all()}
        for _, row in gdf.iterrows():
            nom = str(row.get(col_nom, '')).strip().title() if col_nom else f'Dep_{_}'
            code = str(row.get(col_code, '')).strip() if col_code else None
            nom_region = str(row.get(col_reg, '')).strip().title() if col_reg else None

            region_id = None
            if nom_region and nom_region in regions:
                region_id = regions[nom_region]
            else:
                region_id = next(iter(regions.values())) if regions else 1

            existing = Departement.query.filter_by(nom=nom, region_id=region_id).first()
            if not existing:
                d = Departement(nom=nom, code=code, region_id=region_id,
                                geom=geom_to_json(row.geometry))
                db.session.add(d)
                db.session.flush()
                dep_map[nom] = d.id
            else:
                dep_map[nom] = existing.id
        db.session.commit()
        print(f'  -> {len(dep_map)} départements')
    return dep_map

# ─────────────────────────────────────────
# 3. Communes (depuis arrondissements SHP)
# ─────────────────────────────────────────
def seed_communes(app, dep_map):
    print('\n>>> Peuplement des communes...')
    gdf = charger_shp('LA_ARRONDISSEMENT_S')
    if gdf is None:
        print('  Tentative avec LA_DEPARTEMENT_S...')
        return {}

    commune_map = {}
    col_nom = _detecter_colonne(gdf, ['NOM_COM', 'NOM', 'NAME', 'COMMUNE', 'nom_commune', 'nom'])
    col_code = _detecter_colonne(gdf, ['CODE_COM', 'CODE', 'code'])
    col_dep = _detecter_colonne(gdf, ['NOM_DEP', 'DEPARTEMEN', 'DEP', 'departement'])
    col_pop = _detecter_colonne(gdf, ['POPULATION', 'POP', 'pop_tot'])
    col_sup = _detecter_colonne(gdf, ['SUPERFICIE', 'AREA', 'Shape_Area'])

    with app.app_context():
        deps = {d.nom: d.id for d in Departement.query.all()}
        default_dep_id = next(iter(deps.values())) if deps else 1

        for _, row in gdf.iterrows():
            nom = str(row.get(col_nom, '')).strip().title() if col_nom else f'Commune_{_}'
            if not nom or nom == 'Nan':
                continue
            code = str(row.get(col_code, '')).strip() if col_code else None
            nom_dep = str(row.get(col_dep, '')).strip().title() if col_dep else None
            population = int(row.get(col_pop, 0)) if col_pop and row.get(col_pop) else None
            superficie = float(row.get(col_sup, 0)) if col_sup and row.get(col_sup) else None

            dep_id = deps.get(nom_dep, default_dep_id) if nom_dep else default_dep_id

            existing = Commune.query.filter_by(nom=nom, departement_id=dep_id).first()
            if not existing:
                c = Commune(
                    nom=nom, code=code, departement_id=dep_id,
                    population=population, superficie_km2=superficie,
                    geom=geom_to_json(row.geometry)
                )
                db.session.add(c)
                db.session.flush()
                commune_map[nom] = c.id
            else:
                commune_map[nom] = existing.id
        db.session.commit()
        print(f'  -> {len(commune_map)} communes')
    return commune_map

# ─────────────────────────────────────────
# 4. Couches thématiques (DonneeSectorielle)
# ─────────────────────────────────────────
def seed_donnees_sectorielles(app):
    """
    Insère les données thématiques disponibles dans la table donnees_sectorielles.
    Chaque entité est associée à la commune qui l'intersecte spatialement.
    """
    print('\n>>> Peuplement des données sectorielles...')

    couches = [
        ('TR_AEROPORT_P',     'transport',     'Aéroport',    'point'),
        ('BS_POINT_EAU_P',    'eau',           'Point d\'eau', 'point'),
        ('LX_AIRE_PROTEGEE_S','environnement', 'Aire protégée', 'polygon'),
        ('VE_SURFACE_BOISEE_S','vegetation',   'Forêt',       'polygon'),
        ('VE_SURFACE_CULTIVEE_S','agriculture','Surface cultivée', 'polygon'),
        ('LX_LIEU_INTERET_P', 'poi',           'Lieu d\'intérêt', 'point'),
        ('TR_AEROPORT_P',     'transport',     'Aéroport',    'point'),
        ('BS_AGGLOMERATION_S','bati',          'Agglomération','polygon'),
    ]

    with app.app_context():
        communes_gdf = _charger_communes_comme_gdf()

        for shp_name, secteur, label, geom_type in couches:
            gdf = charger_shp(shp_name)
            if gdf is None:
                continue
            col_nom = _detecter_colonne(gdf, ['NOM', 'NAME', 'LIBELLE', 'nom', 'name'])
            col_src = _detecter_colonne(gdf, ['SOURCE', 'source'])
            col_ann = _detecter_colonne(gdf, ['ANNEE', 'YEAR', 'annee'])

            n_inserts = 0
            for _, row in gdf.iterrows():
                nom_entite = str(row.get(col_nom, label)).strip() if col_nom else label
                source = str(row.get(col_src, 'IGN Sénégal')).strip() if col_src else 'IGN Sénégal'
                annee = int(row.get(col_ann, 0)) if col_ann and row.get(col_ann) else None
                attributs = {k: str(v) for k, v in row.items()
                             if k != 'geometry' and v is not None and str(v) != 'nan'}

                commune_id = _trouver_commune_id(row.geometry, communes_gdf)
                if not commune_id:
                    commune_id = 1  # fallback

                geom_json = geom_to_json(row.geometry)
                ds = DonneeSectorielle(
                    commune_id=commune_id,
                    type_secteur=secteur,
                    nom=nom_entite[:200],
                    source=source,
                    annee_collecte=annee,
                    attributs=attributs,
                    geom_polygon=geom_json if geom_type == 'polygon' else None,
                    geom_point=geom_json if geom_type == 'point' else None,
                )
                db.session.add(ds)
                n_inserts += 1

                if n_inserts % 500 == 0:
                    db.session.flush()
                    print(f'    ... {n_inserts} entités {secteur}')

            db.session.commit()
            print(f'  -> {n_inserts} enregistrements [{secteur}] depuis {shp_name}')

def _charger_communes_comme_gdf():
    """Charge les géométries des communes depuis la BDD pour jointure spatiale."""
    communes = Commune.query.filter(Commune.geom.isnot(None)).all()
    if not communes:
        return None
    import pandas as pd
    from shapely.geometry import shape
    rows = []
    for c in communes:
        try:
            geom = shape(json.loads(c.geom))
            rows.append({'id': c.id, 'geometry': geom})
        except Exception:
            pass
    if not rows:
        return None
    return gpd.GeoDataFrame(rows, crs='EPSG:4326')

def _trouver_commune_id(geom, communes_gdf):
    """Retourne l'ID de la commune qui contient ou intersecte la géométrie."""
    if communes_gdf is None or geom is None:
        return None
    try:
        centroid = geom.centroid if hasattr(geom, 'centroid') else geom
        for _, row in communes_gdf.iterrows():
            if row.geometry.contains(centroid):
                return row['id']
        for _, row in communes_gdf.iterrows():
            if row.geometry.intersects(geom):
                return row['id']
    except Exception:
        pass
    return None

def _detecter_colonne(gdf, candidats):
    """Détecte la première colonne existante parmi les candidats."""
    cols = [c.upper() for c in gdf.columns]
    for c in candidats:
        if c.upper() in cols:
            return gdf.columns[cols.index(c.upper())]
    return None

# ─────────────────────────────────────────
# 5. Couches cart. brutes (pour rendu rapide)
# ─────────────────────────────────────────
def seed_couches_cartographiques(app):
    """
    Stocke les couches thématiques brutes (routes, cours d'eau, veg.)
    comme données sectorielles génériques réutilisables pour le rendu.
    """
    print('\n>>> Couches cartographiques brutes (routes, eau, végétation)...')

    couches = [
        ('TR_SEGMENT_ROUTIER_L', 'route', 'Route', 'line'),
        ('HD_COURS_EAU_SIMPLE_L','eau', 'Cours d\'eau', 'line'),
        ('HD_REGION_HYDRIQUE_S', 'eau', 'Plan d\'eau', 'polygon'),
        ('FO_COURBE_NIVEAU_L',   'relief', 'Courbe de niveau', 'line'),
        ('FO_SABLE_S',           'relief', 'Zone sableuse', 'polygon'),
        ('TR_CHEMIN_FER_L',      'transport', 'Chemin de fer', 'line'),
        ('BS_REPERE_NAVIGATION_P','navigation','Repère navigation','point'),
    ]

    with app.app_context():
        communes_gdf = _charger_communes_comme_gdf()
        for shp_name, secteur, label, geom_type in couches:
            gdf = charger_shp(shp_name)
            if gdf is None:
                continue
            n = 0
            for _, row in gdf.iterrows():
                attributs = {k: str(v) for k, v in row.items()
                             if k != 'geometry' and v is not None and str(v) != 'nan'}
                commune_id = _trouver_commune_id(row.geometry, communes_gdf) or 1
                geom_json = geom_to_json(row.geometry)
                ds = DonneeSectorielle(
                    commune_id=commune_id,
                    type_secteur=secteur,
                    nom=label,
                    source='IGN Sénégal / Topo1M',
                    attributs=attributs,
                    geom_point=geom_json if geom_type == 'point' else None,
                    geom_polygon=geom_json if geom_type in ('polygon', 'line') else None,
                )
                db.session.add(ds)
                n += 1
                if n % 1000 == 0:
                    db.session.flush()
            db.session.commit()
            print(f'  -> {n} éléments [{secteur}] depuis {shp_name}')

# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
if __name__ == '__main__':
    print('=' * 60)
    print('  Carto-facileSN -- Initialisation de la base de données')
    print('=' * 60)

    app = create_app()

    with app.app_context():
        db.create_all()
        print('Tables créées ou existantes : OK')

    region_map = seed_regions(app)
    dep_map = seed_departements(app, region_map)
    commune_map = seed_communes(app, dep_map)
    seed_donnees_sectorielles(app)
    seed_couches_cartographiques(app)

    print('\n' + '=' * 60)
    print(f'  Seed terminé :')
    print(f'  - {len(region_map)} régions')
    print(f'  - {len(dep_map)} départements')
    print(f'  - {len(commune_map)} communes')
    print('=' * 60)
