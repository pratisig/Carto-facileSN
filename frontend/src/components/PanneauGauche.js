import React from 'react';

export default function PanneauGauche({
  regions, departements, communes,
  regionId, depId,
  onRegionChange, onDepChange, onCommuneChange,
  communeSelectionnee
}) {
  return (
    <div className="panneau panneau-gauche">
      <h2>Zone géographique</h2>

      <label style={{fontSize:'0.75rem', color:'#666'}}>Région</label>
      <select className="select-field" value={regionId} onChange={e => onRegionChange(e.target.value)}>
        <option value="">-- Sélectionner --</option>
        {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
      </select>

      <label style={{fontSize:'0.75rem', color:'#666'}}>Département</label>
      <select className="select-field" value={depId} onChange={e => onDepChange(e.target.value)} disabled={!regionId}>
        <option value="">-- Sélectionner --</option>
        {departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
      </select>

      <label style={{fontSize:'0.75rem', color:'#666'}}>Commune</label>
      <select className="select-field" onChange={e => onCommuneChange(e.target.value)} disabled={!depId}>
        <option value="">-- Sélectionner --</option>
        {communes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </select>

      {communeSelectionnee && (
        <div className="info-commune">
          <div className="nom">{communeSelectionnee.nom}</div>
          <div className="detail">
            {communeSelectionnee.departement_nom && <div>Dép. : {communeSelectionnee.departement_nom}</div>}
            {communeSelectionnee.region_nom && <div>Région : {communeSelectionnee.region_nom}</div>}
            {communeSelectionnee.population && <div>Pop. : {communeSelectionnee.population?.toLocaleString('fr-FR')}</div>}
            {communeSelectionnee.superficie_km2 && <div>Superficie : {Math.round(communeSelectionnee.superficie_km2)} km²</div>}
          </div>
        </div>
      )}
    </div>
  );
}
