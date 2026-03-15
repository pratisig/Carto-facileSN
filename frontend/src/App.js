import React, { useState, useCallback } from 'react';
import { useGeoData } from './hooks/useGeoData';
import CarteV2 from './components/CarteV2';
import PanneauGauche from './components/PanneauGauche';
import PanneauDroit from './components/PanneauDroit';
import Header from './components/Header';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'https://carto-facilesn.onrender.com';

export default function App() {
  const {
    geoData, chargement, erreur,
    getRegions, getDepartements, getArrondissements, getCommunes,
    getFeatureByPcode,
  } = useGeoData();

  const [selRegion, setSelRegion]   = useState('');
  const [selDep, setSelDep]         = useState('');
  const [selArr, setSelArr]         = useState('');
  const [selCommune, setSelCommune] = useState('');

  const [couchesActives, setCouchesActives] = useState(['routes', 'cours_eau']);
  const [geojsonThematiques, setGeojsonThematiques] = useState({});
  const [loadingCouche, setLoadingCouche] = useState(false);

  const regions         = getRegions();
  const departements    = getDepartements(selRegion);
  const arrondissements = getArrondissements(selDep);
  const communes        = getCommunes(selArr);

  const featRegion  = selRegion  ? getFeatureByPcode('regions', selRegion)         : null;
  const featDep     = selDep     ? getFeatureByPcode('departements', selDep)       : null;
  const featArr     = selArr     ? getFeatureByPcode('arrondissements', selArr)    : null;
  const featCommune = selCommune ? getFeatureByPcode('communes', selCommune)       : null;

  const onRegionChange = useCallback((pcode) => {
    setSelRegion(pcode); setSelDep(''); setSelArr(''); setSelCommune('');
  }, []);

  const onDepChange = useCallback((pcode) => {
    setSelDep(pcode); setSelArr(''); setSelCommune('');
  }, []);

  const onArrChange = useCallback((pcode) => {
    setSelArr(pcode); setSelCommune('');
  }, []);

  const onCommuneChange = useCallback((pcode) => {
    setSelCommune(pcode);
  }, []);

  const chargerCoucheThematique = useCallback(async (id_couche) => {
    if (geojsonThematiques[id_couche]) return;
    setLoadingCouche(true);
    try {
      const r = await fetch(`${API}/api/couches/thematique/${id_couche}`);
      const data = await r.json();
      setGeojsonThematiques(prev => ({ ...prev, [id_couche]: data }));
    } catch (e) {
      console.warn(`Erreur chargement couche ${id_couche}`, e);
    } finally {
      setLoadingCouche(false);
    }
  }, [geojsonThematiques]);

  const toggleCouche = useCallback((id_couche) => {
    if (couchesActives.includes(id_couche)) {
      setCouchesActives(prev => prev.filter(c => c !== id_couche));
    } else {
      setCouchesActives(prev => [...prev, id_couche]);
      chargerCoucheThematique(id_couche);
    }
  }, [couchesActives, chargerCoucheThematique]);

  const catalogueCouches = [
    { id: 'routes',          description: 'Réseau routier',    couleur_defaut: '#888888' },
    { id: 'chemin_fer',      description: 'Chemins de fer',    couleur_defaut: '#444444' },
    { id: 'cours_eau',       description: "Cours d'eau",       couleur_defaut: '#3498db' },
    { id: 'plans_eau',       description: "Plans d'eau",       couleur_defaut: '#85c1e9' },
    { id: 'points_eau',      description: "Points d'eau",      couleur_defaut: '#2980b9' },
    { id: 'aires_protegees', description: 'Aires protégées',   couleur_defaut: '#1e8449' },
    { id: 'courbes_niveau',  description: 'Courbes de niveau', couleur_defaut: '#b7950b' },
    { id: 'sable',           description: 'Zones sableuses',   couleur_defaut: '#f0e68c' },
    { id: 'agglomerations',  description: 'Agglomérations',    couleur_defaut: '#e67e22' },
    { id: 'aeroports',       description: 'Aéroports',         couleur_defaut: '#2c3e50' },
    { id: 'localites',       description: 'Localités',         couleur_defaut: '#c0392b' },
    { id: 'surfaces_boisees',description: 'Surfaces boisées',  couleur_defaut: '#27ae60' },
    { id: 'frontieres',      description: 'Frontières',        couleur_defaut: '#2c3e50' },
  ];

  return (
    <div className="app-container">
      <Header />
      {erreur && (
        <div style={{
          background:'#fdecea', color:'#c0392b', padding:'6px 16px',
          fontSize:'0.82rem', textAlign:'center', borderBottom:'1px solid #f5c6cb'
        }}>⚠️ {erreur}</div>
      )}
      {chargement && (
        <div style={{
          background:'#eaf4fb', color:'#1a5276', padding:'6px 16px',
          fontSize:'0.82rem', textAlign:'center', borderBottom:'1px solid #aed6f1'
        }}>⏳ Chargement des données géographiques...</div>
      )}
      <div className="main-layout">
        <PanneauGauche
          regions={regions}
          departements={departements}
          arrondissements={arrondissements}
          communes={communes}
          selRegion={selRegion}
          selDep={selDep}
          selArr={selArr}
          selCommune={selCommune}
          onRegionChange={onRegionChange}
          onDepChange={onDepChange}
          onArrChange={onArrChange}
          onCommuneChange={onCommuneChange}
          featCommune={featCommune}
          loading={chargement || loadingCouche}
        />
        <CarteV2
          geoData={geoData}
          featRegion={featRegion}
          featDep={featDep}
          featArr={featArr}
          featCommune={featCommune}
          geojsonThematiques={geojsonThematiques}
          couchesActives={couchesActives}
          catalogueCouches={catalogueCouches}
          chargement={chargement}
        />
        <PanneauDroit
          catalogueCouches={catalogueCouches}
          couchesActives={couchesActives}
          toggleCouche={toggleCouche}
          featCommune={featCommune}
        />
      </div>
    </div>
  );
}
