"""Lecture des limites administratives depuis les SHP SEN_Admin1 a 4.

Structure des nouveaux SHP :
  SEN_Admin1  -> regions         PCODE=pcode region
  SEN_Admin2  -> departements    PCODE=pcode dep,    ADMIN1_PCO=pcode region
  SEN_Admin3  -> arrondissements PCODE=pcode arr,    ADMIN1_PCO=pcode region,  ADMIN2_PCO=pcode dep
  SEN_Admin4  -> communes        PCODE=pcode commune,ADMIN1_PCO=pcode region,  ADMIN2_PCO=pcode dep, ADMIN3_PCO=pcode arr
"""
import os
import json
import shapefile

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

ENCODINGS = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']

# Noms des SHP (sans extension)
SHP_ADMIN1 = 'SEN_Admin1'
SHP_ADMIN2 = 'SEN_Admin2'
SHP_ADMIN3 = 'SEN_Admin3'
SHP_ADMIN4 = 'SEN_Admin4'


def _decode(v):
    if isinstance(v, bytes):
        for enc in ENCODINGS:
            try:
                return v.decode(enc).strip()
            except Exception:
                continue
        return v.decode('latin-1', errors='replace').strip()
    if v is None:
        return ''
    return str(v).strip()


def _title(s):
    if not s:
        return s
    return ' '.join(w.capitalize() for w in s.strip().split())


def _norm(s):
    if not s:
        return ''
    s = s.strip().lower()
    for a, b in [('é','e'),('è','e'),('ê','e'),('à','a'),('â','a'),
                 ('ô','o'),('ù','u'),('û','u'),('î','i'),('ç','c'),
                 ('é','e'),('è','e'),('ê','e'),('à','a'),('â','a'),
                 ('ô','o'),('ù','u'),('û','u'),('î','i'),('ç','c')]:
        s = s.replace(a, b)
    return s


def _lire_shp(nom):
    chemin = os.path.join(DATA_DIR, f'{nom}.shp')
    if not os.path.exists(chemin):
        print(f'[admin_shp_service] Fichier introuvable: {chemin}')
        return None, []
    cpg = chemin.replace('.shp', '.CPG')
    if not os.path.exists(cpg):
        cpg = chemin.replace('.shp', '.cpg')
    enc = 'utf-8'
    if os.path.exists(cpg):
        try:
            enc = open(cpg, encoding='ascii', errors='ignore').read().strip() or 'utf-8'
        except Exception:
            pass
    try:
        try:
            sf = shapefile.Reader(chemin, encoding=enc)
        except Exception:
            sf = shapefile.Reader(chemin, encoding='latin-1')
        fields = [_decode(f[0]) for f in sf.fields[1:]]
        records = []
        for sr in sf.shapeRecords():
            attrs = {fields[i]: _decode(sr.record[i]) for i in range(len(fields))}
            try:
                geom = json.dumps(sr.shape.__geo_interface__)
            except Exception:
                geom = None
            records.append({'attrs': attrs, 'geom': geom})
        return fields, records
    except Exception as e:
        print(f'[admin_shp_service] Erreur lecture {nom}: {e}')
        return None, []


def _col(fields, candidats):
    """Trouve la premiere colonne existante parmi les candidats (insensible a la casse)."""
    upper = {f.upper(): f for f in fields}
    for c in candidats:
        if c.upper() in upper:
            return upper[c.upper()]
    return None


# ─── Cache en memoire ─────────────────────────────────────────────────────────
_CACHE = {}


