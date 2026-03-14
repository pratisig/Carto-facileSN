import os
import json
import zipfile
import tempfile
import shapefile  # pyshp

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

CATA_OCSOL = [
    {'annee': 1990, 'disponible': False, 'source': 'GeoS\u00e9n\u00e9gal',
     'url': 'https://www.geosenegal.gouv.sn/-donnees-vectorielles-d-occupation-du-sol-.html'},
    {'annee': 2010, 'disponible': False, 'source': 'GeoS\u00e9n\u00e9gal',
     'url': 'https://www.geosenegal.gouv.sn/-donnees-vectorielles-d-occupation-du-sol-.html'},
    {'annee': 2015, 'disponible': False, 'source': 'GeoS\u00e9n\u00e9gal',
     'url': 'https://www.geosenegal.gouv.sn/-donnees-vectorielles-d-occupation-du-sol-.html'},
]

LEGENDE_OCSOL = {
    '1': {'label': 'Terres cultiv\u00e9es', 'couleur': '#f9e79f'},
    '2': {'label': 'Prairie / Savane',    'couleur': '#abebc6'},
    '3': {'label': 'For\u00eat',           'couleur': '#27ae60'},
    '4': {'label': 'Zone humide',         'couleur': '#85c1e9'},
    '5': {'label': 'Plan d\'eau',        'couleur': '#2e86c1'},
    '6': {'label': 'Zone b\u00e2tie',     'couleur': '#e74c3c'},
    '7': {'label': 'Sol nu / Sable',      'couleur': '#f0e68c'},
    '8': {'label': 'Autre',               'couleur': '#bdc3c7'},
}


def get_catalogue_ocsol():
    for entry in CATA_OCSOL:
        local = os.path.join(DATA_DIR, f"ocsol_{entry['annee']}.shp")
        entry['disponible'] = os.path.exists(local)
    return {
        'annees': CATA_OCSOL,
        'legende': LEGENDE_OCSOL,
        'source_url': 'https://www.geosenegal.gouv.sn/-donnees-vectorielles-d-occupation-du-sol-.html'
    }


def _bbox_commune(commune_geom_json):
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
    xs, ys = [c[0] for c in coords], [c[1] for c in coords]
    return min(xs), min(ys), max(xs), max(ys)


def _lire_ocsol_shp(shp_path, minx, miny, maxx, maxy):
    features = []
    try:
        sf = shapefile.Reader(shp_path)
        fields = [f[0] for f in sf.fields[1:]]
        col_classe = next((f for f in fields if f.upper() in ('CLASSE', 'CODE', 'CLASS', 'TYPE')), fields[0] if fields else None)
        for sr in sf.shapeRecords():
            geom = sr.shape.__geo_interface__
            attrs = {}
            for k, v in zip(fields, sr.record):
                if isinstance(v, bytes):
                    v = v.decode('utf-8', errors='replace')
                attrs[k] = str(v).strip() if v is not None else ''
            classe = attrs.get(col_classe, '8') if col_classe else '8'
            leg = LEGENDE_OCSOL.get(str(classe), LEGENDE_OCSOL['8'])
            attrs['_label'] = leg['label']
            attrs['_couleur'] = leg['couleur']
            features.append({'type': 'Feature', 'geometry': geom, 'properties': attrs})
    except Exception as e:
        pass
    return features


def appliquer_ocsol_local(annee, commune_geom_json):
    shp_path = os.path.join(DATA_DIR, f'ocsol_{annee}.shp')
    if not os.path.exists(shp_path):
        return {'erreur': f'OCSOL {annee} non disponible localement'}
    minx, miny, maxx, maxy = _bbox_commune(commune_geom_json)
    features = _lire_ocsol_shp(shp_path, minx, miny, maxx, maxy)
    return {
        'type': 'FeatureCollection',
        'features': features,
        'annee': annee,
        'nb_entites': len(features),
        'legende': LEGENDE_OCSOL
    }


def traiter_upload_ocsol(fichier_zip_ou_shp, annee, commune_geom_json):
    """Traite un fichier OCSOL upload\u00e9 par l'utilisateur (ZIP ou SHP)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        if fichier_zip_ou_shp.filename.endswith('.zip'):
            zip_path = os.path.join(tmpdir, 'ocsol.zip')
            fichier_zip_ou_shp.save(zip_path)
            with zipfile.ZipFile(zip_path, 'r') as z:
                z.extractall(tmpdir)
            shp_files = [f for f in os.listdir(tmpdir) if f.endswith('.shp')]
            if not shp_files:
                return {'erreur': 'Aucun .shp trouv\u00e9 dans le ZIP'}
            shp_path = os.path.join(tmpdir, shp_files[0])
        else:
            shp_path = os.path.join(tmpdir, 'ocsol.shp')
            fichier_zip_ou_shp.save(shp_path)

        minx, miny, maxx, maxy = _bbox_commune(commune_geom_json)
        features = _lire_ocsol_shp(shp_path, minx, miny, maxx, maxy)

        # Sauvegarder localement pour r\u00e9utilisation
        dest = os.path.join(DATA_DIR, f'ocsol_{annee}_uploaded')
        try:
            import shutil
            shutil.copy(shp_path, dest + '.shp')
            for ext in ['.dbf', '.prj', '.shx']:
                src = shp_path.replace('.shp', ext)
                if os.path.exists(src):
                    shutil.copy(src, dest + ext)
        except Exception:
            pass

        return {
            'type': 'FeatureCollection',
            'features': features,
            'annee': annee,
            'nb_entites': len(features),
            'legende': LEGENDE_OCSOL
        }
