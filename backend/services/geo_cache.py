"""Cache GeoJSON centralise — lit les SHP SEN_Admin1 a 4 une seule fois.

Structure attendue des SHP :
  SEN_Admin1 : PCODE, NOM (ou NAME/ADM1_FR)
  SEN_Admin2 : PCODE, NOM, ADMIN1_PCO
  SEN_Admin3 : PCODE, NOM, ADMIN1_PCO, ADMIN2_PCO
  SEN_Admin4 : PCODE, NOM, ADMIN1_PCO, ADMIN2_PCO, ADMIN3_PCO
"""
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
    'frontieres':       'LA_FRONTIERE_INTERNATIONALE_L',
    'surfaces_boisees': 'VE_SURFACE_BOISEE_S',
}

# Colonne NOM par niveau
NOM_CANDIDATS = {
    'regions':         ['NOM', 'NAME', 'ADM1_FR', 'ADM1_EN', 'REGION'],
    'departements':    ['NOM', 'NAME', 'ADM2_FR', 'ADM2_EN', 'DEPARTEMEN'],
    'arrondissements': ['NOM', 'NAME', 'ADM3_FR', 'ADM3_EN', 'ARRONDISSE'],
    'communes':        ['NOM', 'NAME', 'ADM4_FR', 'ADM4_EN', 'COMMUNE'],
}


def _shp_to_geojson(nom_shp, niveau=None):
    """Lit un SHP et retourne un FeatureCollection GeoJSON avec proprietes normalisees."""
    chemin = os.path.join(DATA_DIR, f'{nom_shp}.shp')
    if not os.path.exists(chemin):
        print(f'[geo_cache] SHP introuvable: {chemin}')
        return {'type': 'FeatureCollection', 'features': []}

    fields, records = _lire_shp(nom_shp)
    if not fields:
        return {'type': 'FeatureCollection', 'features': []}

    print(f'[geo_cache] {nom_shp} colonnes: {fields}')

    # Detecter colonnes PCODE
    c_pcode    = _col(fields, ['PCODE', 'ADM1_PCODE', 'ADM2_PCODE', 'ADM3_PCODE', 'ADM4_PCODE', 'CODE'])
    c_admin1   = _col(fields, ['ADMIN1_PCO', 'ADM1_PCODE'])
    c_admin2   = _col(fields, ['ADMIN2_PCO', 'ADM2_PCODE'])
    c_admin3   = _col(fields, ['ADMIN3_PCO', 'ADM3_PCODE'])
    candidats_nom = NOM_CANDIDATS.get(niveau, ['NOM', 'NAME']) if niveau else ['NOM', 'NAME']
    c_nom      = _col(fields, candidats_nom)

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

        # Proprietes normalisees pour le frontend
        if c_nom:
            props['_nom'] = _title(_decode(rec['attrs'].get(c_nom, '')))
        if c_pcode:
            props['_pcode'] = _decode(rec['attrs'].get(c_pcode, ''))
        if c_admin1:
            props['_pcode_region'] = _decode(rec['attrs'].get(c_admin1, ''))
        if c_admin2:
            props['_pcode_dep'] = _decode(rec['attrs'].get(c_admin2, ''))
        if c_admin3:
            props['_pcode_arr'] = _decode(rec['attrs'].get(c_admin3, ''))
        if niveau:
            props['_niveau'] = niveau

        features.append({
            'type': 'Feature',
            'geometry': geom,
            'properties': props,
        })

    print(f'[geo_cache] {nom_shp}: {len(features)} features chargees')
    return {'type': 'FeatureCollection', 'features': features}


@functools.lru_cache(maxsize=None)
def get_geojson_admin(niveau: str):
    """Retourne le GeoJSON complet d'un niveau admin (mis en cache lru)."""
    nom_shp = COUCHES_ADMIN.get(niveau)
    if not nom_shp:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': 'Niveau inconnu'}
    return _shp_to_geojson(nom_shp, niveau=niveau)


@functools.lru_cache(maxsize=None)
def get_geojson_thematique(couche: str):
    """Retourne le GeoJSON complet d'une couche thematique (mis en cache)."""
    nom_shp = COUCHES_THEMATIQUES.get(couche)
    if not nom_shp:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': 'Couche inconnue'}
    return _shp_to_geojson(nom_shp)


def prechauffer_cache():
    """Pre-charge tous les GeoJSON admin au demarrage Flask."""
    print('[geo_cache] Prechauffage du cache GeoJSON...')
    for niveau in COUCHES_ADMIN:
        get_geojson_admin(niveau)
    print('[geo_cache] Cache admin pret')