def _build_cache():
    global _CACHE
    if _CACHE:
        return

    # ── 1. Regions ───────────────────────────────────────────────────────────
    fields_r, recs_r = _lire_shp(SHP_ADMIN1)
    regions = []
    if fields_r:
        print(f'[admin_shp_service] Admin1 colonnes: {fields_r}')
        c_nom   = _col(fields_r, ['NOM', 'NAME', 'REGION', 'NOM_REG', 'ADM1_FR', 'ADM1_EN'])
        c_pcode = _col(fields_r, ['PCODE', 'ADM1_PCODE', 'CODE'])
        for i, e in enumerate(recs_r, start=1):
            nom = _title(_decode(e['attrs'].get(c_nom, ''))) if c_nom else f'Region {i}'
            if not nom or nom.lower() in ('nan', 'none', ''):
                continue
            pcode = _decode(e['attrs'].get(c_pcode, str(i))) if c_pcode else str(i)
            regions.append({
                'id': i,
                'nom': nom,
                'pcode': pcode,
                'code': pcode,
                'geom': e['geom'],
                'attrs': e['attrs'],
            })
    # Index PCODE -> id pour liaison
    reg_pcode_idx = {r['pcode']: r['id'] for r in regions}

    # ── 2. Departements ──────────────────────────────────────────────────────
    fields_d, recs_d = _lire_shp(SHP_ADMIN2)
    departements = []
    if fields_d:
        print(f'[admin_shp_service] Admin2 colonnes: {fields_d}')
        c_nom    = _col(fields_d, ['NOM', 'NAME', 'DEPARTEMEN', 'NOM_DEP', 'ADM2_FR', 'ADM2_EN'])
        c_pcode  = _col(fields_d, ['PCODE', 'ADM2_PCODE', 'CODE'])
        c_parent = _col(fields_d, ['ADMIN1_PCO', 'ADM1_PCODE', 'CODE_REG', 'NOM_REGION', 'REGION'])
        for i, e in enumerate(recs_d, start=1):
            nom = _title(_decode(e['attrs'].get(c_nom, ''))) if c_nom else f'Departement {i}'
            if not nom or nom.lower() in ('nan', 'none', ''):
                continue
            pcode = _decode(e['attrs'].get(c_pcode, str(i))) if c_pcode else str(i)
            pcode_reg = _decode(e['attrs'].get(c_parent, '')) if c_parent else ''
            rid = reg_pcode_idx.get(pcode_reg, regions[0]['id'] if regions else 1)
            departements.append({
                'id': i,
                'nom': nom,
                'pcode': pcode,
                'code': pcode,
                'region_id': rid,
                'pcode_region': pcode_reg,
                'geom': e['geom'],
                'attrs': e['attrs'],
            })
    dep_pcode_idx = {d['pcode']: d['id'] for d in departements}

    # ── 3. Arrondissements ───────────────────────────────────────────────────
    fields_a, recs_a = _lire_shp(SHP_ADMIN3)
    arrondissements = []
    if fields_a:
        print(f'[admin_shp_service] Admin3 colonnes: {fields_a}')
        c_nom    = _col(fields_a, ['NOM', 'NAME', 'ARRONDISSE', 'NOM_ARR', 'ADM3_FR', 'ADM3_EN'])
        c_pcode  = _col(fields_a, ['PCODE', 'ADM3_PCODE', 'CODE'])
        c_parent = _col(fields_a, ['ADMIN2_PCO', 'ADM2_PCODE', 'CODE_DEP', 'NOM_DEP', 'DEPARTEMEN'])
        for i, e in enumerate(recs_a, start=1):
            nom = _title(_decode(e['attrs'].get(c_nom, ''))) if c_nom else f'Arrondissement {i}'
            if not nom or nom.lower() in ('nan', 'none', ''):
                continue
            pcode = _decode(e['attrs'].get(c_pcode, str(i))) if c_pcode else str(i)
            pcode_dep = _decode(e['attrs'].get(c_parent, '')) if c_parent else ''
            did = dep_pcode_idx.get(pcode_dep, departements[0]['id'] if departements else 1)
            arrondissements.append({
                'id': i,
                'nom': nom,
                'pcode': pcode,
                'code': pcode,
                'departement_id': did,
                'pcode_departement': pcode_dep,
                'geom': e['geom'],
                'attrs': e['attrs'],
            })
    arr_pcode_idx = {a['pcode']: a['id'] for a in arrondissements}

    # ── 4. Communes ──────────────────────────────────────────────────────────
    fields_c, recs_c = _lire_shp(SHP_ADMIN4)
    communes = []
    if fields_c:
        print(f'[admin_shp_service] Admin4 colonnes: {fields_c}')
        c_nom    = _col(fields_c, ['NOM', 'NAME', 'COMMUNE', 'NOM_COM', 'ADM4_FR', 'ADM4_EN'])
        c_pcode  = _col(fields_c, ['PCODE', 'ADM4_PCODE', 'CODE'])
        c_parent = _col(fields_c, ['ADMIN3_PCO', 'ADM3_PCODE', 'CODE_ARR', 'NOM_ARR', 'ARRONDISSE'])
        c_dep    = _col(fields_c, ['ADMIN2_PCO', 'ADM2_PCODE', 'CODE_DEP'])
        for i, e in enumerate(recs_c, start=1):
            nom = _title(_decode(e['attrs'].get(c_nom, ''))) if c_nom else f'Commune {i}'
            if not nom or nom.lower() in ('nan', 'none', ''):
                continue
            pcode = _decode(e['attrs'].get(c_pcode, str(i))) if c_pcode else str(i)
            pcode_arr = _decode(e['attrs'].get(c_parent, '')) if c_parent else ''
            pcode_dep = _decode(e['attrs'].get(c_dep, '')) if c_dep else ''
            aid = arr_pcode_idx.get(pcode_arr)
            did = dep_pcode_idx.get(pcode_dep, departements[0]['id'] if departements else 1)
            communes.append({
                'id': i,
                'nom': nom,
                'pcode': pcode,
                'code': pcode,
                'departement_id': did,
                'arrondissement_id': aid,
                'pcode_arrondissement': pcode_arr,
                'pcode_departement': pcode_dep,
                'geom': e['geom'],
                'attrs': e['attrs'],
            })

    _CACHE['regions']         = regions
    _CACHE['departements']    = departements
    _CACHE['arrondissements'] = arrondissements
    _CACHE['communes']        = communes
    print(f'[admin_shp_service] Cache PCODE: '
          f'{len(regions)} regions, {len(departements)} departements, '
          f'{len(arrondissements)} arrondissements, {len(communes)} communes')


