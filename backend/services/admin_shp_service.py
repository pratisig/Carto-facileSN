"""Lecture des limites administratives directement depuis les SHP.
Pas de base de données - zéro problème d'encodage, zéro problème d'ID.
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
    # Conserver les accents déjà présents, juste normaliser la casse
    return ' '.join(w.capitalize() for w in s.strip().split())


def _lire_shp(nom):
    chemin = os.path.join(DATA_DIR, f'{nom}.shp')
    if not os.path.exists(chemin):
        return None, []
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


# ─── Cache en mémoire ────────────────────────────────────────────────────────
_CACHE = {}


def _build_cache():
    global _CACHE
    if _CACHE:
        return

    # ── Régions ──────────────────────────────────────────────────────────────
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

    # ── Départements ─────────────────────────────────────────────────────────
    fields_d, recs_d = _lire_shp('LA_DEPARTEMENT_S')
    departements = []
    if fields_d:
        c_nom  = _col(fields_d, ['NOM', 'DEPARTEMEN', 'NAME', 'NOM_DEP'])
        c_code = _col(fields_d, ['CODE', 'CODE_DEP'])
        c_reg  = _col(fields_d, ['NOM_REGION', 'REGION', 'NOM_REG', 'NOM_R'])

        # Index région par nom normalisé
        def _norm(s):
            if not s: return ''
            s = s.strip().lower()
            for a, b in [('é','e'),('è','e'),('ê','e'),('à','a'),('â','a'),
                         ('ô','o'),('ù','u'),('û','u'),('î','i'),('ç','c')]:
                s = s.replace(a, b)
            return s

        reg_idx = {_norm(r['nom']): r['id'] for r in regions}

        for i, e in enumerate(recs_d, start=1):
            nom = _title(e['attrs'].get(c_nom, '')) if c_nom else f'Département {i}'
            if not nom or nom.lower() in ('nan', 'none', ''):
                continue
            nom_reg_raw = e['attrs'].get(c_reg, '') if c_reg else ''
            nom_reg_norm = _norm(nom_reg_raw)
            rid = reg_idx.get(nom_reg_norm)
            if rid is None:
                # Recherche partielle
                for rn, rid2 in reg_idx.items():
                    if nom_reg_norm and (nom_reg_norm in rn or rn in nom_reg_norm):
                        rid = rid2
                        break
            if rid is None:
                rid = regions[0]['id'] if regions else 1
            departements.append({
                'id': i,
                'nom': nom,
                'code': e['attrs'].get(c_code, '') if c_code else '',
                'region_id': rid,
                'geom': e['geom'],
            })

    # ── Communes (LA_ARRONDISSEMENT_S = 122 entités IGN) ─────────────────────
    fields_c, recs_c = _lire_shp('LA_ARRONDISSEMENT_S')
    communes = []
    if fields_c:
        c_nom  = _col(fields_c, ['NOM_COM', 'NOM', 'NAME', 'COMMUNE'])
        c_code = _col(fields_c, ['CODE_COM', 'CODE'])
        c_dep  = _col(fields_c, ['NOM_DEP', 'DEPARTEMEN', 'DEP', 'NOM_D'])
        c_pop  = _col(fields_c, ['POPULATION', 'POP'])
        c_sup  = _col(fields_c, ['SUPERFICIE', 'Shape_Area', 'AREA'])

        def _norm(s):
            if not s: return ''
            s = s.strip().lower()
            for a, b in [('é','e'),('è','e'),('ê','e'),('à','a'),('â','a'),
                         ('ô','o'),('ù','u'),('û','u'),('î','i'),('ç','c')]:
                s = s.replace(a, b)
            return s

        dep_idx = {_norm(d['nom']): d['id'] for d in departements}

        for i, e in enumerate(recs_c, start=1):
            nom = _title(e['attrs'].get(c_nom, f'Commune {i}')) if c_nom else f'Commune {i}'
            if not nom or nom.lower() in ('nan', 'none', ''):
                continue
            nom_dep_raw = e['attrs'].get(c_dep, '') if c_dep else ''
            nom_dep_norm = _norm(nom_dep_raw)
            did = dep_idx.get(nom_dep_norm)
            if did is None:
                for dn, did2 in dep_idx.items():
                    if nom_dep_norm and (nom_dep_norm in dn or dn in nom_dep_norm):
                        did = did2
                        break
            if did is None:
                did = departements[0]['id'] if departements else 1
            try:
                pop = int(float(e['attrs'].get(c_pop, 0))) if c_pop else None
            except Exception:
                pop = None
            try:
                sup = float(e['attrs'].get(c_sup, 0)) if c_sup else None
            except Exception:
                sup = None
            communes.append({
                'id': i,
                'nom': nom,
                'code': e['attrs'].get(c_code, '') if c_code else '',
                'departement_id': did,
                'population': pop,
                'superficie_km2': sup,
                'geom': e['geom'],
            })

    _CACHE['regions']     = regions
    _CACHE['departements'] = departements
    _CACHE['communes']    = communes
    print(f'[admin_shp_service] Cache: {len(regions)} régions, '
          f'{len(departements)} départements, {len(communes)} communes')


# ─── API publique ─────────────────────────────────────────────────────────────

def get_regions():
    _build_cache()
    return [{'id': r['id'], 'nom': r['nom'], 'code': r['code']}
            for r in _CACHE['regions']]


def get_departements_par_region(region_id):
    _build_cache()
    return [{'id': d['id'], 'nom': d['nom'], 'code': d['code'], 'region_id': d['region_id']}
            for d in _CACHE['departements'] if d['region_id'] == region_id]


def get_communes_par_departement(dep_id):
    _build_cache()
    return [{'id': c['id'], 'nom': c['nom'], 'code': c['code'],
              'departement_id': c['departement_id'],
              'population': c['population'], 'superficie_km2': c['superficie_km2']}
            for c in _CACHE['communes'] if c['departement_id'] == dep_id]


def get_toutes_communes():
    _build_cache()
    return [{'id': c['id'], 'nom': c['nom'], 'code': c['code'],
              'departement_id': c['departement_id']}
            for c in _CACHE['communes']]


def get_commune(commune_id):
    _build_cache()
    for c in _CACHE['communes']:
        if c['id'] == commune_id:
            return c
    return None


def search_communes(q):
    _build_cache()
    q_low = q.lower()
    return [{'id': c['id'], 'nom': c['nom'], 'code': c['code'],
              'departement_id': c['departement_id']}
            for c in _CACHE['communes'] if q_low in c['nom'].lower()][:20]
