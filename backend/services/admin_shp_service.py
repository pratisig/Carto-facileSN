"""Lecture des limites administratives directement depuis les SHP.
4 niveaux administratifs du Sénégal :
  1. Région         → LA_REGION_S
  2. Département    → LA_DEPARTEMENT_S
  3. Arrondissement → LA_ARRONDISSEMENT_S
  4. Commune        → SEN_Admin4_a_gadm
"""
import os
import json
import shapefile

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

ENCODINGS = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']


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
    """Capitalise proprement un nom géographique."""
    if not s:
        return s
    return ' '.join(w.capitalize() for w in s.strip().split())


def _norm(s):
    if not s:
        return ''
    s = s.strip().lower()
    for a, b in [('é','e'),('è','e'),('ê','e'),('à','a'),('â','a'),
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
    enc = 'latin-1'
    if os.path.exists(cpg):
        try:
            enc = open(cpg, encoding='ascii', errors='ignore').read().strip() or 'latin-1'
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
    upper = {f.upper(): f for f in fields}
    for c in candidats:
        if c.upper() in upper:
            return upper[c.upper()]
    return None


def _match_parent(nom_raw, parent_idx, parent_list):
    """Retrouve l'ID parent par nom normalisé avec fallback partiel."""
    nom_norm = _norm(nom_raw)
    pid = parent_idx.get(nom_norm)
    if pid is None:
        for pn, pid2 in parent_idx.items():
            if nom_norm and (nom_norm in pn or pn in nom_norm):
                pid = pid2
                break
    if pid is None:
        pid = parent_list[0]['id'] if parent_list else 1
    return pid


# ─── Cache en mémoire ────────────────────────────────────────────────────────
_CACHE = {}


def _build_cache():
    global _CACHE
    if _CACHE:
        return

    # ── 1. Régions ───────────────────────────────────────────────────────────
    fields_r, recs_r = _lire_shp('LA_REGION_S')
    regions = []
    if fields_r:
        c_nom  = _col(fields_r, ['NOM', 'REGION', 'NAME', 'NOM_REG'])
        c_code = _col(fields_r, ['CODE', 'CODE_REG'])
        for i, e in enumerate(recs_r, start=1):
            nom = _title(e['attrs'].get(c_nom, '')) if c_nom else f'Région {i}'
            if not nom or nom.lower() in ('nan', 'none', ''):
                continue
            regions.append({
                'id': i,
                'nom': nom,
                'code': e['attrs'].get(c_code, '') if c_code else '',
                'geom': e['geom'],
            })

    # ── 2. Départements ──────────────────────────────────────────────────────
    fields_d, recs_d = _lire_shp('LA_DEPARTEMENT_S')
    departements = []
    if fields_d:
        c_nom  = _col(fields_d, ['NOM', 'DEPARTEMEN', 'NAME', 'NOM_DEP'])
        c_code = _col(fields_d, ['CODE', 'CODE_DEP'])
        c_reg  = _col(fields_d, ['NOM_REGION', 'REGION', 'NOM_REG', 'NOM_R'])
        reg_idx = {_norm(r['nom']): r['id'] for r in regions}

        for i, e in enumerate(recs_d, start=1):
            nom = _title(e['attrs'].get(c_nom, '')) if c_nom else f'Département {i}'
            if not nom or nom.lower() in ('nan', 'none', ''):
                continue
            nom_reg_raw = e['attrs'].get(c_reg, '') if c_reg else ''
            rid = _match_parent(nom_reg_raw, reg_idx, regions)
            departements.append({
                'id': i,
                'nom': nom,
                'code': e['attrs'].get(c_code, '') if c_code else '',
                'region_id': rid,
                'geom': e['geom'],
            })

    # ── 3. Arrondissements ───────────────────────────────────────────────────
    fields_a, recs_a = _lire_shp('LA_ARRONDISSEMENT_S')
    arrondissements = []
    if fields_a:
        c_nom  = _col(fields_a, ['NOM', 'ARRONDISSE', 'NAME', 'NOM_ARR'])
        c_code = _col(fields_a, ['CODE', 'CODE_ARR'])
        c_dep  = _col(fields_a, ['NOM_DEP', 'DEPARTEMEN', 'DEP', 'NOM_D'])
        dep_idx = {_norm(d['nom']): d['id'] for d in departements}

        for i, e in enumerate(recs_a, start=1):
            nom = _title(e['attrs'].get(c_nom, f'Arrondissement {i}')) if c_nom else f'Arrondissement {i}'
            if not nom or nom.lower() in ('nan', 'none', ''):
                continue
            nom_dep_raw = e['attrs'].get(c_dep, '') if c_dep else ''
            did = _match_parent(nom_dep_raw, dep_idx, departements)
            arrondissements.append({
                'id': i,
                'nom': nom,
                'code': e['attrs'].get(c_code, '') if c_code else '',
                'departement_id': did,
                'geom': e['geom'],
            })

    # ── 4. Communes (SEN_Admin4_a_gadm - source GADM) ────────────────────────
    fields_c, recs_c = _lire_shp('SEN_Admin4_a_gadm')
    communes = []
    if fields_c:
        # Colonnes GADM : NAME_4=commune, NAME_3=arrondissement, NAME_2=département, NAME_1=région
        c_nom  = _col(fields_c, ['NAME_4', 'NOM_COM', 'NOM', 'NAME', 'COMMUNE'])
        c_dep  = _col(fields_c, ['NAME_2', 'NOM_DEP', 'DEPARTEMEN'])
        c_arr  = _col(fields_c, ['NAME_3', 'NOM_ARR', 'ARRONDISSE'])
        c_code = _col(fields_c, ['GID_4', 'CODE_COM', 'CODE'])

        dep_idx = {_norm(d['nom']): d['id'] for d in departements}
        arr_idx = {_norm(a['nom']): a['id'] for a in arrondissements}

        for i, e in enumerate(recs_c, start=1):
            nom = _title(e['attrs'].get(c_nom, f'Commune {i}')) if c_nom else f'Commune {i}'
            if not nom or nom.lower() in ('nan', 'none', ''):
                continue

            # Rattachement au département
            nom_dep_raw = e['attrs'].get(c_dep, '') if c_dep else ''
            did = _match_parent(nom_dep_raw, dep_idx, departements)

            # Rattachement à l'arrondissement (optionnel)
            nom_arr_raw = e['attrs'].get(c_arr, '') if c_arr else ''
            aid = _match_parent(nom_arr_raw, arr_idx, arrondissements) if nom_arr_raw else None

            communes.append({
                'id': i,
                'nom': nom,
                'code': e['attrs'].get(c_code, '') if c_code else '',
                'departement_id': did,
                'arrondissement_id': aid,
                'geom': e['geom'],
            })

    _CACHE['regions']          = regions
    _CACHE['departements']     = departements
    _CACHE['arrondissements']  = arrondissements
    _CACHE['communes']         = communes
    print(f'[admin_shp_service] Cache: {len(regions)} régions, '
          f'{len(departements)} départements, '
          f'{len(arrondissements)} arrondissements, '
          f'{len(communes)} communes')


# ─── API publique ─────────────────────────────────────────────────────────────

def get_regions():
    _build_cache()
    return [{'id': r['id'], 'nom': r['nom'], 'code': r['code']}
            for r in _CACHE['regions']]


def get_departements_par_region(region_id):
    _build_cache()
    return [{'id': d['id'], 'nom': d['nom'], 'code': d['code'], 'region_id': d['region_id']}
            for d in _CACHE['departements'] if d['region_id'] == region_id]


def get_arrondissements_par_departement(dep_id):
    _build_cache()
    return [{'id': a['id'], 'nom': a['nom'], 'code': a['code'], 'departement_id': a['departement_id']}
            for a in _CACHE['arrondissements'] if a['departement_id'] == dep_id]


def get_communes_par_departement(dep_id):
    _build_cache()
    return [{'id': c['id'], 'nom': c['nom'], 'code': c['code'],
              'departement_id': c['departement_id'],
              'arrondissement_id': c['arrondissement_id']}
            for c in _CACHE['communes'] if c['departement_id'] == dep_id]


def get_communes_par_arrondissement(arr_id):
    _build_cache()
    return [{'id': c['id'], 'nom': c['nom'], 'code': c['code'],
              'departement_id': c['departement_id'],
              'arrondissement_id': c['arrondissement_id']}
            for c in _CACHE['communes'] if c['arrondissement_id'] == arr_id]


def get_toutes_communes():
    _build_cache()
    return [{'id': c['id'], 'nom': c['nom'], 'code': c['code'],
              'departement_id': c['departement_id'],
              'arrondissement_id': c['arrondissement_id']}
            for c in _CACHE['communes']]


def get_tous_arrondissements():
    _build_cache()
    return [{'id': a['id'], 'nom': a['nom'], 'code': a['code'],
              'departement_id': a['departement_id']}
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
    return [{'id': c['id'], 'nom': c['nom'], 'code': c['code'],
              'departement_id': c['departement_id'],
              'arrondissement_id': c['arrondissement_id']}
            for c in _CACHE['communes'] if q_low in c['nom'].lower()][:20]


def search_arrondissements(q):
    _build_cache()
    q_low = q.lower()
    return [{'id': a['id'], 'nom': a['nom'], 'code': a['code'],
              'departement_id': a['departement_id']}
            for a in _CACHE['arrondissements'] if q_low in a['nom'].lower()][:20]