# ─── API publique ─────────────────────────────────────────────────────────────

def get_regions():
    _build_cache()
    return [{'id': r['id'], 'nom': r['nom'], 'pcode': r['pcode'], 'code': r['code']}
            for r in _CACHE['regions']]


def get_departements_par_region(region_id):
    _build_cache()
    return [{'id': d['id'], 'nom': d['nom'], 'pcode': d['pcode'],
             'code': d['code'], 'region_id': d['region_id']}
            for d in _CACHE['departements'] if d['region_id'] == region_id]


def get_arrondissements_par_departement(dep_id):
    _build_cache()
    return [{'id': a['id'], 'nom': a['nom'], 'pcode': a['pcode'],
             'code': a['code'], 'departement_id': a['departement_id']}
            for a in _CACHE['arrondissements'] if a['departement_id'] == dep_id]


def get_communes_par_departement(dep_id):
    _build_cache()
    return [{'id': c['id'], 'nom': c['nom'], 'pcode': c['pcode'],
             'code': c['code'], 'departement_id': c['departement_id'],
             'arrondissement_id': c['arrondissement_id']}
            for c in _CACHE['communes'] if c['departement_id'] == dep_id]


def get_communes_par_arrondissement(arr_id):
    _build_cache()
    return [{'id': c['id'], 'nom': c['nom'], 'pcode': c['pcode'],
             'code': c['code'], 'departement_id': c['departement_id'],
             'arrondissement_id': c['arrondissement_id']}
            for c in _CACHE['communes'] if c['arrondissement_id'] == arr_id]


def get_toutes_communes():
    _build_cache()
    return [{'id': c['id'], 'nom': c['nom'], 'pcode': c['pcode'],
             'code': c['code'], 'departement_id': c['departement_id'],
             'arrondissement_id': c['arrondissement_id']}
            for c in _CACHE['communes']]


def get_tous_arrondissements():
    _build_cache()
    return [{'id': a['id'], 'nom': a['nom'], 'pcode': a['pcode'],
             'code': a['code'], 'departement_id': a['departement_id']}
            for a in _CACHE['arrondissements']]


def get_commune(commune_id):
    _build_cache()
    for c in _CACHE['communes']:
        if c['id'] == commune_id:
            return c
    return None


def get_arrondissement(arr_id):
    _build_cache()
    for a in _CACHE['arrondissements']:
        if a['id'] == arr_id:
            return a
    return None


def search_communes(q):
    _build_cache()
    q_low = q.lower()
    return [{'id': c['id'], 'nom': c['nom'], 'pcode': c['pcode'],
             'code': c['code'], 'departement_id': c['departement_id'],
             'arrondissement_id': c['arrondissement_id']}
            for c in _CACHE['communes'] if q_low in c['nom'].lower()][:20]


def search_arrondissements(q):
    _build_cache()
    q_low = q.lower()
    return [{'id': a['id'], 'nom': a['nom'], 'pcode': a['pcode'],
             'code': a['code'], 'departement_id': a['departement_id']}
            for a in _CACHE['arrondissements'] if q_low in a['nom'].lower()][:20]
