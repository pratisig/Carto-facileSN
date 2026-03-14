#!/usr/bin/env python3
"""
Seed LITE - sans geopandas/fiona.
Compatible PythonAnywhere, Render, Colab.
Utilise pyshp + shapely uniquement.

Usage:
    cd backend && python scripts/seed_lite.py
"""

import os
import sys
import json

# Ajouter backend/ au path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, '.env'))

try:
    import shapefile
except ImportError:
    print("ERREUR: pyshp manquant => pip install pyshp")
    sys.exit(1)

DATA_DIR = os.path.join(BACKEND_DIR, 'data')


def lire_shp(nom):
    chemin = os.path.join(DATA_DIR, f'{nom}.shp')
    if not os.path.exists(chemin):
        print(f'  [ABSENT] {nom}.shp')
        return []
    try:
        sf = shapefile.Reader(chemin)
        fields = [f[0] for f in sf.fields[1:]]
        result = []
        for sr in sf.shapeRecords():
            attrs = {}
            for k, v in zip(fields, sr.record):
                if isinstance(v, bytes):
                    v = v.decode('utf-8', errors='replace')
                attrs[k] = str(v).strip() if v is not None else ''
            result.append({'geom': json.dumps(sr.shape.__geo_interface__), 'attrs': attrs})
        print(f'  [OK] {nom}.shp -> {len(result)} entités')
        return result
    except Exception as e:
        print(f'  [ERREUR] {nom}: {e}')
        return []


def col(attrs, candidats):
    upper = {k.upper(): k for k in attrs}
    for c in candidats:
        if c.upper() in upper:
            return upper[c.upper()]
    return None


def seed_regions(app, db, Region):
    print('\n>>> Régions...')
    data = lire_shp('LA_REGION_S')
    if not data:
        return {}
    c_nom = col(data[0]['attrs'], ['NOM', 'REGION', 'NAME'])
    c_code = col(data[0]['attrs'], ['CODE', 'CODE_REG'])
    rmap = {}
    with app.app_context():
        for e in data:
            nom = e['attrs'].get(c_nom, '').title() if c_nom else 'Inconnu'
            if not nom or nom in ('', 'Nan', 'None'):
                continue
            code = e['attrs'].get(c_code, '') if c_code else None
            obj = Region.query.filter_by(nom=nom).first()
            if not obj:
                obj = Region(nom=nom, code=code, geom=e['geom'])
                db.session.add(obj)
                db.session.flush()
            rmap[nom] = obj.id
        db.session.commit()
    print(f'  -> {len(rmap)} régions')
    return rmap


def seed_departements(app, db, Departement, Region):
    print('\n>>> Départements...')
    data = lire_shp('LA_DEPARTEMENT_S')
    if not data:
        return {}
    c_nom = col(data[0]['attrs'], ['NOM', 'DEPARTEMEN', 'NAME'])
    c_code = col(data[0]['attrs'], ['CODE', 'CODE_DEP'])
    c_reg = col(data[0]['attrs'], ['NOM_REGION', 'REGION', 'NOM_REG'])
    dmap = {}
    with app.app_context():
        regions = {r.nom: r.id for r in Region.query.all()}
        default_rid = next(iter(regions.values()), 1)
        for e in data:
            nom = e['attrs'].get(c_nom, '').title() if c_nom else 'Inconnu'
            if not nom or nom in ('', 'Nan', 'None'):
                continue
            code = e['attrs'].get(c_code, '') if c_code else None
            nom_reg = e['attrs'].get(c_reg, '').title() if c_reg else None
            rid = regions.get(nom_reg, default_rid)
            obj = Departement.query.filter_by(nom=nom).first()
            if not obj:
                obj = Departement(nom=nom, code=code, region_id=rid, geom=e['geom'])
                db.session.add(obj)
                db.session.flush()
            dmap[nom] = obj.id
        db.session.commit()
    print(f'  -> {len(dmap)} départements')
    return dmap


