/**
 * Hook central : charge TOUS les GeoJSON admin UNE SEULE FOIS
 * et expose des helpers de filtrage PCODE 100% frontend.
 */
import { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || 'https://carto-facilesn.onrender.com';

export function useGeoData() {
  const [geoData, setGeoData] = useState({
    regions: null,
    departements: null,
    arrondissements: null,
    communes: null,
  });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    const charger = async () => {
      try {
        setChargement(true);
        const [regions, departements, arrondissements, communes] = await Promise.all([
          fetch(`${API}/api/couches/admin/regions`).then(r => r.json()),
          fetch(`${API}/api/couches/admin/departements`).then(r => r.json()),
          fetch(`${API}/api/couches/admin/arrondissements`).then(r => r.json()),
          fetch(`${API}/api/couches/admin/communes`).then(r => r.json()),
        ]);
        setGeoData({ regions, departements, arrondissements, communes });
        setErreur('');
      } catch (e) {
        setErreur('Serveur en démarrage... Rechargez dans 30s');
      } finally {
        setChargement(false);
      }
    };
    charger();
  }, []);

  // ── Helpers filtrage PCODE (100% mémoire, jamais d'appel réseau) ─────────

  const getRegions = useCallback(() => {
    if (!geoData.regions) return [];
    return geoData.regions.features.map(f => ({
      pcode: f.properties.ADM1_PCODE || f.properties.CODE || String(f.properties._id),
      nom: f.properties._nom || f.properties.NOM || f.properties.NAME_1 || '',
      feature: f,
    }));
  }, [geoData.regions]);

  const getDepartements = useCallback((pcode_region) => {
    if (!geoData.departements || !pcode_region) return [];
    return geoData.departements.features
      .filter(f =>
        (f.properties.ADM1_PCODE || f.properties.CODE_REG || '') === pcode_region
      )
      .map(f => ({
        pcode: f.properties.ADM2_PCODE || f.properties.CODE || String(f.properties._id),
        nom: f.properties._nom || f.properties.NOM || f.properties.NAME_2 || '',
        feature: f,
      }));
  }, [geoData.departements]);

  const getArrondissements = useCallback((pcode_dep) => {
    if (!geoData.arrondissements || !pcode_dep) return [];
    return geoData.arrondissements.features
      .filter(f =>
        (f.properties.ADM2_PCODE || f.properties.CODE_DEP || '') === pcode_dep
      )
      .map(f => ({
        pcode: f.properties.ADM3_PCODE || f.properties.CODE || String(f.properties._id),
        nom: f.properties._nom || f.properties.NOM || f.properties.NAME_3 || '',
        feature: f,
      }));
  }, [geoData.arrondissements]);

  const getCommunes = useCallback((pcode_arr) => {
    if (!geoData.communes || !pcode_arr) return [];
    return geoData.communes.features
      .filter(f =>
        (f.properties.ADM3_PCODE || f.properties.GID_3 || '') === pcode_arr
      )
      .map(f => ({
        pcode: f.properties.GID_4 || f.properties.ADM4_PCODE || String(f.properties._id),
        nom: f.properties._nom || f.properties.NAME_4 || f.properties.NOM || '',
        feature: f,
      }));
  }, [geoData.communes]);

  const getFeatureByPcode = useCallback((niveau, pcode) => {
    const layer = geoData[niveau];
    if (!layer) return null;
    return layer.features.find(f =>
      Object.values(f.properties).includes(pcode)
    ) || null;
  }, [geoData]);

  return {
    geoData,
    chargement,
    erreur,
    getRegions,
    getDepartements,
    getArrondissements,
    getCommunes,
    getFeatureByPcode,
  };
}
