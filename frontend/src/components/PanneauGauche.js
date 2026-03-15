import React from 'react';

function ToggleRow({ dot, label, checked, onChange }) {
  return (
    <div className="toggle-row" onClick={() => onChange(!checked)}>
      <div className="toggle-row-label">
        <span className="level-dot" style={{ background: dot }} />
        <span style={{ fontSize: '0.78rem', color: '#2c3e50' }}>{label}</span>
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
  loading,
}) {
  const zoneActive = featCommune || featArr || featDep || featRegion;
  const nomZone    = zoneActive?.properties?._nom || '';
  const pcodeZone  = zoneActive?.properties?._pcode || '';

  return (
    <div className="panneau-gauche">

      {/* ===== Navigation administrative ===== */}
      <div className="pg-section">
        <div className="pg-section-title">
          <span>🗺️</span> Zone géographique
        </div>

        <div className="cascade-item">
          <div className="cascade-label">
            Région
            <span className="cascade-count">{regions.length}</span>
          </div>
          <select
            className={`select-field${selRegion ? ' has-value' : ''}`}
            value={selRegion}
            onChange={e => onRegionChange(e.target.value)}
          >
            <option value="">-- Toutes les régions --</option>
            {regions.map(r => <option key={r.pcode} value={r.pcode}>{r.nom}</option>)}
          </select>
        </div>

        <div className="cascade-item">
          <div className="cascade-label">
            Département
            <span className="cascade-count">{departements.length}</span>
          </div>
          <select
            className={`select-field${selDep ? ' has-value' : ''}`}
            value={selDep}
            onChange={e => onDepChange(e.target.value)}
            disabled={!selRegion}
          >
            <option value="">-- Choisir --</option>
            {departements.map(d => <option key={d.pcode} value={d.pcode}>{d.nom}</option>)}
          </select>
        </div>

        <div className="cascade-item">
          <div className="cascade-label">
            Arrondissement
            <span className="cascade-count">{arrondissements.length}</span>
          </div>
          <select
            className={`select-field${selArr ? ' has-value' : ''}`}
            value={selArr}
            onChange={e => onArrChange(e.target.value)}
            disabled={!selDep}
          >
            <option value="">-- Choisir --</option>
            {arrondissements.map(a => <option key={a.pcode} value={a.pcode}>{a.nom}</option>)}
          </select>
        </div>

        <div className="cascade-item">
          <div className="cascade-label">
            Commune
            <span className="cascade-count">{communes.length}</span>
          </div>
          <select
            className={`select-field${selCommune ? ' has-value' : ''}`}
            value={selCommune}
            onChange={e => onCommuneChange(e.target.value)}
            disabled={!selArr}
          >
            <option value="">-- Choisir --</option>
            {communes.map(c => <option key={c.pcode} value={c.pcode}>{c.nom}</option>)}
          </select>
        </div>

        {zoneActive && (
          <div className="zone-active-card">
            <div className="zone-active-nom">{nomZone}</div>
            <div className="zone-active-pcode">{pcodeZone}</div>
            <button className="btn-reset" onClick={onReset}>✕ Réinitialiser la sélection</button>
          </div>
        )}
      </div>

      {/* ===== Couleur commune sélectionnée ===== */}
      {selCommune && (
        <div className="pg-section">
          <div className="pg-section-title"><span>🎨</span> Couleur de la commune</div>
          <div className="couleur-commune-row">
            <input
              type="color"
              value={couleurCommune}
              onChange={e => setCouleurCommune(e.target.value)}
              title="Choisir la couleur de surbrillance"
            />
            <span style={{ fontSize: '0.76rem', color: '#4a6285' }}>Surbrillance</span>
            <button
              className="btn-couleur-reset"
              onClick={() => setCouleurCommune('#e74c3c')}
              title="Réinitialiser au rouge"
            >↺ Défaut</button>
          </div>
        </div>
      )}

      {/* ===== Visibilité couches admin ===== */}
      <div className="pg-section">
        <div className="pg-section-title"><span>👁️</span> Visibilité</div>
        <ToggleRow dot="#95a5a6" label="Régions"         checked={visRegions}  onChange={setVisRegions}  />
        <ToggleRow dot="#7f8c8d" label="Départements"    checked={visDeps}     onChange={setVisDeps}     />
        <ToggleRow dot="#aab7b8" label="Arrondissements" checked={visArrs}     onChange={setVisArrs}     />
        <ToggleRow dot="#e74c3c" label="Communes"        checked={visCommunes} onChange={setVisCommunes} />
      </div>

      {/* ===== Étiquettes ===== */}
      <div className="pg-section">
        <div className="pg-section-title"><span>🏷️</span> Étiquettes</div>
        <ToggleRow dot="#7f8c8d" label="Noms régions"         checked={visEtiquettes.regions}         onChange={v => setVisEtiquette('regions', v)}         />
        <ToggleRow dot="#7f8c8d" label="Noms départements"    checked={visEtiquettes.departements}    onChange={v => setVisEtiquette('departements', v)}    />
        <ToggleRow dot="#7f8c8d" label="Noms arrondissements" checked={visEtiquettes.arrondissements} onChange={v => setVisEtiquette('arrondissements', v)} />
        <ToggleRow dot="#e74c3c" label="Noms communes"        checked={visEtiquettes.communes}        onChange={v => setVisEtiquette('communes', v)}        />
      </div>

      {/* ===== Données ===== */}
      <div className="pg-section">
        <div className="pg-section-title"><span>📂</span> Données</div>
        <button className="btn-action" onClick={onImportClick}>⬆️ Importer GeoJSON / CSV</button>
        {importData && (
          <button className="btn-action btn-danger" onClick={onImportClear}>🗑️ Supprimer l'import</button>
        )}
        <button className="btn-action" onClick={onExportClick}>⬇️ Exporter la carte (PNG)</button>
      </div>

      {loading && <div className="pg-loading">⏳ Connexion…</div>}
    </div>
  );
}
