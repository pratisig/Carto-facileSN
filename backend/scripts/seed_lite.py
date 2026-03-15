#!/usr/bin/env python3
import os, sys, json

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, '.env'))

try:
    import shapefile
except ImportError:
    print('ERREUR: pip install pyshp'); sys.exit(1)

DATA_DIR = os.path.join(BACKEND_DIR, 'data')
ENCODINGS = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']


def decode_val(v):
    if isinstance(v, bytes):
        for enc in ENCODINGS:
            try: return v.decode(enc).strip()
            except: continue
        return v.decode('latin-1', errors='replace').strip()
    return str(v).strip() if v is not None else ''


def normaliser(s):
    """Normalise un nom pour comparaison : minuscules, sans accents basiques."""
    if not s: return ''
    s = s.strip().lower()
    for a, b in [('\xe9','e'),('\xe8','e'),('\xea','e'),('\xe0','a'),('\xf4','o'),
                 ('\xf9','u'),('\xfb','u'),('\xee','i'),('\xe7','c')]:
        s = s.replace(a, b)
    return s


def lire_shp(nom):
    chemin = os.path.join(DATA_DIR, f'{nom}.shp')
    if not os.path.exists(chemin):
        print(f'  [ABSENT] {nom}.shp'); return []
    cpg = chemin.replace('.shp', '.cpg')
    enc = 'latin-1'
    if os.path.exists(cpg):
        try: enc = open(cpg).read().strip() or 'latin-1'
        except: pass
    try:
        try: sf = shapefile.Reader(chemin, encoding=enc)
        except: sf = shapefile.Reader(chemin, encoding='latin-1')
        fields = [f[0] for f in sf.fields[1:]]
        result = []
        for sr in sf.shapeRecords():
            attrs = {k: decode_val(v) for k, v in zip(fields, sr.record)}
            try: geom = json.dumps(sr.shape.__geo_interface__)
            except: geom = None
            result.append({'geom': geom, 'attrs': attrs})
        print(f'  [OK] {nom}.shp -> {len(result)} entites')
        if result:
            print(f'  Colonnes: {list(result[0]["attrs"].keys())}')
        return result
    except Exception as e:
        print(f'  [ERREUR] {nom}: {e}'); return []


def col(attrs, candidats):
    upper = {k.upper(): k for k in attrs}
    for c in candidats:
        if c.upper() in upper: return upper[c.upper()]
    return None


def seed_regions(app, db, Region):
    print('\n>>> Regions...')
    data = lire_shp('LA_REGION_S')
    if not data: return {}
    c_nom = col(data[0]['attrs'], ['NOM', 'REGION', 'NAME', 'NOM_REG'])
    c_code = col(data[0]['attrs'], ['CODE', 'CODE_REG'])
    rmap = {}  # nom_normalise -> id
    rmap_titre = {}  # nom titre -> id
    with app.app_context():
        # Vider et reseeder pour eviter doublons
        existing = Region.query.count()
        if existing > 0:
            print(f'  -> {existing} regions deja en base, skip seed')
            for r in Region.query.all():
                rmap[normaliser(r.nom)] = r.id
                rmap_titre[r.nom] = r.id
            return rmap
        for e in data:
            nom = e['attrs'].get(c_nom, '').title() if c_nom else 'Inconnu'
            if not nom or nom in ('', 'Nan', 'None'): continue
            code = e['attrs'].get(c_code) if c_code else None
            obj = Region(nom=nom, code=code, geom=e['geom'])
            db.session.add(obj)
            db.session.flush()
            rmap[normaliser(nom)] = obj.id
            rmap_titre[nom] = obj.id
        db.session.commit()
    print(f'  -> {len(rmap)} regions insrees')
    print(f'  Noms: {list(rmap_titre.keys())[:5]}...')
    return rmap


def seed_departements(app, db, Departement, Region):
    print('\n>>> Departements...')
    data = lire_shp('LA_DEPARTEMENT_S')
    if not data: return {}
    c_nom  = col(data[0]['attrs'], ['NOM', 'DEPARTEMEN', 'NAME', 'NOM_DEP'])
    c_code = col(data[0]['attrs'], ['CODE', 'CODE_DEP'])
    c_reg  = col(data[0]['attrs'], ['NOM_REGION', 'REGION', 'NOM_REG', 'NOM_R'])
    print(f'  Colonne region detectee: {c_reg}')
    dmap = {}
    with app.app_context():
        existing = Departement.query.count()
        if existing > 0:
            print(f'  -> {existing} departements deja en base, skip seed')
            for d in Departement.query.all():
                dmap[normaliser(d.nom)] = d.id
            return dmap
        # Construire index regions normalise
        regions_norm = {normaliser(r.nom): r.id for r in Region.query.all()}
        regions_list = list(regions_norm.keys())
        default_rid = next(iter(regions_norm.values()), 1)
        non_matches = []
        for e in data:
            nom = e['attrs'].get(c_nom, '').title() if c_nom else 'Inconnu'
            if not nom or nom in ('', 'Nan', 'None'): continue
            code = e['attrs'].get(c_code) if c_code else None
            nom_reg_raw = e['attrs'].get(c_reg, '') if c_reg else ''
            nom_reg_norm = normaliser(nom_reg_raw)
            rid = regions_norm.get(nom_reg_norm)
            if rid is None:
                # Recherche partielle
                for rn, rid2 in regions_norm.items():
                    if nom_reg_norm in rn or rn in nom_reg_norm:
                        rid = rid2; break
            if rid is None:
                non_matches.append(nom_reg_raw)
                rid = default_rid
            obj = Departement(nom=nom, code=code, region_id=rid, geom=e['geom'])
            db.session.add(obj)
            db.session.flush()
            dmap[normaliser(nom)] = obj.id
        db.session.commit()
    if non_matches:
        print(f'  [WARN] {len(non_matches)} deps sans region match: {list(set(non_matches))[:5]}')
    print(f'  -> {len(dmap)} departements inseres')
    return dmap


