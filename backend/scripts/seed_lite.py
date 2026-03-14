#!/usr/bin/env python3
"""
Seed léger SANS geopandas ni fiona.
Utilise pyshp (shapefile) + shapely uniquement => ~5 MB d'install.
Compatible PythonAnywhere plan gratuit.

Installation:
    pip install pyshp shapely flask flask-sqlalchemy flask-cors python-dotenv

Usage:
    cd backend
    python scripts/seed_lite.py
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

try:
    import shapefile  # pyshp
except ImportError:
    print("ERREUR: pyshp manquant. Lancez: pip install pyshp")
    sys.exit(1)

try:
    from shapely.geometry import shape, mapping
except ImportError:
    print("ERREUR: shapely manquant. Lancez: pip install shapely")
    sys.exit(1)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')


def lire_shp(nom_base):
    """Lit un SHP avec pyshp, retourne liste de dicts {geom, attrs}."""
    chemin = os.path.join(DATA_DIR, f'{nom_base}.shp')
    if not os.path.exists(chemin):
        print(f'  [ABSENT] {nom_base}.shp')
        return []
    try:
        sf = shapefile.Reader(chemin)
        fields = [f[0] for f in sf.fields[1:]]  # skip DeletionFlag
        entites = []
        for sr in sf.shapeRecords():
            attrs = dict(zip(fields, sr.record))
            # Convertir les bytes en str
            attrs = {k: (v.strip() if isinstance(v, str) else
                         v.decode('utf-8', errors='replace').strip() if isinstance(v, bytes)
                         else v)
                     for k, v in attrs.items()}
            geom_dict = sr.shape.__geo_interface__
            entites.append({'geom': geom_dict, 'attrs': attrs})
        print(f'  [OK] {nom_base}.shp -> {len(entites)} entités')
        return entites
    except Exception as e:
        print(f'  [ERREUR] {nom_base}: {e}')
        return []


def geom_json(geom_dict):
    """Retourne le GeoJSON string d'une géométrie."""
    if not geom_dict:
        return None
    return json.dumps(geom_dict)


def detecter_col(attrs, candidats):
    """Trouve la première clé existante dans attrs parmi les candidats."""
    upper_keys = {k.upper(): k for k in attrs}
    for c in candidats:
        if c.upper() in upper_keys:
            return upper_keys[c.upper()]
    return None


# ──────────────────────────────────────────────
def seed_regions(app, db, Region):
    print('\n>>> Régions (LA_REGION_S)...')
    entites = lire_shp('LA_REGION_S')
    if not entites:
        return {}

    sample = entites[0]['attrs'] if entites else {}
    col_nom = detecter_col(sample, ['NOM', 'REGION', 'NAME', 'nom'])
    col_code = detecter_col(sample, ['CODE', 'CODE_REG', 'code'])

    region_map = {}
    with app.app_context():
        for e in entites:
            nom = str(e['attrs'].get(col_nom, '')).strip().title() if col_nom else 'Inconnu'
            if not nom or nom.lower() in ('', 'nan', 'none'):
                continue
            code = str(e['attrs'].get(col_code, '')).strip() if col_code else None
            existing = Region.query.filter_by(nom=nom).first()
            if not existing:
                r = Region(nom=nom, code=code, geom=geom_json(e['geom']))
                db.session.add(r)
                db.session.flush()
                region_map[nom] = r.id
            else:
                region_map[nom] = existing.id
        db.session.commit()
    print(f'  -> {len(region_map)} régions insérées')
    return region_map


