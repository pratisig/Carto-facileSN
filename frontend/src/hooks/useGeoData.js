/**
 * Hook central — charge les 4 GeoJSON admin avec retry + fallback _nom/_pcode.
 * Si le backend ne renvoie pas _nom/_pcode, on cherche dans toutes les proprietes.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const API = process.env.REACT_APP_API_URL || 'https://carto-facilesn.onrender.com';

const MAX_RETRIES = 6;
const RETRY_DELAY = 10000;

// Candidates pour trouver le nom dans les props
const NOM_KEYS = ['_nom','NOM','NAME','ADM1_FR','ADM1_EN','ADM2_FR','ADM2_EN',
  'ADM3_FR','ADM3_EN','ADM4_FR','ADM4_EN','REGION','DEPARTEMEN','ARRONDISSE','COMMUNE'];
const PCODE_KEYS = ['_pcode','PCODE','ADM1_PCODE','ADM2_PCODE','ADM3_PCODE','ADM4_PCODE','CODE'];
const PCODE_REG_KEYS  = ['_pcode_region','ADMIN1_PCO','ADM1_PCODE'];
const PCODE_DEP_KEYS  = ['_pcode_dep','ADMIN2_PCO','ADM2_PCODE'];
const PCODE_ARR_KEYS  = ['_pcode_arr','ADMIN3_PCO','ADM3_PCODE'];

function findVal(props, keys) {
  for (const k of keys) {
    if (props[k] !== undefined && props[k] !== null && props[k] !== '') return String(props[k]).trim();
  }
  // Recherche insensible a la casse
  const upper = Object.fromEntries(Object.entries(props).map(([k,v]) => [k.toUpperCase(), v]));
  for (const k of keys) {
    const v = upper[k.toUpperCase()];
    if (v !== undefined && v !== null && v !== '') return String(v).trim();
  }
  return '';
}

/**
 * Normalise une FeatureCollection : garantit _nom, _pcode,
 * _pcode_region, _pcode_dep, _pcode_arr sur chaque feature.
 */
function normaliser(fc, niveau) {
  if (!fc?.features) return fc;
  return {
    ...fc,
    features: fc.features.map((f, i) => {
      const p = f.properties || {};
      const nom   = findVal(p, NOM_KEYS)   || `${niveau} ${i+1}`;
      const pcode = findVal(p, PCODE_KEYS) || String(i+1);
      return {
        ...f,
        properties: {
          ...p,
          _nom:          nom,
          _pcode:        pcode,
          _pcode_region: findVal(p, PCODE_REG_KEYS),
          _pcode_dep:    findVal(p, PCODE_DEP_KEYS),
          _pcode_arr:    findVal(p, PCODE_ARR_KEYS),
          _niveau:       niveau,
          _id:           p._id || i+1,
        }
      };
    })
  };
}

async function fetchAvecTimeout(url, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

export function useGeoData() {
  const [geoData, setGeoData] = useState({
    regions: null, departements: null, arrondissements: null, communes: null,
  });
  const [chargement, setChargement] = useState(true);
  const [erreur,     setErreur]     = useState('');
  const [apiUrl,     setApiUrl]     = useState(API);
  const retryTimer = useRef(null);

  useEffect(() => {
    let annule = false;
    setApiUrl(API);

    const charger = async (essai = 0) => {
      if (annule) return;
      setChargement(true);
      if (essai > 0) setErreur(`\u23f3 API en demarrage... tentative ${essai}/${MAX_RETRIES}`);

      try {
        const [r, d, a, c] = await Promise.all([
          fetchAvecTimeout(`${API}/api/couches/admin/regions`),
          fetchAvecTimeout(`${API}/api/couches/admin/departements`),
          fetchAvecTimeout(`${API}/api/couches/admin/arrondissements`),
          fetchAvecTimeout(`${API}/api/couches/admin/communes`),
        ]);
        if (annule) return;

        // Normalisation : garantit _nom et _pcode meme si backend incomplet
        setGeoData({
          regions:         normaliser(r, 'regions'),
          departements:    normaliser(d, 'departements'),
          arrondissements: normaliser(a, 'arrondissements'),
          communes:        normaliser(c, 'communes'),
        });
        setErreur('');
        setChargement(false);

        // Log diagnostic
        console.log('[useGeoData] Charge:',
          r?.features?.length, 'regions,',
          d?.features?.length, 'deps,',
          a?.features?.length, 'arrs,',
          c?.features?.length, 'communes'
        );
        if (r?.features?.[0]) {
          console.log('[useGeoData] Exemple region props:', r.features[0].properties);
        }
      } catch (e) {
        if (annule) return;
        console.warn('[useGeoData] Erreur:', e.message);
        if (essai < MAX_RETRIES) {
          setErreur(`\u26a0\ufe0f API inaccessible \u2014 nouvelle tentative dans ${RETRY_DELAY/1000}s... (${essai+1}/${MAX_RETRIES})`);
          setChargement(false);
          retryTimer.current = setTimeout(() => charger(essai + 1), RETRY_DELAY);
        } else {
          setErreur(`\u274c API introuvable apres ${MAX_RETRIES} tentatives. URL : ${API}`);
          setChargement(false);
        }
      }
    };

    charger(0);
    return () => {
      annule = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const getRegions = useCallback(() => {
    if (!geoData.regions?.features) return [];
    return geoData.regions.features
      .filter(f => f.properties._nom)
      .map(f => ({ pcode: f.properties._pcode, nom: f.properties._nom, feature: f }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [geoData.regions]);

  const getDepartements = useCallback((pcode_region) => {
    if (!geoData.departements?.features || !pcode_region) return [];
    return geoData.departements.features
      .filter(f => f.properties._pcode_region === pcode_region)
      .map(f => ({ pcode: f.properties._pcode, nom: f.properties._nom || '', feature: f }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [geoData.departements]);

  const getArrondissements = useCallback((pcode_dep) => {
    if (!geoData.arrondissements?.features || !pcode_dep) return [];
    return geoData.arrondissements.features
      .filter(f => f.properties._pcode_dep === pcode_dep)
      .map(f => ({ pcode: f.properties._pcode, nom: f.properties._nom || '', feature: f }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [geoData.arrondissements]);

  const getCommunes = useCallback((pcode_arr) => {
    if (!geoData.communes?.features || !pcode_arr) return [];
    return geoData.communes.features
      .filter(f => f.properties._pcode_arr === pcode_arr)
      .map(f => ({ pcode: f.properties._pcode, nom: f.properties._nom || '', feature: f }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [geoData.communes]);

  const getFeatureByPcode = useCallback((niveau, pcode) => {
    const layer = geoData[niveau];
    if (!layer) return null;
    return layer.features.find(f => f.properties._pcode === pcode) || null;
  }, [geoData]);

  return {
    geoData, chargement, erreur, apiUrl,
    getRegions, getDepartements, getArrondissements, getCommunes, getFeatureByPcode,
  };
}
