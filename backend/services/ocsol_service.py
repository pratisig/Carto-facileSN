import os
import json
import requests
from flask import current_app

# URL source : GeoSenegal portail officiel
OCSOL_BASE_URL = 'https://www.geosenegal.gouv.sn'
OCSOL_DOWNLOAD_PAGE = f'{OCSOL_BASE_URL}/-donnees-vectorielles-d-occupation-du-sol-.html'

# Couches OCSOL référencées sur GeoSenegal
OCSOL_COUCHES = [
    {
        'id': 'ocsol_2015',
        'label': 'Occupation du Sol 2015',
        'annee': 2015,
        'source': 'DTGC / GeoSenegal',
        'description': 'Carte d\'occupation et d\'utilisation des sols du Sénégal — année 2015',
        'url_page': OCSOL_DOWNLOAD_PAGE,
        'telecharger': True,
    },
    {
        'id': 'ocsol_2010',
        'label': 'Occupation du Sol 2010',
        'annee': 2010,
        'source': 'DTGC / GeoSenegal',
        'description': 'Carte d\'occupation et d\'utilisation des sols du Sénégal — année 2010',
        'url_page': OCSOL_DOWNLOAD_PAGE,
        'telecharger': True,
    },
    {
        'id': 'ocsol_1990',
        'label': 'Occupation du Sol 1990',
        'annee': 1990,
        'source': 'DTGC / GeoSenegal',
        'description': 'Carte d\'occupation et d\'utilisation des sols du Sénégal — année 1990',
        'url_page': OCSOL_DOWNLOAD_PAGE,
        'telecharger': True,
    },
]

# Classes OCSOL typiques pour légende automatique
CLASSES_OCSOL = {
    1:  {'label': 'Terres cultivées',         'couleur': '#f9e79f'},
    2:  {'label': 'Forêts et savanes',          'couleur': '#27ae60'},
    3:  {'label': 'Zones arbustives',            'couleur': '#82e0aa'},
    4:  {'label': 'Steppes et prairies',         'couleur': '#d5f5e3'},
    5:  {'label': 'Zones humides',               'couleur': '#85c1e9'},
    6:  {'label': 'Plans d\'eau',               'couleur': '#3498db'},
    7:  {'label': 'Zones bâties',               'couleur': '#e74c3c'},
    8:  {'label': 'Sols nus et zones sableuses','couleur': '#f0e68c'},
    9:  {'label': 'Mangroves',                  'couleur': '#117a65'},
    10: {'label': 'Riziculture',                'couleur': '#a9cce3'},
}


def get_catalogue_ocsol():
    """Retourne le catalogue des couches OCSOL disponibles en téléchargement."""
    return {
        'source': 'GeoSenegal DTGC',
        'url_source': OCSOL_DOWNLOAD_PAGE,
        'note': 'Ces données sont téléchargeables directement depuis GeoSenegal '
                'et peuvent être importées dans Carto-facileSN via /api/donnees/importer.',
        'couches': OCSOL_COUCHES,
        'classes_ocsol': CLASSES_OCSOL,
        'formats_disponibles': ['Shapefile (.zip)', 'GeoJSON'],
        'projection': 'WGS84 (EPSG:4326)',
        'couverture': 'Sénégal entier',
    }


def charger_ocsol_pour_commune(commune_geom_json, fichier_ocsol_path, annee=None):
    """
    Charge et découpe un fichier OCSOL (SHP ou GeoJSON) à l'emprise d'une commune.
    L'utilisateur fournit son propre fichier OCSOL téléchargé depuis GeoSenegal.

    commune_geom_json  : string GeoJSON de la commune
    fichier_ocsol_path : chemin local vers le fichier OCSOL
    annee              : année pour métadonnées
    Retourne : dict GeoJSON FeatureCollection + légende
    """
    import geopandas as gpd
    from shapely.geometry import shape

    try:
        commune_geom = shape(json.loads(commune_geom_json))
        bounds = commune_geom.bounds

        if fichier_ocsol_path.endswith('.shp'):
            from shapely.geometry import box
            gdf = gpd.read_file(
                fichier_ocsol_path,
                bbox=(bounds[0]-0.01, bounds[1]-0.01, bounds[2]+0.01, bounds[3]+0.01)
            )
        else:
            gdf = gpd.read_file(fichier_ocsol_path)

        if gdf.crs and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)

        gdf_commune = gdf[gdf.geometry.intersects(commune_geom)]

        if gdf_commune.empty:
            return {'type': 'FeatureCollection', 'features': [],
                    'meta': {'annee': annee, 'nb_entites': 0}}

        gdf_commune = gdf_commune.copy()
        gdf_commune['geometry'] = gdf_commune['geometry'].simplify(0.0005, preserve_topology=True)

        col_classe = _detecter_col_ocsol(gdf_commune)
        features = json.loads(gdf_commune.to_json())['features']
        legende = _construire_legende(gdf_commune, col_classe)

        return {
            'type': 'FeatureCollection',
            'features': features,
            'meta': {
                'annee': annee,
                'nb_entites': len(features),
                'source': 'GeoSenegal / DTGC',
                'colonne_classe': col_classe,
            },
            'legende': legende
        }
    except Exception as e:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': str(e)}


def _detecter_col_ocsol(gdf):
    candidats = ['CLASSE', 'CODE_OCS', 'CODE', 'OCSOL', 'LIBELLE', 'TYPE']
    for c in candidats:
        if c in [col.upper() for col in gdf.columns]:
            return next(col for col in gdf.columns if col.upper() == c)
    return None


def _construire_legende(gdf, col_classe):
    if not col_classe:
        return []
    valeurs = gdf[col_classe].unique()
    legende = []
    for v in sorted(valeurs):
        try:
            code = int(v)
            info = CLASSES_OCSOL.get(code, {'label': str(v), 'couleur': '#cccccc'})
        except (ValueError, TypeError):
            info = {'label': str(v), 'couleur': '#cccccc'}
        legende.append({'valeur': str(v), 'label': info['label'], 'couleur': info['couleur']})
    return legende
