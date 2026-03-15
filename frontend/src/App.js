import React, { useState, useCallback, useRef } from 'react';
import { useGeoData } from './hooks/useGeoData';
import CarteV3 from './components/CarteV3';
import PanneauGauche from './components/PanneauGauche';
import GestionnaireCouches from './components/GestionnaireCouches';
import Header from './components/Header';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'https://carto-facilesn-api.onrender.com';

// Catalogue statique des couches thematiques
const CATALOGUE = [
  { groupe: 'Transport',   id: 'routes',          label: 'Reseau routier',     couleur: '#888888', icon: '\u{1F6E3}' },
  { groupe: 'Transport',   id: 'chemin_fer',       label: 'Chemins de fer',     couleur: '#444444', icon: '\u{1F682}' },
  { groupe: 'Transport',   id: 'aeroports',        label: 'Aeroports',          couleur: '#2c3e50', icon: '\u2708' },
  { groupe: 'Hydrologie',  id: 'cours_eau',        label: "Cours d'eau",        couleur: '#2980b9', icon: '\u{1F4A7}' },
  { groupe: 'Hydrologie',  id: 'plans_eau',        label: "Plans d'eau",        couleur: '#85c1e9', icon: '\u{1F30A}' },
  { groupe: 'Hydrologie',  id: 'points_eau',       label: "Points d'eau",       couleur: '#1a6fa0', icon: '\u{1F6B0}' },
  { groupe: 'Vegetation',  id: 'aires_protegees',  label: 'Aires protegees',    couleur: '#1e8449', icon: '\u{1F33F}' },
  { groupe: 'Vegetation',  id: 'surfaces_boisees', label: 'Surfaces boisees',   couleur: '#27ae60', icon: '\u{1F332}' },
  { groupe: 'Terrain',     id: 'courbes_niveau',   label: 'Courbes de niveau',  couleur: '#b7950b', icon: '\u{1F3D4}' },
  { groupe: 'Terrain',     id: 'sable',            label: 'Zones sableuses',    couleur: '#d4ac0d', icon: '\u{1F3DC}' },
  { groupe: 'Population',  id: 'agglomerations',   label: 'Agglomerations',     couleur: '#e67e22', icon: '\u{1F3D9}' },
  { groupe: 'Population',  id: 'localites',        label: 'Localites',          couleur: '#c0392b', icon: '\u{1F3D8}' },
  { groupe: 'Frontieres',  id: 'frontieres',       label: 'Frontieres',         couleur: '#2c3e50', icon: '\u{1F5FA}' },
];

