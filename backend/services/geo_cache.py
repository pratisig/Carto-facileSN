"""Cache GeoJSON centralise -- lit les SHP une seule fois en memoire."""
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

# Colonnes NOM generiques
NOM_CANDIDATS = [
    'NAME_LOCAL', 'NOM', 'NAME', 'ADM1_FR', 'ADM2_FR', 'ADM3_FR', 'ADM4_FR',
    'ADM1_EN', 'ADM2_EN', 'ADM3_EN', 'ADM4_EN',
    'REGION', 'DEPARTEMEN', 'ARRONDISSE', 'COMMUNE', 'NOM_REG', 'NOM_DEP',
]
# Colonnes NOM specifiques aux couches thematiques ponctuelles
NOM_CANDIDATS_THEMATIQUES = [
    # Localites (LA_LOCALITE_P) -- colonnes les plus probables d'abord
    'NOMLOCAL', 'NOM_LOCAL', 'NOM_LOCALE', 'NOM_LOCALIT', 'NOMLOC',
    'NOM_LOC', 'LOCALITE', 'NOM_LOCALITE',
    # Villages / quartiers
    'VILLAGE', 'HAMEAU', 'QUARTIER', 'LIEU_DIT', 'LIEUDIT',
    # Points d'eau / aeroports
    'NOM_POINT', 'NOM_AERO', 'NOM_AEROPORT', 'NOM_SITE',
    # Generiques
    'LABEL', 'TOPONYME', 'APPELLATION',
] + NOM_CANDIDATS

PCODE_CANDIDATS  = ['PCODE', 'ADM1_PCODE', 'ADM2_PCODE', 'ADM3_PCODE', 'ADM4_PCODE', 'CODE']
ADMIN1_CANDIDATS = ['ADMIN1_PCO', 'ADM1_PCODE']
ADMIN2_CANDIDATS = ['ADMIN2_PCO', 'ADM2_PCODE']
ADMIN3_CANDIDATS = ['ADMIN3_PCO', 'ADM3_PCODE']

# Cache manuel pour les couches thematiques
_CACHE_THEMATIQUES = {}


def _shp_to_geojson(nom_shp, niveau=None, est_thematique=False):
    chemin = os.path.join(DATA_DIR, f'{nom_shp}.shp')
    if not os.path.exists(chemin):
        print(f'[geo_cache] SHP introuvable: {chemin}')
        return {'type': 'FeatureCollection', 'features': []}

    fields, records = _lire_shp(nom_shp)
    if not fields:
        return {'type': 'FeatureCollection', 'features': []}

    print(f'[geo_cache] {nom_shp} colonnes: {fields}')

    # Choisir la liste de candidats selon le type de couche
    candidats_nom = NOM_CANDIDATS_THEMATIQUES if est_thematique else NOM_CANDIDATS
    c_nom    = _col(fields, candidats_nom)
    c_pcode  = _col(fields, PCODE_CANDIDATS)
    c_admin1 = _col(fields, ADMIN1_CANDIDATS)
    c_admin2 = _col(fields, ADMIN2_CANDIDATS)
    c_admin3 = _col(fields, ADMIN3_CANDIDATS)

    # Log pour debug: afficher les colonnes trouvees
    print(f'[geo_cache] {nom_shp} -> col_nom={c_nom} col_pcode={c_pcode}')

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

        # Extraction du nom
        nom_val = ''
        if c_nom:
            nom_val = _title(_decode(rec['attrs'].get(c_nom, '')))

        # Fallback 1: tester TOUTES les colonnes string pour trouver un nom
        if not nom_val or nom_val.lower() in ('', 'nan', 'none'):
            for k in fields:
                v_str = _decode(rec['attrs'].get(k, ''))
                if (v_str
                        and v_str.lower() not in ('nan', 'none', '0', '-1')
                        and len(v_str) > 1
                        and not v_str.replace('.','').replace('-','').isdigit()):
                    nom_val = _title(v_str)
                    break

        # Fallback 2: identifiant numerique
        if not nom_val:
            nom_val = f'{niveau or nom_shp} {i}'

        props['_nom']    = nom_val
        props['_niveau'] = niveau or ''
        props['_pcode']  = _decode(rec['attrs'].get(c_pcode, str(i))) if c_pcode else str(i)

        if c_admin1: props['_pcode_region'] = _decode(rec['attrs'].get(c_admin1, ''))
        if c_admin2: props['_pcode_dep']    = _decode(rec['attrs'].get(c_admin2, ''))
        if c_admin3: props['_pcode_arr']    = _decode(rec['attrs'].get(c_admin3, ''))

        features.append({'type': 'Feature', 'geometry': geom, 'properties': props})

    nb = len(features)
    print(f'[geo_cache] {nom_shp}: {nb} features. '
          f'Ex nom: {features[0]["properties"]["_nom"] if features else "N/A"}')
    return {'type': 'FeatureCollection', 'features': features}


@functools.lru_cache(maxsize=None)
def get_geojson_admin(niveau: str):
    nom_shp = COUCHES_ADMIN.get(niveau)
    if not nom_shp:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': 'Niveau inconnu'}
    return _shp_to_geojson(nom_shp, niveau=niveau, est_thematique=False)


def get_geojson_thematique(couche: str):
    """Retourne le GeoJSON d'une couche thematique (cache manuel)."""
    if couche in _CACHE_THEMATIQUES:
        return _CACHE_THEMATIQUES[couche]
    nom_shp = COUCHES_THEMATIQUES.get(couche)
    if not nom_shp:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': 'Couche inconnue'}
    # est_thematique=True pour utiliser les colonnes NOM specifiques
    data = _shp_to_geojson(nom_shp, est_thematique=True)
    _CACHE_THEMATIQUES[couche] = data
    return data


def prechauffer_cache():
    """Prechauffage complet au demarrage : admin + toutes les couches thematiques."""
    print('[geo_cache] === Prechauffage ADMIN ===')
    for niveau in COUCHES_ADMIN:
        try:
            get_geojson_admin(niveau)
        except Exception as e:
            print(f'[geo_cache] WARN admin {niveau}: {e}')

    print('[geo_cache] === Prechauffage THEMATIQUES ===')
    for couche in COUCHES_THEMATIQUES:
        try:
            data = get_geojson_thematique(couche)
            print(f'[geo_cache] OK {couche}: {len(data["features"])} features')
        except Exception as e:
            print(f'[geo_cache] WARN thematique {couche}: {e}')

    print(f'[geo_cache] Prechauffage termine. '
          f'{len(COUCHES_ADMIN)} admin + {len(COUCHES_THEMATIQUES)} thematiques en cache.')
