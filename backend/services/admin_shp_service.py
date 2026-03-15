"""Lecture des limites administratives depuis les SHP SEN_Admin1 a 4.

La colonne de nom est NAME_LOCAL pour les 4 niveaux.
"""
import os
import json
import shapefile

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

ENCODINGS = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']

SHP_ADMIN1 = 'SEN_Admin1'
SHP_ADMIN2 = 'SEN_Admin2'
SHP_ADMIN3 = 'SEN_Admin3'
SHP_ADMIN4 = 'SEN_Admin4'

# Candidats NOM — NAME_LOCAL en premier
NOM_COLS    = ['NAME_LOCAL', 'NOM', 'NAME', 'ADM1_FR', 'ADM2_FR', 'ADM3_FR', 'ADM4_FR',
               'ADM1_EN', 'ADM2_EN', 'ADM3_EN', 'ADM4_EN',
               'REGION', 'DEPARTEMEN', 'ARRONDISSE', 'COMMUNE']
PCODE_COLS  = ['PCODE', 'ADM1_PCODE', 'ADM2_PCODE', 'ADM3_PCODE', 'ADM4_PCODE', 'CODE']
P1_COLS     = ['ADMIN1_PCO', 'ADM1_PCODE']
P2_COLS     = ['ADMIN2_PCO', 'ADM2_PCODE']
P3_COLS     = ['ADMIN3_PCO', 'ADM3_PCODE']


def _decode(v):
    if isinstance(v, bytes):
        for enc in ENCODINGS:
            try: return v.decode(enc).strip()
            except: continue
        return v.decode('latin-1', errors='replace').strip()
    return '' if v is None else str(v).strip()


def _title(s):
    if not s: return s
    return ' '.join(w.capitalize() for w in s.strip().split())


def _norm(s):
    if not s: return ''
    s = s.strip().lower()
    for a, b in [('\u00e9','e'),('\u00e8','e'),('\u00ea','e'),('\u00e0','a'),('\u00e2','a'),
                 ('\u00f4','o'),('\u00f9','u'),('\u00fb','u'),('\u00ee','i'),('\u00e7','c')]:
        s = s.replace(a, b)
    return s


def _col(fields, candidats):
    upper = {f.upper(): f for f in (fields or [])}
    for c in candidats:
        if c.upper() in upper:
            return upper[c.upper()]
    return None


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
        try: enc = open(cpg, encoding='ascii', errors='ignore').read().strip() or 'utf-8'
        except: pass
    try:
        try:    sf = shapefile.Reader(chemin, encoding=enc)
        except: sf = shapefile.Reader(chemin, encoding='latin-1')
        fields  = [_decode(f[0]) for f in sf.fields[1:]]
        records = []
        for sr in sf.shapeRecords():
            attrs = {fields[i]: _decode(sr.record[i]) for i in range(len(fields))}
            try:    geom = json.dumps(sr.shape.__geo_interface__)
            except: geom = None
            records.append({'attrs': attrs, 'geom': geom})
        return fields, records
    except Exception as e:
        print(f'[admin_shp_service] Erreur lecture {nom}: {e}')
        return None, []


# ── Cache memoire ────────────────────────────────────────────────────────────
_CACHE = {}


def _get_nom(attrs, fields):
    c = _col(fields, NOM_COLS)
    if c:
        v = _title(_decode(attrs.get(c, '')))
        if v and v.lower() not in ('nan', 'none', ''): return v
    # fallback: premiere colonne string non vide
    for k, v in attrs.items():
        v2 = _decode(v)
        if v2 and v2.lower() not in ('nan', 'none') and len(v2) > 1:
            return _title(v2)
    return ''


