import requests
import json

def recuperer_donnees_kobo(token, form_uid):
    """
    Récupère les soumissions d'un formulaire KoboCollect/ODK via l'API KoboToolbox.
    Retourne (geojson_str, nb_points)
    """
    headers = {'Authorization': f'Token {token}'}
    url = f'https://kc.kobotoolbox.org/api/v1/data/{form_uid}.geojson'

    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        geojson = resp.json()
        features = geojson.get('features', [])
        return json.dumps(geojson), len(features)
    except Exception as e:
        geojson_vide = {'type': 'FeatureCollection', 'features': [], 'erreur': str(e)}
        return json.dumps(geojson_vide), 0
