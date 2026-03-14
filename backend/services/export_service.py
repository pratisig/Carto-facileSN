import os
import uuid
import base64
import io
from config import Config
from services.carte_service import generer_carte_preview

def exporter_png(carte):
    """Exporte la carte en PNG haute définition (300 dpi) et retourne le chemin"""
    os.makedirs(Config.EXPORT_FOLDER, exist_ok=True)
    image_b64 = generer_carte_preview(carte)
    if not image_b64:
        return None
    nom_fichier = f"carte_{carte.id}_{uuid.uuid4().hex[:8]}.png"
    chemin = os.path.join(Config.EXPORT_FOLDER, nom_fichier)
    with open(chemin, 'wb') as f:
        f.write(base64.b64decode(image_b64))
    return chemin

def exporter_pdf(carte):
    """Exporte la carte en PDF via matplotlib (format A4)"""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_pdf import PdfPages
    import json
    from shapely.geometry import shape
    from models.commune import Commune, Departement

    os.makedirs(Config.EXPORT_FOLDER, exist_ok=True)
    commune = Commune.query.get(carte.commune_id)
    nom_fichier = f"carte_{carte.id}_{uuid.uuid4().hex[:8]}.pdf"
    chemin = os.path.join(Config.EXPORT_FOLDER, nom_fichier)

    with PdfPages(chemin) as pdf:
        fig, ax = plt.subplots(figsize=(8.27, 11.69))  # A4 portrait
        fig.patch.set_facecolor('#f8f9fa')

        if commune and commune.geom:
            geom = shape(json.loads(commune.geom))
            ax.fill(*geom.exterior.xy, color=carte.couleur_zone or '#e74c3c', alpha=0.7)
            ax.plot(*geom.exterior.xy, color='white', linewidth=2)

        ax.set_title(carte.titre or f'Commune de {commune.nom if commune else ""}',
                     fontsize=16, fontweight='bold')
        ax.axis('off')
        ax.set_aspect('equal')
        fig.text(0.5, 0.02,
                 f"Auteur : {carte.auteur or 'N/A'}  |  Source : {carte.source_donnees}  |  Carto-facileSN",
                 ha='center', fontsize=9, color='gray')
        pdf.savefig(fig, bbox_inches='tight')
        plt.close(fig)

    return chemin
