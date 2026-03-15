/**
 * Hook central : charge les 4 GeoJSON admin UNE SEULE FOIS
 * et filtre 100% en memoire par la propriete _pcode normalisee.
 *
 * Proprietes normalisees par le backend (geo_cache.py) :
 *   _pcode        : PCODE propre du polygone
 *   _pcode_region : PCODE de la region parente  (Admin2, 3, 4)
 *   _pcode_dep    : PCODE du dep parent          (Admin3, 4)
 *   _pcode_arr    : PCODE de l'arr parent         (Admin4)
 *   _nom          : nom normalise
 */
import { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || 'https://carto-facilesn-api.onrender.com';

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
        setErreur('Serveur en demarrage... Rechargez dans 30s');
      } finally {
        setChargement(false);
      }
    };
    charger();
  }, []);

  // ── Helpers filtrage par _pcode (100% memoire) ────────────────────────────

  const getRegions = useCallback(() => {
    if (!geoData.regions) return [];
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
    if (!geoData.departements || !pcode_region) return [];
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
    if (!geoData.arrondissements || !pcode_dep) return [];
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
    if (!geoData.communes || !pcode_arr) return [];
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
