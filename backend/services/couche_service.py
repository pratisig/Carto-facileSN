import os
import json
import shapefile  # pyshp

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

CATALOGUE_COUCHES = {
    'routes':         {'shp': 'TR_SEGMENT_ROUTIER_L',  'couleur': '#888888', 'description': 'R\u00e9seau routier'},
    'chemin_fer':     {'shp': 'TR_CHEMIN_FER_L',       'couleur': '#444444', 'description': 'Chemins de fer'},
    'cours_eau':      {'shp': 'HD_COURS_EAU_SIMPLE_L', 'couleur': '#3498db', 'description': 'Cours d\'eau'},
    'plans_eau':      {'shp': 'HD_REGION_HYDRIQUE_S',  'couleur': '#85c1e9', 'description': 'Plans d\'eau'},
    'points_eau':     {'shp': 'BS_POINT_EAU_P',        'couleur': '#2980b9', 'description': 'Points d\'eau'},
    'aires_protegees':{'shp': 'LX_AIRE_PROTEGEE_S',    'couleur': '#1e8449', 'description': 'Aires prot\u00e9g\u00e9es'},
    'courbes_niveau': {'shp': 'FO_COURBE_NIVEAU_L',    'couleur': '#b7950b', 'description': 'Courbes de niveau'},
    'sable':          {'shp': 'FO_SABLE_S',            'couleur': '#f0e68c', 'description': 'Zones sableuses'},
    'agglomerations': {'shp': 'BS_AGGLOMERATION_S',    'couleur': '#e67e22', 'description': 'Agglom\u00e9rations'},
    'aeroports':      {'shp': 'TR_AEROPORT_P',         'couleur': '#2c3e50', 'description': 'A\u00e9roports'},
    'localites':      {'shp': 'LA_LOCALITE_P',         'couleur': '#c0392b', 'description': 'Localit\u00e9s'},
    'frontieres':     {'shp': 'LA_FRONTIERE_INTERNATIONALE_FRONTIERE_ETAT_L', 'couleur': '#2c3e50', 'description': 'Fronti\u00e8res'},
}


def get_catalogue():
    catalogue = []
    for cle, meta in CATALOGUE_COUCHES.items():
        shp_path = os.path.join(DATA_DIR, f"{meta['shp']}.shp")
        catalogue.append({
            'id': cle,
            'description': meta['description'],
            'couleur_defaut': meta['couleur'],
            'disponible': os.path.exists(shp_path),
            'source': 'IGN S\u00e9n\u00e9gal / Topo1M'
        })
    return catalogue


def _bbox_intersects(geom, minx, miny, maxx, maxy):
    """V\u00e9rification BBOX rapide sans shapely."""
    t = geom.get('type', '')
    coords = []
    if t == 'Point':
        coords = [geom['coordinates']]
    elif t in ('LineString', 'MultiPoint'):
        coords = geom['coordinates']
    elif t == 'Polygon':
        coords = geom['coordinates'][0] if geom['coordinates'] else []
    elif t == 'MultiPolygon':
        for poly in geom['coordinates']:
            coords += poly[0] if poly else []
    elif t == 'MultiLineString':
        for line in geom['coordinates']:
            coords += line
    if not coords:
        return True  # inclure si on ne sait pas
    xs = [c[0] for c in coords if len(c) >= 2]
    ys = [c[1] for c in coords if len(c) >= 2]
    if not xs:
        return True
    return not (max(xs) < minx or min(xs) > maxx or max(ys) < miny or min(ys) > maxy)


def _get_commune_bbox(commune_geom_json):
    """Extrait le bbox d'une g\u00e9om\u00e9trie GeoJSON."""
    geom = json.loads(commune_geom_json) if isinstance(commune_geom_json, str) else commune_geom_json
    t = geom.get('type', '')
    coords = []
    if t == 'Polygon':
        coords = geom['coordinates'][0]
    elif t == 'MultiPolygon':
        for poly in geom['coordinates']:
            coords += poly[0] if poly else []
    if not coords:
        return -180, -90, 180, 90
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    return min(xs), min(ys), max(xs), max(ys)


def _lire_shp_filtré(shp_name, minx, miny, maxx, maxy, max_features=2000):
    """Lit un SHP et filtre par BBOX sans geopandas."""
    shp_path = os.path.join(DATA_DIR, f'{shp_name}.shp')
    if not os.path.exists(shp_path):
        return []
    try:
        sf = shapefile.Reader(shp_path)
        fields = [f[0] for f in sf.fields[1:]]
        features = []
        # Buffer l\u00e9ger autour de la commune
        buf = 0.02
        for sr in sf.shapeRecords():
            geom = sr.shape.__geo_interface__
            if not _bbox_intersects(geom, minx - buf, miny - buf, maxx + buf, maxy + buf):
                continue
            attrs = {}
            for k, v in zip(fields, sr.record):
                if isinstance(v, bytes):
                    v = v.decode('utf-8', errors='replace')
                attrs[k] = str(v).strip() if v is not None else ''
            features.append({
                'type': 'Feature',
                'geometry': geom,
                'properties': attrs
            })
            if len(features) >= max_features:
                break
        return features
    except Exception as e:
        return []


def charger_couche_pour_commune(commune_geom_json, type_couche):
    if type_couche not in CATALOGUE_COUCHES:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': 'Couche inconnue'}
    meta = CATALOGUE_COUCHES[type_couche]
    minx, miny, maxx, maxy = _get_commune_bbox(commune_geom_json)
    features = _lire_shp_filtré(meta['shp'], minx, miny, maxx, maxy)
    return {
        'type': 'FeatureCollection',
        'features': features,
        'meta': {
            'couche': type_couche,
            'nb_entites': len(features),
            'couleur': meta['couleur'],
            'source': 'IGN S\u00e9n\u00e9gal'
        }
    }


def charger_toutes_couches_commune(commune_geom_json, types_couches=None):
    if types_couches is None:
        types_couches = ['routes', 'cours_eau', 'localites']
    return {tc: charger_couche_pour_commune(commune_geom_json, tc) for tc in types_couches}