export default function App() {
  const {
    geoData, chargement, erreur,
    getRegions, getDepartements, getArrondissements, getCommunes,
    getFeatureByPcode,
  } = useGeoData();

  // Selections
  const [selRegion,   setSelRegion]   = useState('');
  const [selDep,      setSelDep]      = useState('');
  const [selArr,      setSelArr]      = useState('');
  const [selCommune,  setSelCommune]  = useState('');

  // Couches admin visibles
  const [visRegions,    setVisRegions]    = useState(true);
  const [visDeps,       setVisDeps]       = useState(true);
  const [visArrs,       setVisArrs]       = useState(false);
  const [visCommunes,   setVisCommunes]   = useState(true);
  const [visEtiquettes, setVisEtiquettes] = useState(true);

  // Couches thematiques
  const [couchesActives, setCouchesActives]       = useState(['routes', 'cours_eau']);
  const [geojsonThematiques, setGeojsonThematiques] = useState({});
  const [loadingCouche, setLoadingCouche]           = useState(false);

  // Import fichier
  const [importData, setImportData] = useState(null);
  const inputImportRef = useRef(null);

  // Listes filtrees
  const regions         = getRegions();
  const departements    = getDepartements(selRegion);
  const arrondissements = getArrondissements(selDep);
  const communes        = getCommunes(selArr);

  // Features selectionnees
  const featRegion  = selRegion  ? getFeatureByPcode('regions', selRegion)             : null;
  const featDep     = selDep     ? getFeatureByPcode('departements', selDep)           : null;
  const featArr     = selArr     ? getFeatureByPcode('arrondissements', selArr)        : null;
  const featCommune = selCommune ? getFeatureByPcode('communes', selCommune)           : null;

  // Handlers cascade
  const onRegionChange  = useCallback(v => { setSelRegion(v); setSelDep(''); setSelArr(''); setSelCommune(''); }, []);
  const onDepChange     = useCallback(v => { setSelDep(v);    setSelArr(''); setSelCommune(''); }, []);
  const onArrChange     = useCallback(v => { setSelArr(v);    setSelCommune(''); }, []);
  const onCommuneChange = useCallback(v => { setSelCommune(v); }, []);
  const onReset         = useCallback(() => { setSelRegion(''); setSelDep(''); setSelArr(''); setSelCommune(''); }, []);

  // Chargement couche thematique a la demande
  const chargerCouche = useCallback(async (id) => {
    if (geojsonThematiques[id]) return;
    setLoadingCouche(true);
    try {
      const r = await fetch(`${API}/api/couches/thematique/${id}`);
      const data = await r.json();
      setGeojsonThematiques(prev => ({ ...prev, [id]: data }));
    } catch (e) { console.warn('Couche erreur', id, e); }
    finally { setLoadingCouche(false); }
  }, [geojsonThematiques]);

  const toggleCouche = useCallback((id) => {
    setCouchesActives(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
    chargerCouche(id);
  }, [chargerCouche]);

  // Import fichier
  const handleImportFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        let geojson;
        if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
          geojson = JSON.parse(text);
        } else if (file.name.endsWith('.csv')) {
          // CSV -> GeoJSON points (colonnes lat/lon ou latitude/longitude)
          const lines = text.trim().split('\n');
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          const iLat = headers.findIndex(h => ['lat','latitude','y'].includes(h));
          const iLon = headers.findIndex(h => ['lon','lng','longitude','x'].includes(h));
          if (iLat < 0 || iLon < 0) { alert('CSV: colonnes lat/lon introuvables'); return; }
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
      } catch (err) { alert('Erreur lecture fichier: ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const clearImport = useCallback(() => setImportData(null), []);

  return (
    <div className="app-container">
      <Header />
      {chargement && <div className="banniere-info">⏳ Chargement des couches administratives...</div>}
      {erreur    && <div className="banniere-erreur">⚠️ {erreur}</div>}
      <div className="main-layout">
        <PanneauGauche
          regions={regions} departements={departements}
          arrondissements={arrondissements} communes={communes}
          selRegion={selRegion} selDep={selDep}
          selArr={selArr}       selCommune={selCommune}
          onRegionChange={onRegionChange} onDepChange={onDepChange}
          onArrChange={onArrChange}       onCommuneChange={onCommuneChange}
          onReset={onReset}
          featRegion={featRegion} featDep={featDep}
          featArr={featArr}       featCommune={featCommune}
          visRegions={visRegions}   setVisRegions={setVisRegions}
          visDeps={visDeps}         setVisDeps={setVisDeps}
          visArrs={visArrs}         setVisArrs={setVisArrs}
          visCommunes={visCommunes} setVisCommunes={setVisCommunes}
          visEtiquettes={visEtiquettes} setVisEtiquettes={setVisEtiquettes}
          importData={importData}
          onImportClick={() => inputImportRef.current?.click()}
          onImportClear={clearImport}
          loading={chargement || loadingCouche}
        />
        <input
          ref={inputImportRef} type="file"
          accept=".geojson,.json,.csv,.kml"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
        <CarteV3
          geoData={geoData}
          featRegion={featRegion}   featDep={featDep}
          featArr={featArr}         featCommune={featCommune}
          visRegions={visRegions}   visDeps={visDeps}
          visArrs={visArrs}         visCommunes={visCommunes}
          visEtiquettes={visEtiquettes}
          geojsonThematiques={geojsonThematiques}
          couchesActives={couchesActives}
          catalogue={CATALOGUE}
          importData={importData}
          chargement={chargement}
          selRegion={selRegion} selDep={selDep}
          selArr={selArr}       selCommune={selCommune}
          onRegionClick={onRegionChange}
          onDepClick={onDepChange}
          onCommuneClick={onCommuneChange}
        />
        <GestionnaireCouches
          catalogue={CATALOGUE}
          couchesActives={couchesActives}
          toggleCouche={toggleCouche}
          geojsonThematiques={geojsonThematiques}
        />
      </div>
    </div>
  );
}
