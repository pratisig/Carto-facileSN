import React, { useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// ── STYLES ADMIN ───────────────────────────────────────────────────────

// Styles par defaut (aucune selection)
const STYLES_BASE = {
  regions:         { color: '#7f8c8d', weight: 2,   fillColor: '#bdc3c7', fillOpacity: 0.35 },
  departements:    { color: '#7f8c8d', weight: 1.5, fillColor: '#bdc3c7', fillOpacity: 0.20 },
  arrondissements: { color: '#95a5a6', weight: 1,   fillColor: '#d5d8dc', fillOpacity: 0.15 },
  communes:        { color: '#e74c3c', weight: 1,   fillColor: '#fadbd8', fillOpacity: 0.15 },
};

// Style zone selectionnee
const STYLES_SEL = {
  regions:         { color: '#1a5276', weight: 3,   fillColor: '#2471a3', fillOpacity: 0.50 },
  departements:    { color: '#154360', weight: 3,   fillColor: '#1a5276', fillOpacity: 0.55 },
  arrondissements: { color: '#0e6655', weight: 3,   fillColor: '#117a65', fillOpacity: 0.55 },
  communes:        { color: '#c0392b', weight: 3,   fillColor: '#e74c3c', fillOpacity: 0.60 },
};

// Style zones estompees (non selectionnees quand une est choisie)
const STYLE_ESTOMPE = { fillOpacity: 0.04, opacity: 0.25 };

// Couleurs couches thematiques
const COULEURS_TH = {
  routes: '#888888', chemin_fer: '#444444', aeroports: '#2c3e50',
  cours_eau: '#2980b9', plans_eau: '#85c1e9', points_eau: '#1a6fa0',
  aires_protegees: '#1e8449', surfaces_boisees: '#27ae60',
  courbes_niveau: '#b7950b', sable: '#d4ac0d',
  agglomerations: '#e67e22', localites: '#c0392b', frontieres: '#2c3e50',
};

// ── ZOOM AUTO ───────────────────────────────────────────────────────────
function AutoZoom({ feature }) {
  const map = useMap();
  const prevRef = useRef(null);
  useEffect(() => {
    if (!feature || feature === prevRef.current) return;
    prevRef.current = feature;
    try {
      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 14, duration: 0.9 });
      }
    } catch (e) {}
  }, [feature, map]);
  return null;
}

// ── COORDONNEES CURSEUR ────────────────────────────────────────────────
function CoordsBar({ setCoords }) {
  useMapEvents({
    mousemove: (e) => setCoords(e.latlng),
  });
  return null;
}

// ── ETIQUETTES TOOLTIP LEAFLET ─────────────────────────────────────────
function attachLabel(layer, nom, cssClass) {
  if (!nom) return;
  layer.bindTooltip(nom, {
    permanent: true,
    direction: 'center',
    className: cssClass,
    sticky: false,
  });
}

// ── STYLE D'UNE FEATURE ────────────────────────────────────────────────
function getStyle(feature, niveau, selPcode) {
  const base = { ...STYLES_BASE[niveau] };
  if (!selPcode) return base;
  const fp = feature.properties._pcode;
  if (fp === selPcode) return { ...STYLES_SEL[niveau] };
  return { ...base, ...STYLE_ESTOMPE };
}

// ── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────
export default function CarteV3({
  geoData,
  featRegion, featDep, featArr, featCommune,
  visRegions, visDeps, visArrs, visCommunes, visEtiquettes,
  geojsonThematiques, couchesActives, catalogue,
  importData, chargement,
  selRegion, selDep, selArr, selCommune,
  onRegionClick, onDepClick, onCommuneClick,
}) {
  const [coords, setCoords] = React.useState(null);

  // Zoom cible = la zone la plus precise selectionnee
  const zoomTarget = featCommune || featArr || featDep || featRegion;

  // Handlers click sur polygone
  const onEachRegion = useCallback((feature, layer) => {
    const nom = feature.properties._nom || '';
    if (visEtiquettes) attachLabel(layer, nom, 'leaflet-label-region');
    layer.on('click', () => {
      if (onRegionClick) onRegionClick(feature.properties._pcode);
    });
    layer.on('mouseover', () => layer.setStyle({ weight: 3, fillOpacity: 0.5 }));
    layer.on('mouseout',  () => layer.setStyle(getStyle(feature, 'regions', selRegion)));
  }, [visEtiquettes, selRegion, onRegionClick]);

  const onEachDep = useCallback((feature, layer) => {
    const nom = feature.properties._nom || '';
    if (visEtiquettes) attachLabel(layer, nom, 'leaflet-label-dept');
    layer.on('click', () => {
      if (onDepClick) onDepClick(feature.properties._pcode);
    });
  }, [visEtiquettes, selDep, onDepClick]);

  const onEachArr = useCallback((feature, layer) => {
    const nom = feature.properties._nom || '';
    if (visEtiquettes) attachLabel(layer, nom, 'leaflet-label-arr');
  }, [visEtiquettes]);

  const onEachCommune = useCallback((feature, layer) => {
    const nom = feature.properties._nom || '';
    if (visEtiquettes) attachLabel(layer, nom, 'leaflet-label-commune');
    layer.on('click', () => {
      if (onCommuneClick) onCommuneClick(feature.properties._pcode);
    });
  }, [visEtiquettes, selCommune, onCommuneClick]);

  return (
    <div className="carte-wrapper">
      {chargement && (
        <div className="carte-spinner">⏳ Chargement des donnees...</div>
      )}

      <MapContainer
        center={[14.4, -14.4]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          opacity={0.5}
        />

        <AutoZoom feature={zoomTarget} />
        <CoordsBar setCoords={setCoords} />

        {/* ── Couches admin ── */}

        {visRegions && geoData.regions && (
          <GeoJSON
            key={`reg-${selRegion}`}
            data={geoData.regions}
            style={f => getStyle(f, 'regions', selRegion)}
            onEachFeature={onEachRegion}
          />
        )}

        {visDeps && geoData.departements && (
          <GeoJSON
            key={`dep-${selDep}`}
            data={geoData.departements}
            style={f => getStyle(f, 'departements', selDep)}
            onEachFeature={onEachDep}
          />
        )}

        {visArrs && geoData.arrondissements && (
          <GeoJSON
            key={`arr-${selArr}`}
            data={geoData.arrondissements}
            style={f => getStyle(f, 'arrondissements', selArr)}
            onEachFeature={onEachArr}
          />
        )}

        {visCommunes && geoData.communes && (
          <GeoJSON
            key={`com-${selCommune}`}
            data={geoData.communes}
            style={f => getStyle(f, 'communes', selCommune)}
            onEachFeature={onEachCommune}
          />
        )}

        {/* ── Couches thematiques ── */}
        {couchesActives.map(id => {
          const data = geojsonThematiques[id];
          if (!data?.features?.length) return null;
          const couleur = COULEURS_TH[id] || '#666';
          const isLine = ['routes','chemin_fer','cours_eau','courbes_niveau','frontieres'].includes(id);
          const isPoint = ['aeroports','localites','points_eau'].includes(id);
          return (
            <GeoJSON
              key={`th-${id}`}
              data={data}
              style={() => ({
                color: couleur,
                weight: isLine ? 1.5 : 1,
                fillColor: couleur,
                fillOpacity: isPoint ? 0.8 : 0.35,
                opacity: 0.85,
              })}
              onEachFeature={(f, layer) => {
                const props = f.properties || {};
                const lignes = Object.entries(props)
                  .filter(([k, v]) => v && !k.startsWith('_'))
                  .slice(0, 6)
                  .map(([k, v]) => `<b>${k}</b>: ${v}`)
                  .join('<br/>');
                if (lignes) layer.bindPopup(`<div style="font-size:0.8rem">${lignes}</div>`);
              }}
            />
          );
        })}

        {/* ── Donnees importees ── */}
        {importData && (
          <GeoJSON
            key={`import-${importData.features?.length}`}
            data={importData}
            style={() => ({ color: '#8e44ad', weight: 2, fillColor: '#9b59b6', fillOpacity: 0.5 })}
            onEachFeature={(f, layer) => {
              const props = f.properties || {};
              const lignes = Object.entries(props)
                .filter(([k,v]) => v)
                .slice(0, 8)
                .map(([k,v]) => `<b>${k}</b>: ${v}`)
                .join('<br/>');
              layer.bindPopup(`<div style="font-size:0.8rem">${lignes}</div>`);
            }}
          />
        )}

      </MapContainer>

      {/* Barre coordonnees */}
      {coords && (
        <div className="coords-bar">
          <span>📍 Lat: {coords.lat.toFixed(5)}&nbsp;&nbsp;Lng: {coords.lng.toFixed(5)}</span>
          <span>WGS 84 / EPSG:4326</span>
        </div>
      )}

      {!zoomTarget && !chargement && (
        <div className="carte-hint">
          🗺️ Cliquez sur une région ou utilisez le panneau gauche pour naviguer
        </div>
      )}
    </div>
  );
}
