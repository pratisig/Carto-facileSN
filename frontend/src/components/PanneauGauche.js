import React, { useState } from 'react';

export default function PanneauGauche({
  regions, departements, arrondissements, communes,
  onRegionChange, onDepChange, onArrChange, onCommuneChange,
  communeSelectionnee, loading
}) {
  const [debug, setDebug] = useState([]);

  const log = (msg) => setDebug(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 4)]);

  const handleRegion = (val) => {
    log(`Région sélectionnée: id=${val}`);
    onRegionChange(val);
  };

  const handleDep = (val) => {
    log(`Département sélectionné: id=${val}`);
    onDepChange(val);
  };

  const handleArr = (val) => {
    log(`Arrondissement sélectionné: id=${val}`);
    onArrChange(val);
  };

  const handleCommune = (val) => {
    log(`Commune sélectionnée: id=${val}`);
    onCommuneChange(val);
  };

  return (
    <div className="panneau panneau-gauche">
      <h2>Zone géographique</h2>

      <label className="select-label">Région ({regions.length} chargées)</label>
      <select className="select-field" defaultValue="" onChange={e => handleRegion(e.target.value)}>
        <option value="">-- Choisir --</option>
        {regions.map(r => <option key={r.id} value={String(r.id)}>{r.nom}</option>)}
      </select>

      <label className="select-label">Département ({departements.length} chargés)</label>
      <select className="select-field" defaultValue="" onChange={e => handleDep(e.target.value)}
        disabled={departements.length === 0}>
        <option value="">-- Choisir --</option>
        {departements.map(d => <option key={d.id} value={String(d.id)}>{d.nom}</option>)}
      </select>

      <label className="select-label">Arrondissement ({arrondissements.length} chargés)</label>
      <select className="select-field" defaultValue="" onChange={e => handleArr(e.target.value)}
        disabled={arrondissements.length === 0}>
        <option value="">-- Choisir --</option>
        {arrondissements.map(a => <option key={a.id} value={String(a.id)}>{a.nom}</option>)}
      </select>

      <label className="select-label">Commune ({communes.length} chargées)</label>
      <select className="select-field" defaultValue="" onChange={e => handleCommune(e.target.value)}
        disabled={communes.length === 0}>
        <option value="">-- Choisir --</option>
        {communes.map(c => <option key={c.id} value={String(c.id)}>{c.nom}</option>)}
      </select>

      {loading && <div style={{fontSize:'0.78rem', color:'#1a5276', marginTop:4}}>⏳ Chargement...</div>}

      {debug.length > 0 && (
        <div style={{marginTop:8, background:'#f0f8ff', borderRadius:6,
          padding:'6px 8px', fontSize:'0.7rem', color:'#333', fontFamily:'monospace'}}>
          {debug.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {communeSelectionnee && (
        <div className="info-commune">
          <div className="nom">{communeSelectionnee.nom}</div>
          <div className="detail">
            {communeSelectionnee.arrondissement_nom && <div>🏘️ {communeSelectionnee.arrondissement_nom}</div>}
            {communeSelectionnee.departement_nom && <div>📍 {communeSelectionnee.departement_nom}</div>}
            {communeSelectionnee.region_nom && <div>🏞️ {communeSelectionnee.region_nom}</div>}
            {communeSelectionnee.population && <div>👥 {communeSelectionnee.population.toLocaleString('fr-FR')} hab.</div>}
            {communeSelectionnee.superficie_km2 && <div>🗺️ {Math.round(communeSelectionnee.superficie_km2)} km²</div>}
          </div>
        </div>
      )}
    </div>
  );
}
