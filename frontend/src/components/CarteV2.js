import React, { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';

const STYLE_BASE = {
  regions:         { color: '#2471a3', weight: 1.5, fillColor: '#aed6f1', fillOpacity: 0.12 },
  departements:    { color: '#1a5276', weight: 1.5, fillColor: '#85c1e9', fillOpacity: 0.12 },
  arrondissements: { color: '#117a65', weight: 1.5, fillColor: '#a9dfbf', fillOpacity: 0.12 },
  communes:        { color: '#7f8c8d', weight: 1,   fillColor: '#ecf0f1', fillOpacity: 0.10 },
};

const STYLE_HIGHLIGHT = {
  regions:         { color: '#1a5276', weight: 3, fillColor: '#2471a3', fillOpacity: 0.45 },
  departements:    { color: '#154360', weight: 3, fillColor: '#1a5276', fillOpacity: 0.50 },
  arrondissements: { color: '#0e6655', weight: 3, fillColor: '#117a65', fillOpacity: 0.55 },
  communes:        { color: '#c0392b', weight: 3, fillColor: '#e74c3c', fillOpacity: 0.55 },
};

const STYLE_ESTOMPE = { fillOpacity: 0.03, opacity: 0.3 };

const COULEURS_THEMATIQUES = {
  routes: '#888888', chemin_fer: '#444444', cours_eau: '#3498db',
  plans_eau: '#85c1e9', points_eau: '#2980b9', aires_protegees: '#1e8449',
  courbes_niveau: '#b7950b', sable: '#f0e68c', agglomerations: '#e67e22',
  aeroports: '#2c3e50', localites: '#c0392b', frontieres: '#2c3e50',
  surfaces_boisees: '#27ae60',
};

function AutoZoom({ feature }) {
  const map = useMap();
  useEffect(() => {
    if (!feature?.geometry) return;
    try {
      // eslint-disable-next-line no-undef
      const layer = L.geoJSON(feature);
      map.flyToBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 13, duration: 0.8 });
    } catch (e) {}
  }, [feature, map]);
  return null;
}

function styleFeature(feature, niveau, featSelectionnee) {
  const base = { ...STYLE_BASE[niveau] };
  if (!featSelectionnee) return base;
  const isSel = featSelectionnee === feature ||
    (featSelectionnee.properties?._id && feature.properties?._id === featSelectionnee.properties._id);
  if (isSel) return { ...STYLE_HIGHLIGHT[niveau] };
  return { ...base, ...STYLE_ESTOMPE };
}

export default function CarteV2({
  geoData, featRegion, featDep, featArr, featCommune,
  geojsonThematiques, couchesActives, catalogueCouches, chargement
}) {
  const zoomTarget = featCommune || featArr || featDep || featRegion;

  return (
    <div className="carte-wrapper" style={{ position: 'relative', flex: 1 }}>
      {chargement && (
        <div style={{
          position:'absolute', top:10, left:'50%', transform:'translateX(-50%)',
          background:'rgba(255,255,255,0.95)', padding:'8px 20px',
          borderRadius:20, zIndex:1200, fontSize:'0.85rem', color:'#1a5276',
          boxShadow:'0 2px 8px rgba(0,0,0,0.15)'
        }}>⏳ Chargement des couches...</div>
      )}

      <MapContainer
        center={[14.4, -14.4]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
        />

        {zoomTarget && <AutoZoom feature={zoomTarget} />}

        {geoData.regions && (
          <GeoJSON
            key={`regions-${featRegion?.properties?._id}`}
            data={geoData.regions}
            style={(f) => styleFeature(f, 'regions', featRegion)}
            onEachFeature={(f, layer) => {
              const nom = f.properties._nom || f.properties.NOM || '';
              if (nom) layer.bindTooltip(nom, { sticky: true });
            }}
          />
        )}

        {geoData.departements && featRegion && (
          <GeoJSON
            key={`depts-${featDep?.properties?._id}`}
            data={geoData.departements}
            style={(f) => styleFeature(f, 'departements', featDep)}
            onEachFeature={(f, layer) => {
              const nom = f.properties._nom || f.properties.NOM || '';
              if (nom) layer.bindTooltip(nom, { sticky: true });
            }}
          />
        )}

        {geoData.arrondissements && featDep && (
          <GeoJSON
            key={`arrs-${featArr?.properties?._id}`}
            data={geoData.arrondissements}
            style={(f) => styleFeature(f, 'arrondissements', featArr)}
            onEachFeature={(f, layer) => {
              const nom = f.properties._nom || f.properties.NOM || '';
              if (nom) layer.bindTooltip(nom, { sticky: true });
            }}
          />
        )}

        {geoData.communes && featArr && (
          <GeoJSON
            key={`communes-${featCommune?.properties?._id}`}
            data={geoData.communes}
            style={(f) => styleFeature(f, 'communes', featCommune)}
            onEachFeature={(f, layer) => {
              const nom = f.properties._nom || f.properties.NAME_4 || '';
              if (nom) layer.bindTooltip(nom, { sticky: true });
            }}
          />
        )}

        {couchesActives.map(id_couche => {
          const data = geojsonThematiques[id_couche];
          if (!data?.features?.length) return null;
          const couleur = COULEURS_THEMATIQUES[id_couche] || '#666';
          return (
            <GeoJSON
              key={`th-${id_couche}-${data.features.length}`}
              data={data}
              style={() => ({
                color: couleur, weight: 1.5,
                fillColor: couleur, fillOpacity: 0.3, opacity: 0.85,
              })}
              onEachFeature={(f, layer) => {
                const props = f.properties || {};
                const lignes = Object.entries(props)
                  .filter(([k, v]) => v && !k.startsWith('_'))
                  .slice(0, 5)
                  .map(([k, v]) => `<b>${k}</b>: ${v}`)
                  .join('<br/>');
                if (lignes) layer.bindPopup(lignes);
              }}
            />
          );
        })}
      </MapContainer>

      {!zoomTarget && !chargement && (
        <div style={{
          position:'absolute', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'rgba(255,255,255,0.92)', padding:'10px 20px',
          borderRadius:20, fontSize:'0.85rem', color:'#1a5276',
          boxShadow:'0 2px 10px rgba(0,0,0,0.15)', zIndex:1000,
          pointerEvents:'none', whiteSpace:'nowrap'
        }}>
          🗺️ Sélectionnez une région pour commencer
        </div>
      )}
    </div>
  );
}
