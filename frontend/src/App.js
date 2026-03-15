import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Carte from './components/Carte';
import PanneauGauche from './components/PanneauGauche';
import PanneauDroit from './components/PanneauDroit';
import Header from './components/Header';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'https://carto-facilesn.onrender.com';
const api = axios.create({ baseURL: API, timeout: 60000 });

export default function App() {
  const [regions, setRegions]               = useState([]);
  const [departements, setDepartements]     = useState([]);
  const [arrondissements, setArrondissements] = useState([]);
  const [communes, setCommunes]             = useState([]);
  const [communeSelectionnee, setCommuneSelectionnee] = useState(null);
  const [couchesActives, setCouchesActives] = useState(['routes', 'cours_eau']);
  const [catalogueCouches, setCatalogueCouches] = useState([]);
  const [geojsonCouches, setGeojsonCouches] = useState({});
  const [loading, setLoading]               = useState(false);
  const [erreur, setErreur]                 = useState('');

  useEffect(() => {
    api.get('/api/communes/regions')
      .then(r => { setRegions(r.data); setErreur(''); })
      .catch(() => setErreur('Serveur en cours de demarrage... Rechargez dans 30s'));
    api.get('/api/couches/catalogue')
      .then(r => setCatalogueCouches(r.data))
      .catch(() => {});
  }, []);

  const onRegionChange = (rid) => {
    setDepartements([]);
    setArrondissements([]);
    setCommunes([]);
    setCommuneSelectionnee(null);
    setGeojsonCouches({});
    if (!rid) return;
    setLoading(true);
    api.get(`/api/communes/regions/${rid}/departements`)
      .then(r => { setDepartements(r.data); setErreur(''); })
      .catch(() => setErreur('Erreur chargement departements'))
      .finally(() => setLoading(false));
  };

  const onDepChange = (did) => {
    setArrondissements([]);
    setCommunes([]);
    setCommuneSelectionnee(null);
    setGeojsonCouches({});
    if (!did) return;
    setLoading(true);
    api.get(`/api/communes/departements/${did}/arrondissements`)
      .then(r => { setArrondissements(r.data); setErreur(''); })
      .catch(() => setErreur('Erreur chargement arrondissements'))
      .finally(() => setLoading(false));
  };

  const onArrChange = (aid) => {
    setCommunes([]);
    setCommuneSelectionnee(null);
    setGeojsonCouches({});
    if (!aid) return;
    setLoading(true);
    api.get(`/api/communes/arrondissements/${aid}/communes`)
      .then(r => { setCommunes(r.data); setErreur(''); })
      .catch(() => setErreur('Erreur chargement communes'))
      .finally(() => setLoading(false));
  };

  const onCommuneChange = (cid) => {
    if (!cid) { setCommuneSelectionnee(null); return; }
    setLoading(true);
    api.get(`/api/communes/${cid}`)
      .then(r => {
        setCommuneSelectionnee(r.data);
        return chargerCouches(r.data, couchesActives);
      })
      .catch(() => setErreur('Erreur chargement commune'))
      .finally(() => setLoading(false));
  };

  const chargerCouches = (commune, types) => {
    if (!commune) return Promise.resolve();
    return Promise.all(types.map(tc =>
      api.get(`/api/couches/${commune.id}/${tc}`)
        .then(r => ({ tc, data: r.data }))
        .catch(() => ({ tc, data: null }))
    )).then(results => {
      const obj = {};
      results.forEach(({ tc, data }) => { obj[tc] = data; });
      setGeojsonCouches(prev => ({ ...prev, ...obj }));
    });
  };

  const toggleCouche = (tc) => {
    if (couchesActives.includes(tc)) {
      setCouchesActives(prev => prev.filter(c => c !== tc));
      setGeojsonCouches(prev => { const n = { ...prev }; delete n[tc]; return n; });
    } else {
      setCouchesActives(prev => [...prev, tc]);
      if (communeSelectionnee) chargerCouches(communeSelectionnee, [tc]);
    }
  };

  return (
    <div className="app-container">
      <Header />
      {erreur && (
        <div style={{
          background:'#fdecea', color:'#c0392b', padding:'6px 16px',
          fontSize:'0.82rem', textAlign:'center', borderBottom:'1px solid #f5c6cb'
        }}>⚠️ {erreur}</div>
      )}
      <div className="main-layout">
        <PanneauGauche
          regions={regions}
          departements={departements}
          arrondissements={arrondissements}
          communes={communes}
          onRegionChange={onRegionChange}
          onDepChange={onDepChange}
          onArrChange={onArrChange}
          onCommuneChange={onCommuneChange}
          communeSelectionnee={communeSelectionnee}
          loading={loading}
        />
        <Carte
          communeSelectionnee={communeSelectionnee}
          geojsonCouches={geojsonCouches}
          loading={loading}
        />
        <PanneauDroit
          catalogueCouches={catalogueCouches}
          couchesActives={couchesActives}
          toggleCouche={toggleCouche}
          communeSelectionnee={communeSelectionnee}
        />
      </div>
    </div>
  );
}
