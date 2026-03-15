import React from 'react';

export default function PanneauGauche({
  regions, departements, arrondissements, communes,
  selRegion, selDep, selArr, selCommune,
  onRegionChange, onDepChange, onArrChange, onCommuneChange,
  featCommune, loading
}) {
  return (
    <div className="panneau panneau-gauche">
      <h2>Zone géographique</h2>

      <label className="select-label">Région ({regions.length})</label>
      <select
        className="select-field"
        value={selRegion}
        onChange={e => onRegionChange(e.target.value)}
      >
        <option value="">-- Toutes les régions --</option>
        {regions.map(r => (
          <option key={r.pcode} value={r.pcode}>{r.nom}</option>
        ))}
      </select>

      <label className="select-label">Département ({departements.length})</label>
      <select
        className="select-field"
        value={selDep}
        onChange={e => onDepChange(e.target.value)}
        disabled={!selRegion}
      >
        <option value="">-- Choisir --</option>
        {departements.map(d => (
          <option key={d.pcode} value={d.pcode}>{d.nom}</option>
        ))}
      </select>

      <label className="select-label">Arrondissement ({arrondissements.length})</label>
      <select
        className="select-field"
        value={selArr}
        onChange={e => onArrChange(e.target.value)}
        disabled={!selDep}
      >
        <option value="">-- Choisir --</option>
        {arrondissements.map(a => (
          <option key={a.pcode} value={a.pcode}>{a.nom}</option>
        ))}
      </select>

      <label className="select-label">Commune ({communes.length})</label>
      <select
        className="select-field"
        value={selCommune}
        onChange={e => onCommuneChange(e.target.value)}
        disabled={!selArr}
      >
        <option value="">-- Choisir --</option>
        {communes.map(c => (
          <option key={c.pcode} value={c.pcode}>{c.nom}</option>
        ))}
      </select>

      {loading && (
        <div style={{ fontSize:'0.78rem', color:'#1a5276', marginTop:6 }}>
          ⏳ Chargement...
        </div>
      )}

      {featCommune && (
        <div className="info-commune">
          <div className="nom">
            {featCommune.properties._nom || featCommune.properties.NAME_4 || 'Commune'}
          </div>
          <div className="detail" style={{ fontSize: '0.8rem', color: '#555', marginTop: 6 }}>
            📍 PCODE : {featCommune.properties.GID_4 || featCommune.properties.ADM4_PCODE || '—'}
          </div>
        </div>
      )}
    </div>
  );
}
