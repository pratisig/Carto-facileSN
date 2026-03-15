import React from 'react';

export default function PanneauGauche({
  regions, departements, communes,
  regionId, depId,
  onRegionChange, onDepChange, onCommuneChange,
  communeSelectionnee, loading
}) {
  return (
    <div className="panneau panneau-gauche">
      <h2>Zone géographique</h2>

      <label className="select-label">Région</label>
      <select
        className="select-field"
        value={regionId}
        onChange={e => onRegionChange(e.target.value)}
      >
        <option value="">-- Choisir une région --</option>
        {regions.map(r => (
          <option key={r.id} value={r.id}>{r.nom}</option>
        ))}
      </select>

      <label className="select-label">Département</label>
      <select
        className="select-field"
        value={depId}
        onChange={e => onDepChange(e.target.value)}
        disabled={!regionId || departements.length === 0}
      >
        <option value="">-- Choisir un département --</option>
        {departements.map(d => (
          <option key={d.id} value={d.id}>{d.nom}</option>
        ))}
      </select>

      <label className="select-label">Commune</label>
      <select
        className="select-field"
        onChange={e => onCommuneChange(e.target.value)}
        disabled={!depId || communes.length === 0}
        value={communeSelectionnee?.id || ''}
      >
        <option value="">-- Choisir une commune --</option>
        {communes.map(c => (
          <option key={c.id} value={c.id}>{c.nom}</option>
        ))}
      </select>

      {loading && (
        <div style={{ fontSize: '0.75rem', color: '#1a5276', padding: '4px 0' }}>
          ⏳ Chargement...
        </div>
      )}

      {communeSelectionnee && (
        <div className="info-commune">
          <div className="nom">{communeSelectionnee.nom}</div>
          <div className="detail">
            {communeSelectionnee.departement_nom && (
              <div>📍 Dép. : {communeSelectionnee.departement_nom}</div>
            )}
            {communeSelectionnee.region_nom && (
              <div>🏞️ Région : {communeSelectionnee.region_nom}</div>
            )}
            {communeSelectionnee.population && (
              <div>👥 Pop. : {communeSelectionnee.population.toLocaleString('fr-FR')}</div>
            )}
            {communeSelectionnee.superficie_km2 && (
              <div>🗺️ {Math.round(communeSelectionnee.superficie_km2)} km²</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