def seed_communes(app, db, Commune, Departement):
    print('\n>>> Communes...')
    data = lire_shp('LA_ARRONDISSEMENT_S')
    if not data: return {}
    c_nom  = col(data[0]['attrs'], ['NOM_COM', 'NOM', 'NAME', 'COMMUNE'])
    c_code = col(data[0]['attrs'], ['CODE_COM', 'CODE'])
    c_dep  = col(data[0]['attrs'], ['NOM_DEP', 'DEPARTEMEN', 'DEP', 'NOM_D'])
    c_pop  = col(data[0]['attrs'], ['POPULATION', 'POP'])
    c_sup  = col(data[0]['attrs'], ['SUPERFICIE', 'Shape_Area', 'AREA'])
    cmap = {}
    with app.app_context():
        existing = Commune.query.count()
        if existing > 0:
            print(f'  -> {existing} communes deja en base, skip seed')
            return {c.nom: c.id for c in Commune.query.all()}
        deps_norm = {normaliser(d.nom): d.id for d in Departement.query.all()}
        default_did = next(iter(deps_norm.values()), 1)
        for i, e in enumerate(data):
            nom = e['attrs'].get(c_nom, f'Commune_{i}').title() if c_nom else f'Commune_{i}'
            if not nom or nom in ('', 'Nan', 'None'): continue
            code = e['attrs'].get(c_code) if c_code else None
            nom_dep_norm = normaliser(e['attrs'].get(c_dep, '') if c_dep else '')
            did = deps_norm.get(nom_dep_norm)
            if did is None:
                for dn, did2 in deps_norm.items():
                    if nom_dep_norm in dn or dn in nom_dep_norm:
                        did = did2; break
            if did is None: did = default_did
            try: pop = int(float(e['attrs'].get(c_pop, 0))) if c_pop else None
            except: pop = None
            try: sup = float(e['attrs'].get(c_sup, 0)) if c_sup else None
            except: sup = None
            obj = Commune(nom=nom, code=code, departement_id=did,
                          population=pop, superficie_km2=sup, geom=e['geom'])
            db.session.add(obj)
            db.session.flush()
            cmap[nom] = obj.id
            if (i + 1) % 100 == 0: db.session.flush()
        db.session.commit()
    print(f'  -> {len(cmap)} communes inserees')
    return cmap


def seed_couche(app, db, DonneeSectorielle, shp, secteur, label, gtype):
    print(f'\n>>> {label} ({shp})...')
    data = lire_shp(shp)
    if not data: return
    c_nom = col(data[0]['attrs'], ['NOM', 'NAME', 'LIBELLE']) if data else None
    with app.app_context():
        for i, e in enumerate(data):
            nom = (e['attrs'].get(c_nom, label)[:200] if c_nom else label)
            attrs = {k: v for k, v in e['attrs'].items() if v not in ('', 'nan', 'None')}
            obj = DonneeSectorielle(
                commune_id=(i % 10) + 1, type_secteur=secteur, nom=nom,
                source='IGN Senegal', attributs=attrs,
                geom_point=e['geom'] if gtype == 'point' else None,
                geom_polygon=e['geom'] if gtype != 'point' else None,
            )
            db.session.add(obj)
            if (i + 1) % 500 == 0: db.session.flush()
        db.session.commit()
    print(f'  -> {len(data)} elements')


if __name__ == '__main__':
    print('=' * 50)
    print('  Carto-facileSN  -  Seed LITE')
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
        ('BS_POINT_EAU_P',      'eau',          'Points eau',    'point'),
        ('LX_AIRE_PROTEGEE_S',  'environnement','Aires prot',    'polygon'),
        ('BS_AGGLOMERATION_S',  'bati',         'Agglomerations','polygon'),
        ('FO_SABLE_S',          'relief',       'Sable',         'polygon'),
        ('HD_REGION_HYDRIQUE_S','eau',          'Plans eau',     'polygon'),
    ]
    for shp, sec, lbl, gt in couches:
        seed_couche(app, db, DonneeSectorielle, shp, sec, lbl, gt)

    print('\n' + '=' * 50)
    print(f'TERMINE | Regions:{len(rmap)} | Dep:{len(dmap)} | Com:{len(cmap)}')
    print('=' * 50)
