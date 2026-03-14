import os
import json
import geopandas as gpd
from shapely.geometry import mapping, box
from shapely.ops import unary_union

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

# Catalogue des couches disponibles localement
CATALOGUE_COUCHES = {
    'routes':        {'shp': 'TR_SEGMENT_ROUTIER_L',  'couleur': '#888888', 'epaisseur': 1.0, 'description': 'Réseau routier'},
    'chemin_fer':    {'shp': 'TR_CHEMIN_FER_L',       'couleur': '#444444', 'epaisseur': 1.5, 'description': 'Chemins de fer'},
    'cours_eau':     {'shp': 'HD_COURS_EAU_SIMPLE_L', 'couleur': '#3498db', 'epaisseur': 0.8, 'description': 'Cours d\'eau'},
    'plans_eau':     {'shp': 'HD_REGION_HYDRIQUE_S',  'couleur': '#85c1e9', 'epaisseur': 0.5, 'description': 'Plans d\'eau'},
    'points_eau':    {'shp': 'BS_POINT_EAU_P',        'couleur': '#2980b9', 'epaisseur': 3.0, 'description': 'Points d\'eau'},
    'forets':        {'shp': 'VE_SURFACE_BOISEE_S',   'couleur': '#27ae60', 'epaisseur': 0.3, 'description': 'Surfaces boisées'},
    'cultures':      {'shp': 'VE_SURFACE_CULTIVEE_S', 'couleur': '#f9e79f', 'epaisseur': 0.3, 'description': 'Surfaces cultivées'},
    'aires_protegees':{'shp': 'LX_AIRE_PROTEGEE_S',   'couleur': '#1e8449', 'epaisseur': 1.0, 'description': 'Aires protégées'},
    'courbes_niveau':{'shp': 'FO_COURBE_NIVEAU_L',    'couleur': '#b7950b', 'epaisseur': 0.3, 'description': 'Courbes de niveau'},
    'sable':         {'shp': 'FO_SABLE_S',            'couleur': '#f0e68c', 'epaisseur': 0.3, 'description': 'Zones sableuses'},
    'agglomerations':{'shp': 'BS_AGGLOMERATION_S',    'couleur': '#e67e22', 'epaisseur': 0.5, 'description': 'Agglomérations'},
    'aeroports':     {'shp': 'TR_AEROPORT_P',         'couleur': '#2c3e50', 'epaisseur': 3.0, 'description': 'Aéroports'},
    'localites':     {'shp': 'LA_LOCALITE_P',         'couleur': '#c0392b', 'epaisseur': 2.0, 'description': 'Localités'},
    'frontieres':    {'shp': 'LA_FRONTIERE_INTERNATIONALE_FRONTIERE_ETAT_L', 'couleur': '#2c3e50', 'epaisseur': 1.5, 'description': 'Frontières'},
}


def get_catalogue():
    """Retourne le catalogue des couches disponibles avec statut de disponibilité."""
    catalogue = []
    for cle, meta in CATALOGUE_COUCHES.items():
        shp_path = os.path.join(DATA_DIR, f"{meta['shp']}.shp")
        catalogue.append({
            'id': cle,
            'description': meta['description'],
            'couleur_defaut': meta['couleur'],
            'disponible': os.path.exists(shp_path),
            'source': 'IGN Sénégal / Topo1M'
        })
    return catalogue


def charger_couche_pour_commune(commune_geom_json, type_couche, tolerance=0.001):
    """
    Charge une couche thématique filtrée à l'emprise d'une commune.
    commune_geom_json : string GeoJSON de la géométrie de la commune
    type_couche       : clé du CATALOGUE_COUCHES
    tolerance         : simplification géométrique pour alléger le rendu
    Retourne un dict GeoJSON FeatureCollection.
    """
    if type_couche not in CATALOGUE_COUCHES:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': 'Couche inconnue'}

    meta = CATALOGUE_COUCHES[type_couche]
    shp_path = os.path.join(DATA_DIR, f"{meta['shp']}.shp")
    if not os.path.exists(shp_path):
        return {'type': 'FeatureCollection', 'features': [], 'erreur': 'Fichier absent'}

    from shapely.geometry import shape
    try:
        commune_geom = shape(json.loads(commune_geom_json))
        bounds = commune_geom.bounds  # (minx, miny, maxx, maxy)

        # Ajout d'un buffer pour inclure les éléments en bordure
        bbox = box(bounds[0] - 0.01, bounds[1] - 0.01,
                   bounds[2] + 0.01, bounds[3] + 0.01)

        gdf = gpd.read_file(shp_path, bbox=bbox)
        if gdf.empty:
            return {'type': 'FeatureCollection', 'features': []}

        if gdf.crs and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)

        # Intersection stricte avec l'emprise de la commune
        gdf = gdf[gdf.geometry.intersects(commune_geom)]

        # Simplification pour accélérer le rendu
        if tolerance > 0:
            gdf['geometry'] = gdf['geometry'].simplify(tolerance, preserve_topology=True)

        gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()]

        features = json.loads(gdf.to_json())['features']
        return {
            'type': 'FeatureCollection',
            'features': features,
            'meta': {
                'couche': type_couche,
                'nb_entites': len(features),
                'couleur': meta['couleur'],
                'source': 'IGN Sénégal'
            }
        }
    except Exception as e:
        return {'type': 'FeatureCollection', 'features': [], 'erreur': str(e)}


def charger_toutes_couches_commune(commune_geom_json, types_couches=None):
    """
    Charge plusieurs couches pour une commune.
    types_couches : liste de clés CATALOGUE_COUCHES. Si None, charge les couches de base.
    """
    if types_couches is None:
        types_couches = ['routes', 'cours_eau', 'localites']

    resultat = {}
    for tc in types_couches:
        resultat[tc] = charger_couche_pour_commune(commune_geom_json, tc)
    return resultat
