import React from 'react';

const GROUPES_ORDRE = ['Transport', 'Hydrologie', 'Vegetation', 'Terrain', 'Population', 'Frontieres'];

export default function GestionnaireCouches({ catalogue, couchesActives, toggleCouche, geojsonThematiques }) {
  const groupes = GROUPES_ORDRE.reduce((acc, g) => {
    const items = catalogue.filter(c => c.groupe === g);
    if (items.length) acc[g] = items;
    return acc;
  }, {});

  return (
    <div className="panneau-droit">
      <div className="pd-header">
        🗂️ Couches thématiques
      </div>

      {Object.entries(groupes).map(([groupe, items]) => (
        <div className="pd-group" key={groupe}>
          <div className="pd-group-title">{groupe}</div>
          {items.map(c => {
            const actif = couchesActives.includes(c.id);
            const charge = !!geojsonThematiques[c.id];
            return (
              <div
                key={c.id}
                className={`couche-item${actif ? ' active' : ''}`}
                onClick={() => toggleCouche(c.id)}
                title={charge ? `${geojsonThematiques[c.id]?.features?.length || 0} entites` : 'Cliquer pour activer'}
              >
                <span
                  className="couche-dot"
                  style={{
                    background: actif ? c.couleur : '#ddd',
                    borderRadius: c.id.includes('eau') || c.id.includes('routes') || c.id.includes('fer') || c.id.includes('frontieres') ? '0' : '2px'
                  }}
                />
                <span className="couche-label">{c.icon} {c.label}</span>
                <span className={`couche-badge${actif ? ' on' : ''}`}>
                  {actif ? 'ON' : 'OFF'}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
