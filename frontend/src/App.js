import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Carte from './components/Carte';
import PanneauGauche from './components/PanneauGauche';
import PanneauDroit from './components/PanneauDroit';
import Header from './components/Header';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'https://carto-facilesn.onrender.com';

// Axios avec timeout genereux (Render gratuit peut etre lent au 1er appel)
const api = axios.create({ baseURL: API, timeout: 60000 });

export default function App() {
  const [regions, setRegions] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [communeSelectionnee, setCommuneSelectionnee] = useState(null);
  const [couchesActives, setCouchesActives] = useState(['routes', 'cours_eau']);
  const [catalogueCouches, setCatalogueCouches] = useState([]);
  const [geojsonCouches, setGeojsonCouches] = useState({});
  const [loading, setLoading] = useState(false);
  const [regionId, setRegionId] = useState('');
  const [depId, setDepId] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    // Reveiller Render si endormi + charger donnees initiales
    api.get('/api/communes/regions')
      .then(r => { setRegions(r.data); setErreur(''); })
      .catch(() => setErreur('Serveur en cours de démarrage... Patientez 30s et rechargez.'));
    api.get('/api/couches/catalogue')
      .then(r => setCatalogueCouches(r.data))
      .catch(() => {});
  }, []);

  const onRegionChange = async (rid) => {
    setRegionId(rid);
    setDepId('');
    setCommunes([]);
    setCommuneSelectionnee(null);
    setGeojsonCouches({});
    if (!rid) { setDepartements([]); return; }
    setLoading(true);
    try {
      const r = await api.get(`/api/communes/regions/${rid}/departements`);
      setDepartements(r.data);
      setErreur('');
    } catch (e) {
      setErreur('Erreur chargement départements');
    }
    setLoading(false);
  };

  const onDepChange = async (did) => {
    setDepId(did);
    setCommuneSelectionnee(null);
    setGeojsonCouches({});
    if (!did) { setCommunes([]); return; }
    setLoading(true);
    try {
      const r = await api.get(`/api/communes/departements/${did}/communes`);
      setCommunes(r.data);
    } catch (e) {
      setErreur('Erreur chargement communes');
    }
    setLoading(false);
  };

  const onCommuneChange = async (cid) => {
    if (!cid) { setCommuneSelectionnee(null); return; }
    setLoading(true);
    try {
      const r = await api.get(`/api/communes/${cid}`);
      setCommuneSelectionnee(r.data);
      await chargerCouches(r.data, couchesActives);
    } catch (e) {
      setErreur('Erreur chargement commune');
    }
    setLoading(false);
  };

  const chargerCouches = async (commune, types) => {
    if (!commune) return;
    const nouvellesGeojson = {};
    await Promise.all(types.map(async (tc) => {
      try {
        const r = await api.get(`/api/couches/${commune.id}/${tc}`);
        nouvellesGeojson[tc] = r.data;
      } catch (e) {
        nouvellesGeojson[tc] = null;
      }
    }));
    setGeojsonCouches(prev => ({ ...prev, ...nouvellesGeojson }));
  };

  const toggleCouche = async (tc) => {
    if (couchesActives.includes(tc)) {
      setCouchesActives(prev => prev.filter(c => c !== tc));
      setGeojsonCouches(prev => { const n = { ...prev }; delete n[tc]; return n; });
    } else {
      setCouchesActives(prev => [...prev, tc]);
      if (communeSelectionnee) await chargerCouches(communeSelectionnee, [tc]);
    }
  };

  return (
    <div className="app-container">
      <Header />
      {erreur && (
        <div style={{
          background: '#fdecea', color: '#c0392b', padding: '8px 16px',
          fontSize: '0.85rem', textAlign: 'center', borderBottom: '1px solid #f5c6cb'
        }}>
          ⚠️ {erreur}
        </div>
      )}
      <div className="main-layout">
        <PanneauGauche
          regions={regions} departements={departements} communes={communes}
          regionId={regionId} depId={depId}
          onRegionChange={onRegionChange}
          onDepChange={onDepChange}
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
