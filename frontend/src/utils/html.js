/**
 * Utilitaires de rendu sécurisé pour Leaflet.
 *
 * Leaflet interprète le contenu de `bindPopup` / `bindTooltip` comme du HTML
 * lorsqu'il reçoit une chaîne. Or les valeurs affichées proviennent de données
 * externes (GeoJSON du backend, fichiers importés par l'utilisateur, noms de
 * localités). Les injecter sans échappement permet l'exécution de scripts
 * arbitraires (XSS). Toute interpolation doit passer par `echapperHtml`.
 */

const CORRESPONDANCES_HTML = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Échappe les caractères dangereux pour une insertion dans du HTML.
 * Retourne une chaîne vide pour null / undefined.
 */
export function echapperHtml(valeur) {
  if (valeur === null || valeur === undefined) return '';
  return String(valeur).replace(/[&<>"']/g, (c) => CORRESPONDANCES_HTML[c]);
}

/**
 * Construit le HTML d'un popup à partir d'une liste de propriétés.
 * Clés et valeurs sont échappées ; seules les balises générées sont du HTML.
 */
export function construirePopup(lignes) {
  return `<div style="font-size:0.8rem;max-width:220px">${lignes.join('<br/>')}</div>`;
}

/**
 * Formate une paire clé / valeur en ligne HTML échappée.
 */
export function ligneHtml(cle, valeur) {
  return `<b>${echapperHtml(cle)}</b>: ${echapperHtml(valeur)}`;
}
