import React from 'react';

const GROUPES_ORDRE = ['Transport', 'Hydrologie', 'Végétation', 'Terrain', 'Population', 'Frontières'];

export default function GestionnaireCouches({
  catalogue, couchesActives, toggleCouche, geojsonThematiques,
  prechauffage, isMobile, onClose,
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
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <span className="pd-header-badge">{couchesActives.length} actives</span>
          {isMobile && (
            <button onClick={onClose}
              style={{background:'rgba(255,255,255,0.15)',border:'none',color:'white',
                borderRadius:5,width:24,height:24,cursor:'pointer',
                fontSize:'0.8rem',display:'flex',alignItems:'center',justifyContent:'center'}}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Barre progression */}
      <div className={`pd-loading-bar-wrap${charge === total ? ' ready' : ''}`}
        title={`${charge}/${total} couches chargées`}>
        <div className="pd-loading-bar" style={{ width: `${pct}%` }} />
        <span className="pd-loading-txt">
          {charge < total
            ? (prechauffage ? `⏳ ${charge}/${total}…` : `${charge}/${total} prêtes`)
            : `✔ ${total} couches prêtes`}
        </span>
      </div>

      {Object.entries(groupes).map(([groupe, items]) => (
        <div className="pd-group" key={groupe}>
          <div className="pd-group-title">{groupe}</div>
          {items.map(c => {
            const actif   = couchesActives.includes(c.id);
            const data    = geojsonThematiques[c.id];
            const estPret = !!data;
            const isLigne = ['routes','chemin_fer','cours_eau','courbes_niveau','frontieres'].includes(c.id);
            return (
              <div
                key={c.id}
                className={`couche-item${actif ? ' active' : ''}${!estPret ? ' not-ready' : ''}`}
                onClick={() => toggleCouche(c.id)}
                title={estPret
                  ? `${(data?.features?.length||0).toLocaleString()} entités`
                  : 'Chargement...'}
              >
                <span className="couche-dot" style={{
                  background:    actif ? c.couleur : '#ccc',
                  borderRadius:  isLigne ? '1px' : '3px',
                  width:         isLigne ? '14px' : '11px',
                  height:        isLigne ? '4px'  : '11px',
                  display:       'inline-block',
                }} />
                <span className="couche-label">{c.icon} {c.label}</span>
                <span className={`couche-badge${actif ? ' on' : ''}${!estPret ? ' loading' : ''}`}>
                  {!estPret ? '⏳' : actif ? 'ON' : 'OFF'}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
