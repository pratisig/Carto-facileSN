"""
Cache mémoire centralisé pour tous les GeoJSON.
Chaque SHP est lu UNE SEULE FOIS au démarrage du serveur.
"""
import os
import json
import functools
from services.admin_shp_service import _lire_shp, _col, _title, _decode

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

COUCHES_ADMIN = {
    'regions':         'LA_REGION_S',
    'departements':    'LA_DEPARTEMENT_S',
    'arrondissements': 'LA_ARRONDISSEMENT_S',
    'communes':        'SEN_Admin4_a_gadm',
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


def _shp_to_geojson(nom_shp, niveau=None):
    """Lit un SHP et retourne un FeatureCollection GeoJSON complet."""
    chemin = os.path.join(DATA_DIR, f'{nom_shp}.shp')
    if not os.path.exists(chemin):
        print(f'[geo_cache] SHP introuvable: {chemin}')
        return {'type': 'FeatureCollection', 'features': []}

    fields, records = _lire_shp(nom_shp)
    if not fields:
        return {'type': 'FeatureCollection', 'features': []}

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

        if niveau:
            nom_col = _col(fields, ['NOM', 'NAME', 'NAME_4', 'NAME_3',
                                     'NAME_2', 'NAME_1', 'REGION', 'DEPARTEMEN'])
            if nom_col:
                props['_nom'] = _title(_decode(rec['attrs'].get(nom_col, '')))
            props['_niveau'] = niveau

        features.append({
            'type': 'Feature',
            'geometry': geom,
            'properties': props,
        })

    print(f'[geo_cache] {nom_shp}: {len(features)} features chargées')
    return {'type': 'FeatureCollection', 'features': features}


@functools.lru_cache(maxsize=None)
def get_geojson_admin(niveau: str):
    """Retourne le GeoJSON complet d'un niveau admin (mis en cache)."""
    nom_shp = COUCHES_ADMIN.get(niveau)
    if not nom_shp:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': 'Niveau inconnu'}
    return _shp_to_geojson(nom_shp, niveau=niveau)


@functools.lru_cache(maxsize=None)
def get_geojson_thematique(couche: str):
    """Retourne le GeoJSON complet d'une couche thématique (mis en cache)."""
    nom_shp = COUCHES_THEMATIQUES.get(couche)
    if not nom_shp:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': 'Couche inconnue'}
    return _shp_to_geojson(nom_shp)


def prechauffer_cache():
    """Pré-charge tous les GeoJSON admin au démarrage Flask."""
    print('[geo_cache] Préchauffage du cache GeoJSON...')
    for niveau in COUCHES_ADMIN:
        get_geojson_admin(niveau)
    print('[geo_cache] Cache admin prêt ✓')