def _build_cache():
    global _CACHE
    if _CACHE: return

    def build_level(shp_name, label):
        fields, recs = _lire_shp(shp_name)
        if not fields:
            return [], {}
        print(f'[admin_shp_service] {shp_name} colonnes: {fields}')
        c_pcode  = _col(fields, PCODE_COLS)
        c_p1     = _col(fields, P1_COLS)
        c_p2     = _col(fields, P2_COLS)
        c_p3     = _col(fields, P3_COLS)
        items = []
        for i, e in enumerate(recs, start=1):
            nom   = _get_nom(e['attrs'], fields) or f'{label} {i}'
            pcode = _decode(e['attrs'].get(c_pcode, str(i))) if c_pcode else str(i)
            items.append({
                'id': i, 'nom': nom, 'pcode': pcode, 'code': pcode,
                'pcode_region': _decode(e['attrs'].get(c_p1,'')) if c_p1 else '',
                'pcode_dep':    _decode(e['attrs'].get(c_p2,'')) if c_p2 else '',
                'pcode_arr':    _decode(e['attrs'].get(c_p3,'')) if c_p3 else '',
                'geom': e['geom'], 'attrs': e['attrs'],
            })
        idx = {it['pcode']: it['id'] for it in items}
        return items, idx

    regs,  reg_idx  = build_level(SHP_ADMIN1, 'Region')
    deps,  dep_idx  = build_level(SHP_ADMIN2, 'Departement')
    arrs,  arr_idx  = build_level(SHP_ADMIN3, 'Arrondissement')
    coms,  com_idx  = build_level(SHP_ADMIN4, 'Commune')

    # Lier les IDs parents
    for d in deps:
        d['region_id'] = reg_idx.get(d['pcode_region'], regs[0]['id'] if regs else 1)
    for a in arrs:
        a['departement_id'] = dep_idx.get(a['pcode_dep'], deps[0]['id'] if deps else 1)
    for c in coms:
        c['departement_id']    = dep_idx.get(c['pcode_dep'], deps[0]['id'] if deps else 1)
        c['arrondissement_id'] = arr_idx.get(c['pcode_arr'])

    _CACHE['regions']         = regs
    _CACHE['departements']    = deps
    _CACHE['arrondissements'] = arrs
    _CACHE['communes']        = coms
    print(f'[admin_shp_service] Cache: {len(regs)} regions, {len(deps)} deps, '
          f'{len(arrs)} arrs, {len(coms)} communes')
    if regs:  print(f'  Ex region:  {regs[0]["nom"]} ({regs[0]["pcode"]})')
    if deps:  print(f'  Ex dep:     {deps[0]["nom"]} ({deps[0]["pcode"]})')
    if arrs:  print(f'  Ex arr:     {arrs[0]["nom"]} ({arrs[0]["pcode"]})')
    if coms:  print(f'  Ex commune: {coms[0]["nom"]} ({coms[0]["pcode"]})')


# ── API publique ───────────────────────────────────────────────────────────────

def get_regions():
    _build_cache()
    return [{'id':r['id'],'nom':r['nom'],'pcode':r['pcode'],'code':r['code']}
            for r in _CACHE['regions']]

def get_departements_par_region(region_id):
    _build_cache()
    return [{'id':d['id'],'nom':d['nom'],'pcode':d['pcode'],'code':d['code'],'region_id':d['region_id']}
            for d in _CACHE['departements'] if d['region_id']==region_id]

def get_arrondissements_par_departement(dep_id):
    _build_cache()
    return [{'id':a['id'],'nom':a['nom'],'pcode':a['pcode'],'code':a['code'],'departement_id':a['departement_id']}
            for a in _CACHE['arrondissements'] if a['departement_id']==dep_id]

def get_communes_par_departement(dep_id):
    _build_cache()
    return [{'id':c['id'],'nom':c['nom'],'pcode':c['pcode'],'code':c['code'],
             'departement_id':c['departement_id'],'arrondissement_id':c['arrondissement_id']}
            for c in _CACHE['communes'] if c['departement_id']==dep_id]

def get_communes_par_arrondissement(arr_id):
    _build_cache()
    return [{'id':c['id'],'nom':c['nom'],'pcode':c['pcode'],'code':c['code'],
             'departement_id':c['departement_id'],'arrondissement_id':c['arrondissement_id']}
            for c in _CACHE['communes'] if c['arrondissement_id']==arr_id]

def get_toutes_communes():
    _build_cache()
    return [{'id':c['id'],'nom':c['nom'],'pcode':c['pcode'],'code':c['code'],
             'departement_id':c['departement_id'],'arrondissement_id':c['arrondissement_id']}
            for c in _CACHE['communes']]

def get_tous_arrondissements():
    _build_cache()
    return [{'id':a['id'],'nom':a['nom'],'pcode':a['pcode'],'code':a['code'],
             'departement_id':a['departement_id']}
            for a in _CACHE['arrondissements']]

def get_commune(commune_id):
    _build_cache()
    for c in _CACHE['communes']:
        if c['id']==commune_id: return c
    return None

def get_arrondissement(arr_id):
    _build_cache()
    for a in _CACHE['arrondissements']:
        if a['id']==arr_id: return a
    return None

def search_communes(q):
    _build_cache()
    q_low = q.lower()
    return [{'id':c['id'],'nom':c['nom'],'pcode':c['pcode'],'code':c['code'],
             'departement_id':c['departement_id'],'arrondissement_id':c['arrondissement_id']}
            for c in _CACHE['communes'] if q_low in c['nom'].lower()][:20]

def search_arrondissements(q):
    _build_cache()
    q_low = q.lower()
    return [{'id':a['id'],'nom':a['nom'],'pcode':a['pcode'],'code':a['code'],
             'departement_id':a['departement_id']}
            for a in _CACHE['arrondissements'] if q_low in a['nom'].lower()][:20]
