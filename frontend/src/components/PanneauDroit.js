import React from 'react';

export default function PanneauDroit({ catalogueCouches, couchesActives, toggleCouche, communeSelectionnee }) {
  return (
    <div className="panneau panneau-droit">
      <h2>Couches</h2>
      {!communeSelectionnee && (
        <p style={{fontSize:'0.75rem', color:'#aaa', marginBottom:8}}>
          Sélectionnez une commune pour activer les couches.
        </p>
      )}
      {catalogueCouches.map(c => {
        const actif = couchesActives.includes(c.id);
        return (
          <div
            key={c.id}
            className={`couche-item ${!c.disponible ? 'couche-indispo' : ''}`}
            onClick={() => c.disponible && communeSelectionnee && toggleCouche(c.id)}
          >
            <div className="couche-dot" style={{background: c.couleur_defaut}} />
            <span className="couche-label">{c.description}</span>
            <span className={`couche-badge ${actif && c.disponible ? 'active' : ''}`}>
              {!c.disponible ? 'N/A' : actif ? 'ON' : 'OFF'}
            </span>
          </div>
        );
      })}
      <div style={{marginTop:16, padding:'8px', background:'#f9f9f9', borderRadius:6, fontSize:'0.72rem', color:'#888'}}>
        <b>OCSOL</b> : Téléchargez les données depuis{' '}
        <a href="https://www.geosenegal.gouv.sn/-donnees-vectorielles-d-occupation-du-sol-.html"
           target="_blank" rel="noreferrer" style={{color:'#1a5276'}}>GeoSénégal</a>
      </div>
    </div>
  );
}
