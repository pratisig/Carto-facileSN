import os
import json
import shapefile

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

ENCODINGS = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']

CATALOGUE_COUCHES = {
    'routes':         {'shp': 'TR_SEGMENT_ROUTIER_L',  'couleur': '#888888', 'description': 'Reseau routier'},
    'chemin_fer':     {'shp': 'TR_CHEMIN_FER_L',       'couleur': '#444444', 'description': 'Chemins de fer'},
    'cours_eau':      {'shp': 'HD_COURS_EAU_SIMPLE_L', 'couleur': '#3498db', 'description': "Cours d'eau"},
    'plans_eau':      {'shp': 'HD_REGION_HYDRIQUE_S',  'couleur': '#85c1e9', 'description': "Plans d'eau"},
    'points_eau':     {'shp': 'BS_POINT_EAU_P',        'couleur': '#2980b9', 'description': "Points d'eau"},
    'aires_protegees':{'shp': 'LX_AIRE_PROTEGEE_S',    'couleur': '#1e8449', 'description': 'Aires protegees'},
    'courbes_niveau': {'shp': 'FO_COURBE_NIVEAU_L',    'couleur': '#b7950b', 'description': 'Courbes de niveau'},
    'sable':          {'shp': 'FO_SABLE_S',            'couleur': '#f0e68c', 'description': 'Zones sableuses'},
    'agglomerations': {'shp': 'BS_AGGLOMERATION_S',    'couleur': '#e67e22', 'description': 'Agglomerations'},
    'aeroports':      {'shp': 'TR_AEROPORT_P',         'couleur': '#2c3e50', 'description': 'Aeroports'},
    'localites':      {'shp': 'LA_LOCALITE_P',         'couleur': '#c0392b', 'description': 'Localites'},
    'frontieres':     {'shp': 'LA_FRONTIERE_INTERNATIONALE_FRONTIERE_ETAT_L',
                       'couleur': '#2c3e50', 'description': 'Frontieres'},
}


def _decode(v):
    if isinstance(v, bytes):
        for enc in ENCODINGS:
            try:
                return v.decode(enc).strip()
            except Exception:
                continue
        return v.decode('latin-1', errors='replace').strip()
    return str(v).strip() if v is not None else ''


def get_catalogue():
    result = []
    for cle, meta in CATALOGUE_COUCHES.items():
        shp_path = os.path.join(DATA_DIR, f"{meta['shp']}.shp")
        result.append({
            'id': cle,
            'description': meta['description'],
            'couleur_defaut': meta['couleur'],
            'disponible': os.path.exists(shp_path),
            'source': 'IGN Senegal / Topo1M'
        })
    return result


def _get_commune_bbox(commune_geom_json):
    try:
        geom = json.loads(commune_geom_json) if isinstance(commune_geom_json, str) else commune_geom_json
    except Exception:
        return -18.0, 12.0, -11.0, 17.0  # bbox Senegal par defaut
    t = geom.get('type', '')
    coords = []
    if t == 'Polygon':
        coords = geom['coordinates'][0] if geom.get('coordinates') else []
    elif t == 'MultiPolygon':
        for poly in geom.get('coordinates', []):
            coords += poly[0] if poly else []
    if not coords:
        return -18.0, 12.0, -11.0, 17.0
    xs = [c[0] for c in coords if len(c) >= 2]
    ys = [c[1] for c in coords if len(c) >= 2]
    return min(xs), min(ys), max(xs), max(ys)


def _bbox_ok(geom, minx, miny, maxx, maxy):
    t = geom.get('type', '')
    coords = []
    if t == 'Point':
        coords = [geom['coordinates']]
    elif t in ('LineString', 'MultiPoint'):
        coords = geom.get('coordinates', [])
    elif t == 'Polygon':
        coords = geom['coordinates'][0] if geom.get('coordinates') else []
    elif t == 'MultiPolygon':
        for poly in geom.get('coordinates', []):
            coords += poly[0] if poly else []
    elif t == 'MultiLineString':
        for line in geom.get('coordinates', []):
            coords += line
    if not coords:
        return True
    xs = [c[0] for c in coords if len(c) >= 2]
    ys = [c[1] for c in coords if len(c) >= 2]
    if not xs:
        return True
    return not (max(xs) < minx or min(xs) > maxx or max(ys) < miny or min(ys) > maxy)


def _lire_shp_filtre(shp_name, minx, miny, maxx, maxy, max_features=2000):
    """Lit un SHP et filtre par BBOX - nom sans accent pour eviter pb encodage serveur."""
    shp_path = os.path.join(DATA_DIR, f'{shp_name}.shp')
    if not os.path.exists(shp_path):
        return []
    # Detecter encodage .cpg
    enc = 'latin-1'
    cpg = shp_path.replace('.shp', '.cpg')
    if os.path.exists(cpg):
        try:
            enc = open(cpg).read().strip() or 'latin-1'
        except Exception:
            pass
    try:
        try:
            sf = shapefile.Reader(shp_path, encoding=enc)
        except Exception:
            sf = shapefile.Reader(shp_path, encoding='latin-1')
        fields = [f[0] for f in sf.fields[1:]]
        features = []
        buf = 0.02
        for sr in sf.shapeRecords():
            try:
                geom = sr.shape.__geo_interface__
            except Exception:
                continue
            if not _bbox_ok(geom, minx - buf, miny - buf, maxx + buf, maxy + buf):
                continue
            attrs = {_decode(k): _decode(v) for k, v in zip(fields, sr.record)}
            features.append({'type': 'Feature', 'geometry': geom, 'properties': attrs})
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
    features = _lire_shp_filtre(meta['shp'], minx, miny, maxx, maxy)
    return {
        'type': 'FeatureCollection',
        'features': features,
        'meta': {
            'couche': type_couche,
            'nb_entites': len(features),
            'couleur': meta['couleur'],
            'source': 'IGN Senegal'
        }
    }


def charger_toutes_couches_commune(commune_geom_json, types_couches=None):
    if types_couches is None:
        types_couches = ['routes', 'cours_eau', 'localites']
    return {tc: charger_couche_pour_commune(commune_geom_json, tc) for tc in types_couches}
