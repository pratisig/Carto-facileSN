import React from 'react';

function ToggleRow({ dot, label, checked, onChange }) {
  return (
    <div className="toggle-row" onClick={() => onChange(!checked)}>
      <div className="toggle-row-label">
        <span className="level-dot" style={{ background: dot }} />
        <span style={{ fontSize: '0.8rem' }}>{label}</span>
      </div>
      <label className="toggle-switch" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}

export default function PanneauGauche({
  regions, departements, arrondissements, communes,
  selRegion, selDep, selArr, selCommune,
  onRegionChange, onDepChange, onArrChange, onCommuneChange, onReset,
  featRegion, featDep, featArr, featCommune,
  visRegions, setVisRegions, visDeps, setVisDeps,
  visArrs, setVisArrs, visCommunes, setVisCommunes,
  visEtiquettes, setVisEtiquettes,
  importData, onImportClick, onImportClear,
  loading
}) {
  const zoneActive = featCommune || featArr || featDep || featRegion;
  const nomZone = zoneActive?.properties?._nom || '';
  const pcodeZone = zoneActive?.properties?._pcode || '';

  return (
    <div className="panneau-gauche">

      {/* Navigation administrative */}
      <div className="pg-section">
        <div className="pg-section-title">
          <span>🗺️</span> Zone géographique
        </div>

        <div className="cascade-item">
          <div className="cascade-label">
            Région <span className="cascade-count">{regions.length}</span>
          </div>
          <select
            className={`select-field${selRegion ? ' has-value' : ''}`}
            value={selRegion}
            onChange={e => onRegionChange(e.target.value)}
          >
            <option value="">-- Toutes les régions --</option>
            {regions.map(r => (
              <option key={r.pcode} value={r.pcode}>{r.nom}</option>
            ))}
          </select>
        </div>

        <div className="cascade-item">
          <div className="cascade-label">
            Département <span className="cascade-count">{departements.length}</span>
          </div>
          <select
            className={`select-field${selDep ? ' has-value' : ''}`}
            value={selDep}
            onChange={e => onDepChange(e.target.value)}
            disabled={!selRegion}
          >
            <option value="">-- Choisir --</option>
            {departements.map(d => (
              <option key={d.pcode} value={d.pcode}>{d.nom}</option>
            ))}
          </select>
        </div>

        <div className="cascade-item">
          <div className="cascade-label">
            Arrondissement <span className="cascade-count">{arrondissements.length}</span>
          </div>
          <select
            className={`select-field${selArr ? ' has-value' : ''}`}
            value={selArr}
            onChange={e => onArrChange(e.target.value)}
            disabled={!selDep}
          >
            <option value="">-- Choisir --</option>
            {arrondissements.map(a => (
              <option key={a.pcode} value={a.pcode}>{a.nom}</option>
            ))}
          </select>
        </div>

        <div className="cascade-item">
          <div className="cascade-label">
            Commune <span className="cascade-count">{communes.length}</span>
          </div>
          <select
            className={`select-field${selCommune ? ' has-value' : ''}`}
            value={selCommune}
            onChange={e => onCommuneChange(e.target.value)}
            disabled={!selArr}
          >
            <option value="">-- Choisir --</option>
            {communes.map(c => (
              <option key={c.pcode} value={c.pcode}>{c.nom}</option>
            ))}
          </select>
        </div>

        {zoneActive && (
          <div className="fiche-zone">
            <div className="fiche-zone-nom">{nomZone}</div>
            <div className="fiche-zone-pcode">{pcodeZone}</div>
            <div className="fiche-zone-stats">
              {featCommune && <span className="stat-chip">🏡 Commune</span>}
              {!featCommune && featArr && <span className="stat-chip">📢 Arrondissement</span>}
              {!featCommune && !featArr && featDep && <span className="stat-chip">📍 Département</span>}
              {!featCommune && !featArr && !featDep && featRegion && <span className="stat-chip">🌍 Région</span>}
              {featArr && communes.length > 0 && <span className="stat-chip">{communes.length} communes</span>}
              {featDep && arrondissements.length > 0 && <span className="stat-chip">{arrondissements.length} arr.</span>}
            </div>
          </div>
        )}

        {(selRegion || selDep || selArr || selCommune) && (
          <button className="btn-reset" onClick={onReset}>↺ Réinitialiser la sélection</button>
        )}
      </div>

      {/* Visibilite des couches admin */}
      <div className="pg-section">
        <div className="pg-section-title">
          <span>📂</span> Couches administratives
        </div>
        <div className="admin-options">
          <ToggleRow dot="#7f8c8d" label="Régions"          checked={visRegions}    onChange={setVisRegions} />
          <ToggleRow dot="#1a5276" label="Départements"      checked={visDeps}       onChange={setVisDeps} />
          <ToggleRow dot="#117a65" label="Arrondissements"   checked={visArrs}       onChange={setVisArrs} />
          <ToggleRow dot="#e74c3c" label="Communes"          checked={visCommunes}   onChange={setVisCommunes} />
          <ToggleRow dot="#f39c12" label="Étiquettes"        checked={visEtiquettes} onChange={setVisEtiquettes} />
        </div>
      </div>

      {/* Import / Export */}
      <div className="pg-section">
        <div className="pg-section-title">
          <span>📤</span> Import / Export
        </div>
        <div className="io-grid">
          <button className="btn-io import" onClick={onImportClick}>
            📂 Importer<br/>
            <span style={{fontWeight:400, fontSize:'0.68rem'}}>CSV / GeoJSON</span>
          </button>
          <button className="btn-io export" id="btn-export-png">
            🖼️ PNG HD
          </button>
          <button className="btn-io export" id="btn-export-pdf">
            📄 PDF
          </button>
          <button className="btn-io export" id="btn-export-geojson">
            🌐 GeoJSON
          </button>
        </div>
        {importData && (
          <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#27ae60' }}>
            ✅ {importData.features?.length || 0} entités importées
            <button onClick={onImportClear}
              style={{ marginLeft: 8, fontSize: '0.7rem', color: '#e74c3c',
                       background: 'none', border: 'none', cursor: 'pointer' }}>
              ✕ Effacer
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ padding: '8px 14px', fontSize: '0.75rem', color: '#1a5276' }}>
          ⏳ Chargement en cours...
        </div>
      )}
    </div>
  );
}