def seed_communes(app, db, Commune, Departement):
    print('\n>>> Communes...')
    data = lire_shp('LA_ARRONDISSEMENT_S')
    if not data:
        return {}
    c_nom = col(data[0]['attrs'], ['NOM_COM', 'NOM', 'NAME', 'COMMUNE'])
    c_code = col(data[0]['attrs'], ['CODE_COM', 'CODE'])
    c_dep = col(data[0]['attrs'], ['NOM_DEP', 'DEPARTEMEN', 'DEP'])
    c_pop = col(data[0]['attrs'], ['POPULATION', 'POP'])
    c_sup = col(data[0]['attrs'], ['SUPERFICIE', 'Shape_Area', 'AREA'])
    cmap = {}
    with app.app_context():
        deps = {d.nom: d.id for d in Departement.query.all()}
        default_did = next(iter(deps.values()), 1)
        for i, e in enumerate(data):
            nom = e['attrs'].get(c_nom, f'Commune_{i}').title() if c_nom else f'Commune_{i}'
            if not nom or nom in ('', 'Nan', 'None'):
                continue
            code = e['attrs'].get(c_code, '') if c_code else None
            nom_dep = e['attrs'].get(c_dep, '').title() if c_dep else None
            did = deps.get(nom_dep, default_did)
            try:
                pop = int(float(e['attrs'].get(c_pop, 0))) if c_pop else None
            except Exception:
                pop = None
            try:
                sup = float(e['attrs'].get(c_sup, 0)) if c_sup else None
            except Exception:
                sup = None
            obj = Commune.query.filter_by(nom=nom, departement_id=did).first()
            if not obj:
                obj = Commune(nom=nom, code=code, departement_id=did,
                              population=pop, superficie_km2=sup, geom=e['geom'])
                db.session.add(obj)
                db.session.flush()
            cmap[nom] = obj.id
            if (i + 1) % 100 == 0:
                db.session.flush()
        db.session.commit()
    print(f'  -> {len(cmap)} communes')
    return cmap


def seed_couche(app, db, DonneeSectorielle, shp, secteur, label, gtype):
    print(f'\n>>> {label} ({shp})...')
    data = lire_shp(shp)
    if not data:
        return
    c_nom = col(data[0]['attrs'], ['NOM', 'NAME', 'LIBELLE']) if data else None
    with app.app_context():
        for i, e in enumerate(data):
            nom = e['attrs'].get(c_nom, label)[:200] if c_nom else label
            attrs = {k: v for k, v in e['attrs'].items() if v not in ('', 'nan', 'None')}
            geom = e['geom']
            obj = DonneeSectorielle(
                commune_id=(i % 10) + 1,
                type_secteur=secteur,
                nom=nom,
                source='IGN Sénégal',
                attributs=attrs,
                geom_point=geom if gtype == 'point' else None,
                geom_polygon=geom if gtype != 'point' else None,
            )
            db.session.add(obj)
            if (i + 1) % 500 == 0:
                db.session.flush()
        db.session.commit()
    print(f'  -> {len(data)} éléments')


if __name__ == '__main__':
    print('=' * 50)
    print('  Carto-facileSN  —  Seed LITE')
    print('=' * 50)

    from app import create_app
    from extensions import db
    from models.commune import Region, Departement, Commune
    from models.donnee_sectorielle import DonneeSectorielle

    app = create_app()
    with app.app_context():
        db.create_all()
        print('Tables OK')

    rmap = seed_regions(app, db, Region)
    dmap = seed_departements(app, db, Departement, Region)
    cmap = seed_communes(app, db, Commune, Departement)

    couches = [
        ('BS_POINT_EAU_P',      'eau',          'Points d\'eau',     'point'),
        ('LX_AIRE_PROTEGEE_S',  'environnement','Aires protégées',  'polygon'),
        ('BS_AGGLOMERATION_S',  'bati',         'Agglomérations',   'polygon'),
        ('LX_LIEU_INTERET_P',   'poi',          'Lieux d\'intérêt', 'point'),
        ('FO_SABLE_S',          'relief',       'Zones sableuses',   'polygon'),
        ('HD_REGION_HYDRIQUE_S','eau',          'Plans d\'eau',      'polygon'),
    ]
    for shp, sec, lbl, gt in couches:
        seed_couche(app, db, DonneeSectorielle, shp, sec, lbl, gt)

    print('\n' + '=' * 50)
    print(f'TERMINÉ | Régions:{len(rmap)} | Dép:{len(dmap)} | Com:{len(cmap)}')
    print('=' * 50)
