import React, { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';

const COULEURS = {
  routes: '#888888', chemin_fer: '#444444', cours_eau: '#3498db',
  plans_eau: '#85c1e9', points_eau: '#2980b9', aires_protegees: '#1e8449',
  courbes_niveau: '#b7950b', sable: '#f0e68c', agglomerations: '#e67e22',
  aeroports: '#2c3e50', localites: '#c0392b', frontieres: '#2c3e50',
};

function FlyToCommune({ commune }) {
  const map = useMap();
  useEffect(() => {
    if (!commune?.geom) return;
    try {
      const geom = typeof commune.geom === 'string' ? JSON.parse(commune.geom) : commune.geom;
      const coords = geom.type === 'Polygon' ? geom.coordinates[0]
        : geom.type === 'MultiPolygon' ? geom.coordinates.flat(2) : [];
      if (!coords.length) return;
      const lats = coords.map(c => c[1]);
      const lngs = coords.map(c => c[0]);
      map.flyToBounds(
        [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
        { padding: [30, 30] }
      );
    } catch(e) {}
  }, [commune, map]);
  return null;
}

export default function Carte({ communeSelectionnee, geojsonCouches, loading }) {

  const styleCouche = (tc) => ({
    color: COULEURS[tc] || '#666',
    weight: ['routes', 'chemin_fer', 'cours_eau', 'frontieres'].includes(tc) ? 1.5 : 1,
    fillOpacity: 0.25,
    opacity: 0.85,
  });

  const styleCommune = {
    color: '#e74c3c', weight: 2.5, fillColor: '#fadbd8', fillOpacity: 0.18,
  };

  return (
    <div className="carte-wrapper">
      {loading && <div className="carte-loading">⏳ Chargement des données...</div>}
      {!communeSelectionnee && (
        <div className="carte-placeholder">
          <span style={{fontSize:'2.5rem'}}>&#x1F5FA;&#xFE0F;</span>
          <span>Sélectionnez une région, un département et une commune</span>
        </div>
      )}
      <MapContainer
        center={[14.5, -14.5]}
        zoom={6}
        style={{ height: '100%', width: '100%', display: communeSelectionnee ? 'block' : 'none' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
        />
        {communeSelectionnee?.geom && (
          <>
            <FlyToCommune commune={communeSelectionnee} />
            <GeoJSON
              key={`commune-${communeSelectionnee.id}`}
              data={typeof communeSelectionnee.geom === 'string'
                ? JSON.parse(communeSelectionnee.geom)
                : communeSelectionnee.geom}
              style={styleCommune}
            />
          </>
        )}
        {Object.entries(geojsonCouches).map(([tc, data]) =>
          data?.features?.length > 0 && (
            <GeoJSON
              key={`${tc}-${communeSelectionnee?.id}`}
              data={data}
              style={styleCouche(tc)}
              pointToLayer={(feature, latlng) => {
                // eslint-disable-next-line no-undef
                return L.circleMarker(latlng, {
                  radius: 5,
                  color: COULEURS[tc] || '#666',
                  fillColor: COULEURS[tc] || '#666',
                  fillOpacity: 0.8,
                });
              }}
              onEachFeature={(feature, layer) => {
                const props = feature.properties || {};
                const lignes = Object.entries(props)
                  .filter(([k, v]) => v && !k.startsWith('_'))
                  .slice(0, 5)
                  .map(([k, v]) => `<b>${k}</b>: ${v}`)
                  .join('<br/>');
                if (lignes) layer.bindPopup(lignes);
              }}
            />
          )
        )}
      </MapContainer>
    </div>
  );
}
