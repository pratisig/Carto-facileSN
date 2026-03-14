import json
import csv
import io

def traiter_fichier_importe(fichier, format_source):
    """
    Convertit un fichier uploadé (CSV, GeoJSON, KML) en GeoJSON normalisé.
    Retourne (geojson_str, nb_points)
    """
    contenu = fichier.read().decode('utf-8')

    if format_source == 'geojson':
        return _traiter_geojson(contenu)
    elif format_source == 'csv':
        return _traiter_csv(contenu)
    elif format_source == 'kml':
        return _traiter_kml(contenu)
    else:
        return None, 0

def _traiter_geojson(contenu):
    data = json.loads(contenu)
    features = data.get('features', [])
    return json.dumps(data), len(features)

def _traiter_csv(contenu):
    """
    CSV attendu : colonnes latitude, longitude + attributs libres
    """
    reader = csv.DictReader(io.StringIO(contenu))
    features = []
    for row in reader:
        try:
            lat = float(row.get('latitude') or row.get('lat') or row.get('y'))
            lon = float(row.get('longitude') or row.get('lon') or row.get('x'))
            props = {k: v for k, v in row.items()
                     if k not in ['latitude', 'longitude', 'lat', 'lon', 'x', 'y']}
            features.append({
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
                'properties': props
            })
        except (ValueError, TypeError):
            continue
    geojson = {'type': 'FeatureCollection', 'features': features}
    return json.dumps(geojson), len(features)

def _traiter_kml(contenu):
    """
    Conversion KML basique vers GeoJSON (points uniquement).
    Pour usage complet, utiliser la lib fastkml.
    """
    import re
    features = []
    coords_pattern = re.findall(r'<coordinates>\s*([\d.\-,\s]+)\s*</coordinates>', contenu)
    for coord_str in coords_pattern:
        parts = coord_str.strip().split(',')
        if len(parts) >= 2:
            try:
                lon, lat = float(parts[0]), float(parts[1])
                features.append({
                    'type': 'Feature',
                    'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
                    'properties': {}
                })
            except ValueError:
                continue
    geojson = {'type': 'FeatureCollection', 'features': features}
    return json.dumps(geojson), len(features)
