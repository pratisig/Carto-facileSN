import React from 'react';

export default function PanneauGauche({
  regions, departements, communes,
  onRegionChange, onDepChange, onCommuneChange,
  communeSelectionnee, loading
}) {
  return (
    <div className="panneau panneau-gauche">
      <h2>Zone géographique</h2>

      <label className="select-label">Région</label>
      <select
        className="select-field"
        defaultValue=""
        onChange={e => onRegionChange(e.target.value)}
      >
        <option value="">-- Choisir --</option>
        {regions.map(r => (
          <option key={r.id} value={String(r.id)}>{r.nom}</option>
        ))}
      </select>

      <label className="select-label">Département</label>
      <select
        className="select-field"
        defaultValue=""
        onChange={e => onDepChange(e.target.value)}
        disabled={departements.length === 0}
      >
        <option value="">-- Choisir --</option>
        {departements.map(d => (
          <option key={d.id} value={String(d.id)}>{d.nom}</option>
        ))}
      </select>

      <label className="select-label">Commune</label>
      <select
        className="select-field"
        defaultValue=""
        onChange={e => onCommuneChange(e.target.value)}
        disabled={communes.length === 0}
      >
        <option value="">-- Choisir --</option>
        {communes.map(c => (
          <option key={c.id} value={String(c.id)}>{c.nom}</option>
        ))}
      </select>

      {loading && (
        <div style={{fontSize:'0.78rem', color:'#1a5276', marginTop:4}}>
          ⏳ Chargement...
        </div>
      )}

      {communeSelectionnee && (
        <div className="info-commune">
          <div className="nom">{communeSelectionnee.nom}</div>
          <div className="detail">
            {communeSelectionnee.departement_nom && <div>📍 {communeSelectionnee.departement_nom}</div>}
            {communeSelectionnee.region_nom     && <div>🏞️ {communeSelectionnee.region_nom}</div>}
            {communeSelectionnee.population     && <div>👥 {communeSelectionnee.population.toLocaleString('fr-FR')} hab.</div>}
            {communeSelectionnee.superficie_km2 && <div>🗺️ {Math.round(communeSelectionnee.superficie_km2)} km²</div>}
          </div>
        </div>
      )}
    </div>
  );
}
