import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Carte from './components/Carte';
import PanneauGauche from './components/PanneauGauche';
import PanneauDroit from './components/PanneauDroit';
import Header from './components/Header';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'https://carto-facilesn.onrender.com';

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

  useEffect(() => {
    axios.get(`${API}/api/communes/regions`).then(r => setRegions(r.data)).catch(() => {});
    axios.get(`${API}/api/couches/catalogue`).then(r => setCatalogueCouches(r.data)).catch(() => {});
  }, []);

  const onRegionChange = async (rid) => {
    setRegionId(rid); setDepId(''); setCommunes([]); setCommuneSelectionnee(null);
    if (!rid) { setDepartements([]); return; }
    const r = await axios.get(`${API}/api/communes/regions/${rid}/departements`);
    setDepartements(r.data);
  };

  const onDepChange = async (did) => {
    setDepId(did); setCommuneSelectionnee(null);
    if (!did) { setCommunes([]); return; }
    const r = await axios.get(`${API}/api/communes/departements/${did}/communes`);
    setCommunes(r.data);
  };

  const onCommuneChange = async (cid) => {
    if (!cid) { setCommuneSelectionnee(null); return; }
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/communes/${cid}`);
      setCommuneSelectionnee(r.data);
      await chargerCouches(r.data, couchesActives);
    } catch(e) {}
    setLoading(false);
  };

  const chargerCouches = async (commune, types) => {
    if (!commune) return;
    setLoading(true);
    const nouvellesGeojson = {};
    await Promise.all(types.map(async (tc) => {
      try {
        const r = await axios.get(`${API}/api/couches/${commune.id}/${tc}`);
        nouvellesGeojson[tc] = r.data;
      } catch(e) { nouvellesGeojson[tc] = null; }
    }));
    setGeojsonCouches(prev => ({ ...prev, ...nouvellesGeojson }));
    setLoading(false);
  };

  const toggleCouche = async (tc) => {
    let newActives;
    if (couchesActives.includes(tc)) {
      newActives = couchesActives.filter(c => c !== tc);
      setGeojsonCouches(prev => { const n = { ...prev }; delete n[tc]; return n; });
    } else {
      newActives = [...couchesActives, tc];
      if (communeSelectionnee) await chargerCouches(communeSelectionnee, [tc]);
    }
    setCouchesActives(newActives);
  };

  return (
    <div className="app-container">
      <Header />
      <div className="main-layout">
        <PanneauGauche
          regions={regions} departements={departements} communes={communes}
          regionId={regionId} depId={depId}
          onRegionChange={onRegionChange}
          onDepChange={onDepChange}
          onCommuneChange={onCommuneChange}
          communeSelectionnee={communeSelectionnee}
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