def seed_departements(app, db, Departement, Region):
    print('\n>>> Départements (LA_DEPARTEMENT_S)...')
    entites = lire_shp('LA_DEPARTEMENT_S')
    if not entites:
        return {}

    sample = entites[0]['attrs'] if entites else {}
    col_nom = detecter_col(sample, ['NOM', 'DEPARTEMEN', 'NAME', 'nom'])
    col_code = detecter_col(sample, ['CODE', 'CODE_DEP', 'code'])
    col_reg = detecter_col(sample, ['NOM_REGION', 'REGION', 'NOM_REG'])

    dep_map = {}
    with app.app_context():
        regions = {r.nom: r.id for r in Region.query.all()}
        default_rid = next(iter(regions.values())) if regions else 1

        for e in entites:
            nom = str(e['attrs'].get(col_nom, '')).strip().title() if col_nom else 'Inconnu'
            if not nom or nom.lower() in ('', 'nan', 'none'):
                continue
            code = str(e['attrs'].get(col_code, '')).strip() if col_code else None
            nom_reg = str(e['attrs'].get(col_reg, '')).strip().title() if col_reg else None
            rid = regions.get(nom_reg, default_rid) if nom_reg else default_rid

            existing = Departement.query.filter_by(nom=nom).first()
            if not existing:
                d = Departement(nom=nom, code=code, region_id=rid, geom=geom_json(e['geom']))
                db.session.add(d)
                db.session.flush()
                dep_map[nom] = d.id
            else:
                dep_map[nom] = existing.id
        db.session.commit()
    print(f'  -> {len(dep_map)} départements insérés')
    return dep_map


def seed_communes(app, db, Commune, Departement):
    print('\n>>> Communes (LA_ARRONDISSEMENT_S)...')
    entites = lire_shp('LA_ARRONDISSEMENT_S')
    if not entites:
        return {}

    sample = entites[0]['attrs'] if entites else {}
    col_nom = detecter_col(sample, ['NOM_COM', 'NOM', 'NAME', 'COMMUNE', 'nom'])
    col_code = detecter_col(sample, ['CODE_COM', 'CODE', 'code'])
    col_dep = detecter_col(sample, ['NOM_DEP', 'DEPARTEMEN', 'DEP'])
    col_pop = detecter_col(sample, ['POPULATION', 'POP', 'pop_tot'])
    col_sup = detecter_col(sample, ['SUPERFICIE', 'Shape_Area', 'AREA'])

    commune_map = {}
    with app.app_context():
        deps = {d.nom: d.id for d in Departement.query.all()}
        default_did = next(iter(deps.values())) if deps else 1

        for i, e in enumerate(entites):
            nom = str(e['attrs'].get(col_nom, '')).strip().title() if col_nom else f'Commune_{i}'
            if not nom or nom.lower() in ('', 'nan', 'none'):
                continue
            code = str(e['attrs'].get(col_code, '')).strip() if col_code else None
            nom_dep = str(e['attrs'].get(col_dep, '')).strip().title() if col_dep else None
            did = deps.get(nom_dep, default_did) if nom_dep else default_did
            try:
                pop = int(float(e['attrs'].get(col_pop, 0))) if col_pop else None
            except (ValueError, TypeError):
                pop = None
            try:
                sup = float(e['attrs'].get(col_sup, 0)) if col_sup else None
            except (ValueError, TypeError):
                sup = None

            existing = Commune.query.filter_by(nom=nom, departement_id=did).first()
            if not existing:
                c = Commune(nom=nom, code=code, departement_id=did,
                            population=pop, superficie_km2=sup,
                            geom=geom_json(e['geom']))
                db.session.add(c)
                db.session.flush()
                commune_map[nom] = c.id
            else:
                commune_map[nom] = existing.id

            if (i + 1) % 100 == 0:
                db.session.flush()
                print(f'    ... {i + 1} communes')

        db.session.commit()
    print(f'  -> {len(commune_map)} communes insérées')
    return commune_map


