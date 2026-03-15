import React from 'react';

// IMPORTANT: les groupes ici doivent correspondre EXACTEMENT au champ
// 'groupe' du CATALOGUE dans App.js (avec accents)
const GROUPES_ORDRE = ['Transport', 'Hydrologie', 'Végétation', 'Terrain', 'Population', 'Frontières'];

export default function GestionnaireCouches({
  catalogue, couchesActives, toggleCouche, geojsonThematiques, prechauffage
}) {
  const total  = catalogue.length;
  const charge = Object.keys(geojsonThematiques).length;
  const pct    = total > 0 ? Math.round((charge / total) * 100) : 0;

  const groupes = GROUPES_ORDRE.reduce((acc, g) => {
    const items = catalogue.filter(c => c.groupe === g);
    if (items.length) acc[g] = items;
    return acc;
  }, {});

  return (
    <div className="panneau-droit">
      <div className="pd-header">
        <span>🗺️ Couches thématiques</span>
        <span className="pd-header-badge">{couchesActives.length} actives</span>
      </div>

      {/* Barre de chargement */}
      {charge < total && (
        <div className="pd-loading-bar-wrap" title={`${charge}/${total} couches chargées`}>
          <div className="pd-loading-bar" style={{ width: `${pct}%` }} />
          <span className="pd-loading-txt">
            {prechauffage ? `⏳ Chargement ${charge}/${total}…` : `${charge}/${total} prêtes`}
          </span>
        </div>
      )}
      {charge === total && (
        <div className="pd-loading-bar-wrap ready">
          <div className="pd-loading-bar" style={{ width: '100%' }} />
          <span className="pd-loading-txt">✔ {total} couches prêtes</span>
        </div>
      )}

      {Object.entries(groupes).map(([groupe, items]) => (
        <div className="pd-group" key={groupe}>
          <div className="pd-group-title">{groupe}</div>
          {items.map(c => {
            const actif  = couchesActives.includes(c.id);
            const data   = geojsonThematiques[c.id];
            const charge = !!data;
            const nb     = data?.features?.length ?? 0;
            const isLigne = ['routes','chemin_fer','cours_eau','courbes_niveau','frontieres'].includes(c.id);
            return (
              <div
                key={c.id}
                className={`couche-item${actif ? ' active' : ''}${!charge ? ' not-ready' : ''}`}
                onClick={() => toggleCouche(c.id)}
                title={charge ? `${nb.toLocaleString()} entités — cliquer pour ${actif?'masquer':'afficher'}` : 'En cours de chargement...'}
              >
                <span
                  className="couche-dot"
                  style={{
                    background: actif ? c.couleur : '#ccc',
                    borderRadius: isLigne ? '1px' : '3px',
                    width: isLigne ? '14px' : '11px',
                    height: isLigne ? '4px' : '11px',
                  }}
                />
                <span className="couche-label">{c.icon} {c.label}</span>
                <span className={`couche-badge${actif ? ' on' : ''}${!charge ? ' loading' : ''}`}>
                  {!charge ? '⏳' : actif ? 'ON' : 'OFF'}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
