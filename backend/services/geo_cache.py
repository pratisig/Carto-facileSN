"""Cache GeoJSON centralise — lit les SHP SEN_Admin1 a 4 une seule fois."""
import os
import json
import functools
from services.admin_shp_service import _lire_shp, _col, _title, _decode

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

COUCHES_ADMIN = {
    'regions':         'SEN_Admin1',
    'departements':    'SEN_Admin2',
    'arrondissements': 'SEN_Admin3',
    'communes':        'SEN_Admin4',
}

COUCHES_THEMATIQUES = {
    'routes':           'TR_SEGMENT_ROUTIER_L',
    'chemin_fer':       'TR_CHEMIN_FER_L',
    'cours_eau':        'HD_COURS_EAU_SIMPLE_L',
    'plans_eau':        'HD_REGION_HYDRIQUE_S',
    'points_eau':       'BS_POINT_EAU_P',
    'aires_protegees':  'LX_AIRE_PROTEGEE_S',
    'courbes_niveau':   'FO_COURBE_NIVEAU_L',
    'sable':            'FO_SABLE_S',
    'agglomerations':   'BS_AGGLOMERATION_S',
    'aeroports':        'TR_AEROPORT_P',
    'localites':        'LA_LOCALITE_P',
    'frontieres':       'LA_FRONTIERE_INTERNATIONALE_FRONTIERE_ETAT_L',
    'surfaces_boisees': 'VE_SURFACE_BOISEE_S',
}

# Candidats NOM — NAME_LOCAL en premier pour les 4 niveaux
NOM_CANDIDATS = [
    'NAME_LOCAL', 'NOM', 'NAME', 'ADM1_FR', 'ADM2_FR', 'ADM3_FR', 'ADM4_FR',
    'ADM1_EN', 'ADM2_EN', 'ADM3_EN', 'ADM4_EN',
    'REGION', 'DEPARTEMEN', 'ARRONDISSE', 'COMMUNE', 'NOM_REG', 'NOM_DEP',
]

PCODE_CANDIDATS     = ['PCODE', 'ADM1_PCODE', 'ADM2_PCODE', 'ADM3_PCODE', 'ADM4_PCODE', 'CODE']
ADMIN1_CANDIDATS    = ['ADMIN1_PCO', 'ADM1_PCODE']
ADMIN2_CANDIDATS    = ['ADMIN2_PCO', 'ADM2_PCODE']
ADMIN3_CANDIDATS    = ['ADMIN3_PCO', 'ADM3_PCODE']


def _shp_to_geojson(nom_shp, niveau=None):
    chemin = os.path.join(DATA_DIR, f'{nom_shp}.shp')
    if not os.path.exists(chemin):
        print(f'[geo_cache] SHP introuvable: {chemin}')
        return {'type': 'FeatureCollection', 'features': []}

    fields, records = _lire_shp(nom_shp)
    if not fields:
        return {'type': 'FeatureCollection', 'features': []}

    print(f'[geo_cache] {nom_shp} colonnes: {fields}')

    c_nom    = _col(fields, NOM_CANDIDATS)
    c_pcode  = _col(fields, PCODE_CANDIDATS)
    c_admin1 = _col(fields, ADMIN1_CANDIDATS)
    c_admin2 = _col(fields, ADMIN2_CANDIDATS)
    c_admin3 = _col(fields, ADMIN3_CANDIDATS)

    print(f'[geo_cache] {nom_shp} -> col_nom={c_nom}, col_pcode={c_pcode}')

    features = []
    for i, rec in enumerate(records, start=1):
        if not rec.get('geom'):
            continue
        try:
            geom = json.loads(rec['geom']) if isinstance(rec['geom'], str) else rec['geom']
        except Exception:
            continue

        props = dict(rec['attrs'])
        props['_id'] = i

        # Nom : NAME_LOCAL prioritaire
        nom_val = ''
        if c_nom:
            nom_val = _title(_decode(rec['attrs'].get(c_nom, '')))
        # Si toujours vide, chercher dans toutes les colonnes string
        if not nom_val or nom_val.lower() in ('', 'nan', 'none'):
            for k, v in rec['attrs'].items():
                v_str = _decode(v)
                if v_str and v_str.lower() not in ('nan','none') and len(v_str) > 1:
                    nom_val = _title(v_str)
                    break
        if not nom_val:
            nom_val = f'{niveau or "entite"} {i}'

        props['_nom']   = nom_val
        props['_niveau'] = niveau or ''

        if c_pcode:
            props['_pcode'] = _decode(rec['attrs'].get(c_pcode, str(i)))
        else:
            props['_pcode'] = str(i)

        if c_admin1:
            props['_pcode_region'] = _decode(rec['attrs'].get(c_admin1, ''))
        if c_admin2:
            props['_pcode_dep']    = _decode(rec['attrs'].get(c_admin2, ''))
        if c_admin3:
            props['_pcode_arr']    = _decode(rec['attrs'].get(c_admin3, ''))

        features.append({'type': 'Feature', 'geometry': geom, 'properties': props})

    print(f'[geo_cache] {nom_shp}: {len(features)} features. Ex nom: {features[0]["properties"]["_nom"] if features else "N/A"}')
    return {'type': 'FeatureCollection', 'features': features}


@functools.lru_cache(maxsize=None)
def get_geojson_admin(niveau: str):
    nom_shp = COUCHES_ADMIN.get(niveau)
    if not nom_shp:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': 'Niveau inconnu'}
    return _shp_to_geojson(nom_shp, niveau=niveau)


@functools.lru_cache(maxsize=None)
def get_geojson_thematique(couche: str):
    nom_shp = COUCHES_THEMATIQUES.get(couche)
    if not nom_shp:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': 'Couche inconnue'}
    return _shp_to_geojson(nom_shp)


def prechauffer_cache():
    print('[geo_cache] Prechauffage du cache GeoJSON...')
    for niveau in COUCHES_ADMIN:
        get_geojson_admin(niveau)
    print('[geo_cache] Cache admin pret')