def seed_localites(app, db, DonneeSectorielle):
    print('\n>>> Localités (LA_LOCALITE_P)...')
    entites = lire_shp('LA_LOCALITE_P')
    if not entites:
        return
    sample = entites[0]['attrs'] if entites else {}
    col_nom = detecter_col(sample, ['NOM', 'NAME', 'LOCALITE', 'nom'])

    with app.app_context():
        communes = list(range(1, max(1, len(entites) // 50)))
        for i, e in enumerate(entites):
            nom = str(e['attrs'].get(col_nom, 'Localité')).strip() if col_nom else 'Localité'
            attrs = {k: str(v) for k, v in e['attrs'].items()
                     if v is not None and str(v) not in ('nan', 'None', '')}
            commune_id = (i % max(1, len(communes))) + 1
            ds = DonneeSectorielle(
                commune_id=commune_id,
                type_secteur='localite',
                nom=nom[:200],
                source='IGN Sénégal',
                attributs=attrs,
                geom_point=geom_json(e['geom'])
            )
            db.session.add(ds)
            if (i + 1) % 500 == 0:
                db.session.flush()
                print(f'    ... {i + 1} localités')
        db.session.commit()
    print(f'  -> {len(entites)} localités insérées')


def seed_couche_simple(app, db, DonneeSectorielle, shp_name, secteur, label, geom_type):
    """Seed générique pour une couche thématique."""
    print(f'\n>>> {label} ({shp_name})...')
    entites = lire_shp(shp_name)
    if not entites:
        return
    sample = entites[0]['attrs'] if entites else {}
    col_nom = detecter_col(sample, ['NOM', 'NAME', 'LIBELLE', 'nom'])

    with app.app_context():
        for i, e in enumerate(entites):
            nom = str(e['attrs'].get(col_nom, label)).strip() if col_nom else label
            attrs = {k: str(v) for k, v in e['attrs'].items()
                     if v is not None and str(v) not in ('nan', 'None', '')}
            commune_id = (i % 10) + 1  # distribution simple
            geom = geom_json(e['geom'])
            ds = DonneeSectorielle(
                commune_id=commune_id,
                type_secteur=secteur,
                nom=nom[:200],
                source='IGN Sénégal / Topo1M',
                attributs=attrs,
                geom_point=geom if geom_type == 'point' else None,
                geom_polygon=geom if geom_type in ('polygon', 'line') else None,
            )
            db.session.add(ds)
            if (i + 1) % 500 == 0:
                db.session.flush()
        db.session.commit()
    print(f'  -> {len(entites)} éléments [{secteur}]')


# ──────────────────────────────────────────────
if __name__ == '__main__':
    print('=' * 55)
    print('  Carto-facileSN  — Seed LITE (sans geopandas)')
    print('=' * 55)

    from app import create_app, db
    from models.commune import Region, Departement, Commune
    from models.donnee_sectorielle import DonneeSectorielle

    app = create_app()

    with app.app_context():
        db.create_all()
        print('Tables créées : OK')

    region_map = seed_regions(app, db, Region)
    dep_map = seed_departements(app, db, Departement, Region)
    commune_map = seed_communes(app, db, Commune, Departement)

    # Couches thématiques légères (points et polygones simples)
    couches = [
        ('BS_POINT_EAU_P',     'eau',          'Point d\'eau',    'point'),
        ('LX_AIRE_PROTEGEE_S', 'environnement','Aire protégée',   'polygon'),
        ('BS_AGGLOMERATION_S', 'bati',         'Agglomération',   'polygon'),
        ('LX_LIEU_INTERET_P',  'poi',          'Lieu d\'intérêt', 'point'),
        ('BS_REPERE_NAVIGATION_P','navigation','Repère',          'point'),
        ('FO_SABLE_S',         'relief',       'Zone sableuse',   'polygon'),
        ('HD_REGION_HYDRIQUE_S','eau',         'Plan d\'eau',     'polygon'),
    ]
    for shp, sec, lbl, gtype in couches:
        seed_couche_simple(app, db, DonneeSectorielle, shp, sec, lbl, gtype)

    # Localités (volumineuses, en dernier)
    seed_localites(app, db, DonneeSectorielle)

    print('\n' + '=' * 55)
    print(f'  SEED TERMINÉ')
    print(f'  Régions     : {len(region_map)}')
    print(f'  Départements: {len(dep_map)}')
    print(f'  Communes    : {len(commune_map)}')
    print('=' * 55)
