import json
import base64
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyArrowPatch
from shapely.geometry import shape
from shapely.ops import unary_union

def generer_carte_preview(carte):
    """
    Génère une carte matplotlib de la commune et retourne l'image en base64.
    Utilise les géométries GeoJSON stockées en base.
    """
    from models.commune import Commune, Departement, Region

    commune = Commune.query.get(carte.commune_id)
    if not commune or not commune.geom:
        return None

    fig, axes = plt.subplots(1, 2, figsize=(16, 10))
    fig.patch.set_facecolor('#f8f9fa')

    couleur = carte.couleur_zone or '#e74c3c'

    # --- Carte principale : commune dans le département ---
    ax1 = axes[0]
    dep = Departement.query.get(commune.departement_id)
    communes_dep = Commune.query.filter_by(departement_id=commune.departement_id).all()
    for c in communes_dep:
        if c.geom:
            geom = shape(json.loads(c.geom))
            if c.id == commune.id:
                ax1.fill(*geom.exterior.xy, color=couleur, alpha=0.7, zorder=2)
                ax1.plot(*geom.exterior.xy, color='white', linewidth=1.5, zorder=3)
            else:
                ax1.fill(*geom.exterior.xy, color='#bdc3c7', alpha=0.5, zorder=1)
                ax1.plot(*geom.exterior.xy, color='white', linewidth=0.5, zorder=2)

    ax1.set_title(f'Commune de {commune.nom}\ndans le Département de {dep.nom if dep else ""}',
                  fontsize=11, fontweight='bold', pad=10)
    ax1.axis('off')
    ax1.set_aspect('equal')

    # --- Mini-carte de localisation dans la région ---
    ax2 = axes[1]
    ax2.set_title(f'Localisation\ndans la Région', fontsize=10, pad=10)
    ax2.axis('off')
    ax2.set_aspect('equal')

    # Titre global et métadonnées
    titre = carte.titre or f'Carte de la Commune de {commune.nom}'
    fig.suptitle(titre, fontsize=14, fontweight='bold', y=0.98)
    fig.text(0.5, 0.01,
             f"Auteur : {carte.auteur or 'N/A'}  |  Source : {carte.source_donnees or 'ANSD / OSM'}  |  Carto-facileSN",
             ha='center', fontsize=8, color='gray')

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')
