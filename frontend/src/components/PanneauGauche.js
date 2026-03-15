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
  visEtiquettes, setVisEtiquette,
  couleurCommune, setCouleurCommune,
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
          <div className="zone-active-card">
            <div className="zone-active-nom">{nomZone}</div>
            <div className="zone-active-pcode">{pcodeZone}</div>
            <button className="btn-reset" onClick={onReset}>✕ Réinitialiser</button>
          </div>
        )}
      </div>

      {/* Personnalisation couleur commune selectionnee */}
      {selCommune && (
        <div className="pg-section">
          <div className="pg-section-title"><span>🎨</span> Couleur commune</div>
          <div style={{display:'flex', alignItems:'center', gap:10, padding:'4px 0'}}>
            <input
              type="color"
              value={couleurCommune}
              onChange={e => setCouleurCommune(e.target.value)}
              style={{
                width:36, height:30, cursor:'pointer',
                border:'1.5px solid #cdd9e0', borderRadius:6, padding:2,
                background:'white'
              }}
              title="Choisir la couleur de la commune sélectionnée"
            />
            <span style={{fontSize:'0.8rem', color:'#4a6285'}}>
              Couleur de surbrillance
            </span>
            <button
              onClick={() => setCouleurCommune('#e74c3c')}
              style={{
                marginLeft:'auto', fontSize:'0.7rem', padding:'2px 7px',
                border:'1px solid #cdd9e0', borderRadius:5, cursor:'pointer',
                background:'#f7f9fc', color:'#888'
              }}
              title="Réinitialiser la couleur"
            >↺</button>
          </div>
        </div>
      )}

      {/* Visibilite des couches admin */}
      <div className="pg-section">
        <div className="pg-section-title"><span>👁️</span> Visibilité</div>
        <ToggleRow dot="#bdc3c7" label="Régions"         checked={visRegions}  onChange={setVisRegions}  />
        <ToggleRow dot="#95a5a6" label="Départements"    checked={visDeps}     onChange={setVisDeps}     />
        <ToggleRow dot="#aab7b8" label="Arrondissements" checked={visArrs}     onChange={setVisArrs}     />
        <ToggleRow dot="#e74c3c" label="Communes"        checked={visCommunes} onChange={setVisCommunes} />
      </div>

      {/* Etiquettes */}
      <div className="pg-section">
        <div className="pg-section-title"><span>🏷️</span> Étiquettes</div>
        <ToggleRow dot="#7f8c8d" label="Noms régions"         checked={visEtiquettes.regions}         onChange={v=>setVisEtiquette('regions',v)}         />
        <ToggleRow dot="#95a5a6" label="Noms départements"    checked={visEtiquettes.departements}    onChange={v=>setVisEtiquette('departements',v)}    />
        <ToggleRow dot="#aab7b8" label="Noms arrondissements" checked={visEtiquettes.arrondissements} onChange={v=>setVisEtiquette('arrondissements',v)} />
        <ToggleRow dot="#e74c3c" label="Noms communes"        checked={visEtiquettes.communes}        onChange={v=>setVisEtiquette('communes',v)}        />
      </div>

      {/* Import / Export */}
      <div className="pg-section">
        <div className="pg-section-title"><span>📂</span> Données</div>
        <button className="btn-action" onClick={onImportClick}>⬆️ Importer GeoJSON / CSV</button>
        {importData && (
          <button className="btn-action btn-danger" onClick={onImportClear}>🗑 Supprimer import</button>
        )}
        <button className="btn-action" onClick={onExportClick}>⬇️ Exporter carte (PNG)</button>
      </div>

      {loading && (
        <div className="pg-loading">⏳ Chargement...</div>
      )}
    </div>
  );
}
