import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGeoData } from './hooks/useGeoData';
import CarteV3 from './components/CarteV3';
import PanneauGauche from './components/PanneauGauche';
import GestionnaireCouches from './components/GestionnaireCouches';
import Header from './components/Header';
import ExportCarteModal from './components/ExportCarteModal';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'https://carto-facilesn.onrender.com';

const CATALOGUE = [
  { groupe:'Transport',   id:'routes',          label:'Réseau routier',    couleur:'#888888', icon:'🛣️' },
  { groupe:'Transport',   id:'chemin_fer',       label:'Chemins de fer',    couleur:'#555555', icon:'🚂' },
  { groupe:'Transport',   id:'aeroports',        label:'Aéroports',         couleur:'#2c3e50', icon:'✈️' },
  { groupe:'Hydrologie',  id:'cours_eau',        label:"Cours d'eau",       couleur:'#2980b9', icon:'💧' },
  { groupe:'Hydrologie',  id:'plans_eau',        label:"Plans d'eau",       couleur:'#85c1e9', icon:'🌊' },
  { groupe:'Hydrologie',  id:'points_eau',       label:"Points d'eau",      couleur:'#1a6fa0', icon:'🚰' },
  { groupe:'Végétation',  id:'aires_protegees',  label:'Aires protégées',   couleur:'#1e8449', icon:'🌿' },
  { groupe:'Végétation',  id:'surfaces_boisees', label:'Surfaces boisées',  couleur:'#27ae60', icon:'🌲' },
  { groupe:'Terrain',     id:'courbes_niveau',   label:'Courbes de niveau', couleur:'#b7950b', icon:'🏔️' },
  { groupe:'Terrain',     id:'sable',            label:'Zones sableuses',   couleur:'#d4ac0d', icon:'🏜️' },
  { groupe:'Population',  id:'agglomerations',   label:'Agglomérations',    couleur:'#e67e22', icon:'🏙️' },
  { groupe:'Population',  id:'localites',        label:'Localités',         couleur:'#c0392b', icon:'🏘️' },
  { groupe:'Frontières',  id:'frontieres',       label:'Frontières',        couleur:'#8e44ad', icon:'🗺️' },
];

