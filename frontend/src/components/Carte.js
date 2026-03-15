import React, { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';

const COULEURS = {
  routes: '#888888', chemin_fer: '#444444', cours_eau: '#3498db',
  plans_eau: '#85c1e9', points_eau: '#2980b9', aires_protegees: '#1e8449',
  courbes_niveau: '#b7950b', sable: '#f0e68c', agglomerations: '#e67e22',
  aeroports: '#2c3e50', localites: '#c0392b', frontieres: '#2c3e50',
};

// Calcule le bounding box d'une géométrie GeoJSON
function getBounds(geom) {
  try {
    const g = typeof geom === 'string' ? JSON.parse(geom) : geom;
    let coords = [];
    if (g.type === 'Polygon')      coords = g.coordinates[0];
    else if (g.type === 'MultiPolygon') coords = g.coordinates.flat(2);
    else if (g.type === 'Point')   coords = [g.coordinates];
    if (!coords.length) return null;
    const lats = coords.map(c => c[1]);
    const lngs = coords.map(c => c[0]);
    return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
  } catch { return null; }
}

function FlyTo({ geom }) {
  const map = useMap();
  useEffect(() => {
    const bounds = getBounds(geom);
    if (bounds) map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [geom, map]);
  return null;
}

function parseGeom(geom) {
  if (!geom) return null;
  try { return typeof geom === 'string' ? JSON.parse(geom) : geom; }
  catch { return null; }
}

export default function Carte({ geomRegion, geomDep, geomArr, communeSelectionnee, geojsonCouches, loading }) {

  // Détermine la géométrie la plus précise à afficher / zoomer
  const geomActive = communeSelectionnee?.geom || geomArr?.geom || geomDep?.geom || geomRegion?.geom;

  const styleCouche = (tc) => ({
    color: COULEURS[tc] || '#666',
    weight: ['routes', 'chemin_fer', 'cours_eau', 'frontieres'].includes(tc) ? 1.5 : 1,
    fillOpacity: 0.25, opacity: 0.85,
  });

  const styles = {
    region:  { color: '#2471a3', weight: 2, fillColor: '#aed6f1', fillOpacity: 0.15 },
    dep:     { color: '#1a5276', weight: 2, fillColor: '#85c1e9', fillOpacity: 0.18 },
    arr:     { color: '#117a65', weight: 2, fillColor: '#a9dfbf', fillOpacity: 0.20 },
    commune: { color: '#e74c3c', weight: 2.5, fillColor: '#fadbd8', fillOpacity: 0.22 },
  };

  return (
    <div className="carte-wrapper">
      {loading && <div className="carte-loading">⏳ Chargement...</div>}

      <MapContainer center={[14.4, -14.4]} zoom={7} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
        />

        {/* Zoom automatique sur la géométrie active */}
        {geomActive && <FlyTo geom={geomActive} />}

        {/* Région sélectionnée */}
        {geomRegion?.geom && !geomDep && (
          <GeoJSON key={`reg-${geomRegion.id}`}
            data={parseGeom(geomRegion.geom)} style={styles.region} />
        )}

        {/* Département sélectionné */}
        {geomDep?.geom && !geomArr && (
          <GeoJSON key={`dep-${geomDep.id}`}
            data={parseGeom(geomDep.geom)} style={styles.dep} />
        )}

        {/* Arrondissement sélectionné */}
        {geomArr?.geom && !communeSelectionnee && (
          <GeoJSON key={`arr-${geomArr.id}`}
            data={parseGeom(geomArr.geom)} style={styles.arr} />
        )}

        {/* Commune sélectionnée */}
        {communeSelectionnee?.geom && (
          <GeoJSON key={`com-${communeSelectionnee.id}`}
            data={parseGeom(communeSelectionnee.geom)} style={styles.commune} />
        )}

        {/* Couches thématiques */}
        {Object.entries(geojsonCouches).map(([tc, data]) =>
          data?.features?.length > 0 && (
            <GeoJSON
              key={`${tc}-${communeSelectionnee?.id}-${data.features.length}`}
              data={data}
              style={styleCouche(tc)}
              pointToLayer={(_f, latlng) => {
                // eslint-disable-next-line no-undef
                return L.circleMarker(latlng, {
                  radius: 5, color: COULEURS[tc] || '#666',
                  fillColor: COULEURS[tc] || '#666', fillOpacity: 0.8,
                });
              }}
              onEachFeature={(feature, layer) => {
                const props = feature.properties || {};
                const lignes = Object.entries(props)
                  .filter(([k, v]) => v && v !== '' && !k.startsWith('_'))
                  .slice(0, 6).map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br/>');
                if (lignes) layer.bindPopup(lignes);
              }}
            />
          )
        )}
      </MapContainer>

      {!geomActive && (
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
