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
  // visEtiquettes est maintenant un objet {regions, departements, arrondissements, communes}
  visEtiquettes, setVisEtiquette,
  importData, onImportClick, onImportClear, onExportClick,
  loading
}) {
  const zoneActive = featCommune || featArr || featDep || featRegion;
  const nomZone    = zoneActive?.properties?._nom || '';
  const pcodeZone  = zoneActive?.properties?._pcode || '';

  return (
    <div className="panneau-gauche">

      {/* Navigation administrative */}
      <div className="pg-section">
        <div className="pg-section-title"><span>🗺️</span> Zone géographique</div>

        <div className="cascade-item">
          <div className="cascade-label">Région <span className="cascade-count">{regions.length}</span></div>
          <select className={`select-field${selRegion?' has-value':''}`}
            value={selRegion} onChange={e=>onRegionChange(e.target.value)}>
            <option value="">-- Toutes les régions --</option>
            {regions.map(r=>(<option key={r.pcode} value={r.pcode}>{r.nom}</option>))}
          </select>
        </div>

        <div className="cascade-item">
          <div className="cascade-label">Département <span className="cascade-count">{departements.length}</span></div>
          <select className={`select-field${selDep?' has-value':''}`}
            value={selDep} onChange={e=>onDepChange(e.target.value)} disabled={!selRegion}>
            <option value="">-- Choisir --</option>
            {departements.map(d=>(<option key={d.pcode} value={d.pcode}>{d.nom}</option>))}
          </select>
        </div>

        <div className="cascade-item">
          <div className="cascade-label">Arrondissement <span className="cascade-count">{arrondissements.length}</span></div>
          <select className={`select-field${selArr?' has-value':''}`}
            value={selArr} onChange={e=>onArrChange(e.target.value)} disabled={!selDep}>
            <option value="">-- Choisir --</option>
            {arrondissements.map(a=>(<option key={a.pcode} value={a.pcode}>{a.nom}</option>))}
          </select>
        </div>

        <div className="cascade-item">
          <div className="cascade-label">Commune <span className="cascade-count">{communes.length}</span></div>
          <select className={`select-field${selCommune?' has-value':''}`}
            value={selCommune} onChange={e=>onCommuneChange(e.target.value)} disabled={!selArr}>
            <option value="">-- Choisir --</option>
            {communes.map(c=>(<option key={c.pcode} value={c.pcode}>{c.nom}</option>))}
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
              {featArr && communes.length>0 && <span className="stat-chip">{communes.length} communes</span>}
              {featDep && !featArr && arrondissements.length>0 && <span className="stat-chip">{arrondissements.length} arr.</span>}
            </div>
          </div>
        )}
        {(selRegion||selDep||selArr||selCommune) && (
          <button className="btn-reset" onClick={onReset}>↺ Réinitialiser</button>
        )}
      </div>

      {/* Couches admin */}
      <div className="pg-section">
        <div className="pg-section-title"><span>📂</span> Couches administratives</div>
        <ToggleRow dot="#7f8c8d" label="Régions (polygones)"       checked={visRegions}  onChange={setVisRegions} />
        <ToggleRow dot="#1a5276" label="Départements (polygones)"   checked={visDeps}     onChange={setVisDeps} />
        <ToggleRow dot="#117a65" label="Arrondissements (polygones)" checked={visArrs}     onChange={setVisArrs} />
        <ToggleRow dot="#e74c3c" label="Communes (polygones)"       checked={visCommunes} onChange={setVisCommunes} />
      </div>

      {/* Etiquettes individuelles */}
      <div className="pg-section">
        <div className="pg-section-title"><span>🏷️</span> Étiquettes (auto-zoom)</div>
        <div style={{fontSize:'0.68rem',color:'#888',marginBottom:6,lineHeight:1.5}}>
          Régions ≥ zoom 5 · Dép. ≥ 8 · Arr. ≥ 10 · Communes ≥ 11
        </div>
        <ToggleRow dot="#7f8c8d" label="Noms des régions"          checked={visEtiquettes.regions}         onChange={v=>setVisEtiquette('regions',v)} />
        <ToggleRow dot="#1a5276" label="Noms des départements"      checked={visEtiquettes.departements}    onChange={v=>setVisEtiquette('departements',v)} />
        <ToggleRow dot="#117a65" label="Noms des arrondissements"   checked={visEtiquettes.arrondissements} onChange={v=>setVisEtiquette('arrondissements',v)} />
        <ToggleRow dot="#e74c3c" label="Noms des communes"         checked={visEtiquettes.communes}        onChange={v=>setVisEtiquette('communes',v)} />
      </div>

      {/* Import / Export */}
      <div className="pg-section">
        <div className="pg-section-title"><span>📤</span> Import / Export</div>
        <div className="io-grid">
          <button className="btn-io import" onClick={onImportClick}>
            📂 Importer<br/><span style={{fontWeight:400,fontSize:'0.68rem'}}>CSV / GeoJSON</span>
          </button>
          <button className="btn-io export" onClick={onExportClick}>
            🗺️ Exporter<br/><span style={{fontWeight:400,fontSize:'0.68rem'}}>PNG / PDF</span>
          </button>
        </div>
        {importData && (
          <div style={{marginTop:8,fontSize:'0.75rem',color:'#27ae60'}}>
            ✅ {importData.features?.length||0} entités importées
            <button onClick={onImportClear}
              style={{marginLeft:8,fontSize:'0.7rem',color:'#e74c3c',background:'none',border:'none',cursor:'pointer'}}>
              ✕ Effacer
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div style={{padding:'8px 14px',fontSize:'0.75rem',color:'#1a5276'}}>⏳ Chargement...</div>
      )}
    </div>
  );
}