export default function App() {
  const {
    geoData, chargement, erreur, apiUrl,
    getRegions, getDepartements, getArrondissements, getCommunes, getFeatureByPcode,
  } = useGeoData();

  const [selRegion,  setSelRegion]  = useState('');
  const [selDep,     setSelDep]     = useState('');
  const [selArr,     setSelArr]     = useState('');
  const [selCommune, setSelCommune] = useState('');

  const [visRegions,  setVisRegions]  = useState(true);
  const [visDeps,     setVisDeps]     = useState(true);
  const [visArrs,     setVisArrs]     = useState(false);
  const [visCommunes, setVisCommunes] = useState(true);

  const [visEtiquettes, setVisEtiquettes] = useState({
    regions: true, departements: true, arrondissements: false, communes: false, localites: true,
  });
  const setVisEtiquette = useCallback((niveau, val) => {
    setVisEtiquettes(prev => ({ ...prev, [niveau]: val }));
  }, []);

  const [couleurCommune, setCouleurCommune] = useState('#e74c3c');

  // localites actives par defaut (comme les couches admin)
  const [couchesActives,     setCouchesActives]     = useState(['localites']);
  const [geojsonThematiques, setGeojsonThematiques] = useState({});
  const [prechauffage,       setPrechauffage]       = useState(true);

  const geojsonCacheRef = useRef({});

  const [importData,  setImportData]  = useState(null);
  const [showExport,  setShowExport]  = useState(false);
  const inputImportRef = useRef(null);
  const mapRef         = useRef(null);

  const regions         = getRegions();
  const departements    = getDepartements(selRegion);
  const arrondissements = getArrondissements(selDep);
  const communes        = getCommunes(selArr);

  const featRegion  = selRegion  ? getFeatureByPcode('regions',        selRegion)  : null;
  const featDep     = selDep     ? getFeatureByPcode('departements',    selDep)     : null;
  const featArr     = selArr     ? getFeatureByPcode('arrondissements', selArr)     : null;
  const featCommune = selCommune ? getFeatureByPcode('communes',        selCommune) : null;

  const onRegionChange  = useCallback(v => { setSelRegion(v); setSelDep(''); setSelArr(''); setSelCommune(''); }, []);
  const onDepChange     = useCallback(v => { setSelDep(v);    setSelArr(''); setSelCommune(''); }, []);
  const onArrChange     = useCallback(v => { setSelArr(v);    setSelCommune(''); }, []);
  const onCommuneChange = useCallback(v => setSelCommune(v), []);
  const onReset         = useCallback(() => { setSelRegion(''); setSelDep(''); setSelArr(''); setSelCommune(''); }, []);

  // Charger une couche avec retry (Render cold start ~30s)
  const chargerCouche = useCallback(async (id, tentative = 1) => {
    if (geojsonCacheRef.current[id]) return;
    try {
      const r = await fetch(`${API}/api/couches/thematique/${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!data?.features) throw new Error('Pas de features dans la réponse');
      console.log(`[App] ✔ ${id}: ${data.features.length} features`);
      geojsonCacheRef.current[id] = data;
      setGeojsonThematiques(prev => ({ ...prev, [id]: data }));
    } catch(e) {
      console.warn(`[App] Erreur ${id} (tentative ${tentative}):`, e.message);
      if (tentative < 3) {
        await new Promise(res => setTimeout(res, tentative * 8000));
        return chargerCouche(id, tentative + 1);
      }
      console.error(`[App] ✕ Échec définitif pour ${id}`);
    }
  }, []);

  // Précharger toutes les couches en arrière-plan
  useEffect(() => {
    setPrechauffage(true);
    Promise.all(CATALOGUE.map(c => chargerCouche(c.id)))
      .finally(() => setPrechauffage(false));
  }, [chargerCouche]);

  const toggleCouche = useCallback((id) => {
    setCouchesActives(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
    chargerCouche(id);
  }, [chargerCouche]);

  const handleImportFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        let geojson;
        if (file.name.match(/\.(geojson|json)$/i)) {
          geojson = JSON.parse(text);
        } else if (file.name.match(/\.csv$/i)) {
          const lines   = text.trim().split('\n');
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          const iLat    = headers.findIndex(h => ['lat','latitude','y'].includes(h));
          const iLon    = headers.findIndex(h => ['lon','lng','longitude','x'].includes(h));
          if (iLat < 0 || iLon < 0) { alert('CSV : colonnes lat/lon introuvables'); return; }
          const features = lines.slice(1).map(line => {
            const cols = line.split(',');
            const props = {};
            headers.forEach((h, i) => { props[h] = cols[i]?.trim(); });
            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [parseFloat(cols[iLon]), parseFloat(cols[iLat])] },
              properties: props,
            };
          }).filter(f => !isNaN(f.geometry.coordinates[0]));
          geojson = { type: 'FeatureCollection', features };
        }
        if (geojson) setImportData(geojson);
      } catch(err) { alert('Erreur lecture fichier : ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  return (
    <div className="app-container">
      <Header />

      {chargement && (
        <div className="banniere-info">⏳ Connexion à l’API… ({apiUrl})</div>
      )}
      {!chargement && erreur && (
        <div className="banniere-erreur">
          {erreur}
          {erreur.includes('introuvable') && (
            <span style={{marginLeft:12, fontSize:'0.78rem'}}>
              → Vérifiez le service sur 
              <a href="https://dashboard.render.com" target="_blank" rel="noreferrer"
                style={{color:'#c0392b', fontWeight:700}}>dashboard.render.com</a>
            </span>
          )}
        </div>
      )}

      <div className="main-layout">
        <PanneauGauche
          regions={regions}               departements={departements}
          arrondissements={arrondissements}   communes={communes}
          selRegion={selRegion}           selDep={selDep}
          selArr={selArr}                 selCommune={selCommune}
          onRegionChange={onRegionChange} onDepChange={onDepChange}
          onArrChange={onArrChange}       onCommuneChange={onCommuneChange}
          onReset={onReset}
          featRegion={featRegion}   featDep={featDep}
          featArr={featArr}         featCommune={featCommune}
          visRegions={visRegions}   setVisRegions={setVisRegions}
          visDeps={visDeps}         setVisDeps={setVisDeps}
          visArrs={visArrs}         setVisArrs={setVisArrs}
          visCommunes={visCommunes} setVisCommunes={setVisCommunes}
          visEtiquettes={visEtiquettes} setVisEtiquette={setVisEtiquette}
          couleurCommune={couleurCommune} setCouleurCommune={setCouleurCommune}
          importData={importData}
          onImportClick={() => inputImportRef.current?.click()}
          onImportClear={() => setImportData(null)}
          onExportClick={() => setShowExport(true)}
          loading={chargement}
          apiUrl={apiUrl}
        />

        <input ref={inputImportRef} type="file" accept=".geojson,.json,.csv"
          style={{display:'none'}} onChange={handleImportFile} />

        <CarteV3
          geoData={geoData}
          featRegion={featRegion}  featDep={featDep}
          featArr={featArr}        featCommune={featCommune}
          visRegions={visRegions}  visDeps={visDeps}
          visArrs={visArrs}        visCommunes={visCommunes}
          visEtiquettes={visEtiquettes}
          geojsonThematiques={geojsonThematiques}
          couchesActives={couchesActives}
          catalogue={CATALOGUE}
          importData={importData}
          chargement={chargement}
          selRegion={selRegion}  selDep={selDep}
          selArr={selArr}        selCommune={selCommune}
          onRegionClick={onRegionChange}
          onDepClick={onDepChange}
          onCommuneClick={onCommuneChange}
          couleurCommune={couleurCommune}
          mapRef={mapRef}
        />

        <GestionnaireCouches
          catalogue={CATALOGUE}
          couchesActives={couchesActives}
          toggleCouche={toggleCouche}
          geojsonThematiques={geojsonThematiques}
          prechauffage={prechauffage}
        />
      </div>

      {showExport && (
        <ExportCarteModal
          onClose={() => setShowExport(false)}
          mapRef={mapRef}
          featRegion={featRegion}  featDep={featDep}
          featArr={featArr}        featCommune={featCommune}
          geoData={geoData}
          titre={`Carte ${featCommune?.properties?._nom || featArr?.properties?._nom || featDep?.properties?._nom || featRegion?.properties?._nom || 'administrative du Sénégal'}`}
          sousTitre={featRegion ? `Région de ${featRegion.properties._nom}` : ''}
        />
      )}
    </div>
  );
}
