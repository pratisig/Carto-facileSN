/**
 * Hook central — charge les 4 GeoJSON admin avec retry automatique.
 * Affiche l'URL testee pour faciliter le debug.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const API = process.env.REACT_APP_API_URL || 'https://carto-facilesn-api.onrender.com';

const MAX_RETRIES = 5;
const RETRY_DELAY = 8000; // 8 secondes entre chaque essai

async function fetchAvecTimeout(url, timeoutMs = 20000) {
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
  const [chargement, setChargement]   = useState(true);
  const [erreur,     setErreur]       = useState('');
  const [tentative,  setTentative]    = useState(0);
  const [apiUrl,     setApiUrl]       = useState(API);
  const retryTimer = useRef(null);

  useEffect(() => {
    let annule = false;
    setApiUrl(API); // expose l'URL pour debug

    const charger = async (essai = 0) => {
      if (annule) return;
      try {
        setChargement(true);
        if (essai > 0) {
          setErreur(`⏳ API en demarrage... tentative ${essai}/${MAX_RETRIES} — ${API}`);
        }
        setTentative(essai);

        const [regions, departements, arrondissements, communes] = await Promise.all([
          fetchAvecTimeout(`${API}/api/couches/admin/regions`),
          fetchAvecTimeout(`${API}/api/couches/admin/departements`),
          fetchAvecTimeout(`${API}/api/couches/admin/arrondissements`),
          fetchAvecTimeout(`${API}/api/couches/admin/communes`),
        ]);

        if (annule) return;
        setGeoData({ regions, departements, arrondissements, communes });
        setErreur('');
        setChargement(false);
      } catch (e) {
        if (annule) return;
        if (essai < MAX_RETRIES) {
          setErreur(`⚠️ API inaccessible (${API}) — nouvelle tentative dans ${RETRY_DELAY/1000}s... (${essai+1}/${MAX_RETRIES})`);
          setChargement(false);
          retryTimer.current = setTimeout(() => charger(essai + 1), RETRY_DELAY);
        } else {
          setErreur(`❌ API introuvable apres ${MAX_RETRIES} tentatives. URL testee : ${API} — Verifie le nom du service Render.`);
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

  // ── Helpers filtrage PCODE ────────────────────────────────────────────────

  const getRegions = useCallback(() => {
    if (!geoData.regions?.features) return [];
    return geoData.regions.features
      .filter(f => f.properties._nom)
      .map(f => ({
        pcode: f.properties._pcode || String(f.properties._id),
        nom:   f.properties._nom,
        feature: f,
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [geoData.regions]);

  const getDepartements = useCallback((pcode_region) => {
    if (!geoData.departements?.features || !pcode_region) return [];
    return geoData.departements.features
      .filter(f => f.properties._pcode_region === pcode_region)
      .map(f => ({
        pcode: f.properties._pcode || String(f.properties._id),
        nom:   f.properties._nom || '',
        feature: f,
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [geoData.departements]);

  const getArrondissements = useCallback((pcode_dep) => {
    if (!geoData.arrondissements?.features || !pcode_dep) return [];
    return geoData.arrondissements.features
      .filter(f => f.properties._pcode_dep === pcode_dep)
      .map(f => ({
        pcode: f.properties._pcode || String(f.properties._id),
        nom:   f.properties._nom || '',
        feature: f,
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [geoData.arrondissements]);

  const getCommunes = useCallback((pcode_arr) => {
    if (!geoData.communes?.features || !pcode_arr) return [];
    return geoData.communes.features
      .filter(f => f.properties._pcode_arr === pcode_arr)
      .map(f => ({
        pcode: f.properties._pcode || String(f.properties._id),
        nom:   f.properties._nom || '',
        feature: f,
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [geoData.communes]);

  const getFeatureByPcode = useCallback((niveau, pcode) => {
    const layer = geoData[niveau];
    if (!layer) return null;
    return layer.features.find(f => f.properties._pcode === pcode) || null;
  }, [geoData]);

  return {
    geoData, chargement, erreur, apiUrl, tentative,
    getRegions, getDepartements, getArrondissements, getCommunes, getFeatureByPcode,
  };
}
