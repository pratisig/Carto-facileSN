import React, { useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents, Tooltip } from 'react-leaflet';
import L from 'leaflet';

// ── Styles admin ──────────────────────────────────────────────────────────────
const STYLES_BASE = {
  regions:         { color: '#7f8c8d', weight: 2,   fillColor: '#bdc3c7', fillOpacity: 0.35 },
  departements:    { color: '#7f8c8d', weight: 1.5, fillColor: '#bdc3c7', fillOpacity: 0.20 },
  arrondissements: { color: '#95a5a6', weight: 1,   fillColor: '#d5d8dc', fillOpacity: 0.15 },
  communes:        { color: '#e74c3c', weight: 1,   fillColor: '#fadbd8', fillOpacity: 0.15 },
};
const STYLES_SEL = {
  regions:         { color: '#1a5276', weight: 3.5, fillColor: '#2471a3', fillOpacity: 0.55 },
  departements:    { color: '#154360', weight: 3.5, fillColor: '#1a5276', fillOpacity: 0.55 },
  arrondissements: { color: '#0e6655', weight: 3.5, fillColor: '#117a65', fillOpacity: 0.55 },
  communes:        { color: '#c0392b', weight: 3.5, fillColor: '#e74c3c', fillOpacity: 0.65 },
};
const STYLE_ESTOMPE = { fillOpacity: 0.03, opacity: 0.20 };

const COULEURS_TH = {
  routes: '#888', chemin_fer: '#444', aeroports: '#2c3e50',
  cours_eau: '#2980b9', plans_eau: '#85c1e9', points_eau: '#1a6fa0',
  aires_protegees: '#1e8449', surfaces_boisees: '#27ae60',
  courbes_niveau: '#b7950b', sable: '#d4ac0d',
  agglomerations: '#e67e22', localites: '#c0392b', frontieres: '#2c3e50',
};
const LIGNES_TH  = new Set(['routes','chemin_fer','cours_eau','courbes_niveau','frontieres']);
const POINTS_TH  = new Set(['aeroports','localites','points_eau']);

function getStyle(feature, niveau, selPcode) {
  const base = { ...STYLES_BASE[niveau] };
  if (!selPcode) return base;
  return feature.properties._pcode === selPcode
    ? { ...STYLES_SEL[niveau] }
    : { ...base, ...STYLE_ESTOMPE };
}

// ── Zoom auto ─────────────────────────────────────────────────────────────────
function AutoZoom({ feature }) {
  const map = useMap();
  const prevRef = useRef(null);
  useEffect(() => {
    if (!feature || feature === prevRef.current) return;
    prevRef.current = feature;
    try {
      const bounds = L.geoJSON(feature).getBounds();
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [40,40], maxZoom: 14, duration: 0.8 });
    } catch(e) {}
  }, [feature, map]);
  return null;
}

// ── Coordonnees curseur ────────────────────────────────────────────────────────
function CoordsBar({ setCoords }) {
  useMapEvents({ mousemove: e => setCoords(e.latlng) });
  return null;
}

// ── Etiquettes permanentes via Tooltip ────────────────────────────────────────
function EtiquetteLayer({ data, cssClass, visEtiquettes, niveau, selPcode }) {
  if (!visEtiquettes || !data?.features) return null;
  return (
    <GeoJSON
      key={`etiq-${niveau}-${selPcode}`}
      data={data}
      style={() => ({ color: 'transparent', weight: 0, fillOpacity: 0 })}
      onEachFeature={(feature, layer) => {
        const nom = feature.properties._nom || '';
        if (!nom) return;
        layer.bindTooltip(nom, {
          permanent: true,
          direction: 'center',
          className: cssClass,
          sticky: false,
        });
      }}
    />
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function CarteV3({
  geoData,
  featRegion, featDep, featArr, featCommune,
  visRegions, visDeps, visArrs, visCommunes, visEtiquettes,
  geojsonThematiques, couchesActives, catalogue,
  importData, chargement,
  selRegion, selDep, selArr, selCommune,
  onRegionClick, onDepClick, onCommuneClick,
  mapRef,
}) {
  const [coords, setCoords] = React.useState(null);
  const zoomTarget = featCommune || featArr || featDep || featRegion;

  // Handlers polygones
  const onEachRegion = useCallback((feature, layer) => {
    layer.on('click', () => onRegionClick?.(feature.properties._pcode));
    layer.on('mouseover', () => {
      if (feature.properties._pcode !== selRegion)
        layer.setStyle({ weight: 2.5, fillOpacity: 0.5 });
    });
    layer.on('mouseout', () => layer.setStyle(getStyle(feature, 'regions', selRegion)));
  }, [selRegion, onRegionClick]);

  const onEachDep = useCallback((feature, layer) => {
    layer.on('click', () => onDepClick?.(feature.properties._pcode));
  }, [onDepClick]);

  const onEachCommune = useCallback((feature, layer) => {
    layer.on('click', () => onCommuneClick?.(feature.properties._pcode));
    layer.on('mouseover', () => layer.setStyle({ weight: 2.5, fillOpacity: 0.55 }));
    layer.on('mouseout',  () => layer.setStyle(getStyle(feature, 'communes', selCommune)));
  }, [selCommune, onCommuneClick]);

  return (
    <div className="carte-wrapper" ref={mapRef}>
      {chargement && <div className="carte-spinner">\u23f3 Chargement des donnees...</div>}

      <MapContainer center={[14.4,-14.4]} zoom={7}
        style={{ height:'100%', width:'100%' }} zoomControl={true}>

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          opacity={0.45}
        />

        <AutoZoom feature={zoomTarget} />
        <CoordsBar setCoords={setCoords} />

        {/* ── Couches admin POLYGONES ── */}
        {visRegions && geoData.regions && (
          <GeoJSON key={`reg-${selRegion}`} data={geoData.regions}
            style={f => getStyle(f, 'regions', selRegion)}
            onEachFeature={onEachRegion} />
        )}
        {visDeps && geoData.departements && (
          <GeoJSON key={`dep-${selDep}`} data={geoData.departements}
            style={f => getStyle(f, 'departements', selDep)}
            onEachFeature={onEachDep} />
        )}
        {visArrs && geoData.arrondissements && (
          <GeoJSON key={`arr-${selArr}`} data={geoData.arrondissements}
            style={f => getStyle(f, 'arrondissements', selArr)} />
        )}
        {visCommunes && geoData.communes && (
          <GeoJSON key={`com-${selCommune}`} data={geoData.communes}
            style={f => getStyle(f, 'communes', selCommune)}
            onEachFeature={onEachCommune} />
        )}

        {/* ── Etiquettes SEPAREES (couche transparente par-dessus) ── */}
        {visEtiquettes && visRegions && (
          <EtiquetteLayer data={geoData.regions} cssClass="leaflet-label-region"
            visEtiquettes={visEtiquettes} niveau="regions" selPcode={selRegion} />
        )}
        {visEtiquettes && visDeps && (
          <EtiquetteLayer data={geoData.departements} cssClass="leaflet-label-dept"
            visEtiquettes={visEtiquettes} niveau="departements" selPcode={selDep} />
        )}
        {visEtiquettes && visArrs && (
          <EtiquetteLayer data={geoData.arrondissements} cssClass="leaflet-label-arr"
            visEtiquettes={visEtiquettes} niveau="arrondissements" selPcode={selArr} />
        )}
        {visEtiquettes && visCommunes && (
          <EtiquetteLayer data={geoData.communes} cssClass="leaflet-label-commune"
            visEtiquettes={visEtiquettes} niveau="communes" selPcode={selCommune} />
        )}

        {/* ── Couches thematiques ── */}
        {couchesActives.map(id => {
          const data = geojsonThematiques[id];
          if (!data?.features?.length) return null;
          const couleur = COULEURS_TH[id] || '#666';
          const isLine  = LIGNES_TH.has(id);
          const isPoint = POINTS_TH.has(id);
          return (
            <GeoJSON key={`th-${id}-${data.features.length}`} data={data}
              style={() => ({
                color: couleur, weight: isLine ? 1.5 : 1,
                fillColor: couleur,
                fillOpacity: isPoint ? 0.9 : 0.4,
                opacity: 0.9,
              })}
              onEachFeature={(f, layer) => {
                const props = f.properties || {};
                const lignes = Object.entries(props)
                  .filter(([k,v]) => v && !k.startsWith('_'))
                  .slice(0,6).map(([k,v]) => `<b>${k}</b>: ${v}`).join('<br/>');
                if (lignes) layer.bindPopup(`<div style="font-size:0.8rem">${lignes}</div>`);
              }}
            />
          );
        })}

        {/* ── Import ── */}
        {importData && (
          <GeoJSON key={`imp-${importData.features?.length}`} data={importData}
            style={() => ({ color:'#8e44ad', weight:2, fillColor:'#9b59b6', fillOpacity:0.5 })}
            onEachFeature={(f,layer) => {
              const lignes = Object.entries(f.properties||{})
                .filter(([k,v])=>v).slice(0,8)
                .map(([k,v])=>`<b>${k}</b>: ${v}`).join('<br/>');
              layer.bindPopup(`<div style="font-size:0.8rem">${lignes}</div>`);
            }}
          />
        )}
      </MapContainer>

      {coords && (
        <div className="coords-bar">
          <span>\ud83d\udccd Lat: {coords.lat.toFixed(5)}&nbsp;&nbsp;Lng: {coords.lng.toFixed(5)}</span>
          <span>WGS 84</span>
        </div>
      )}
      {!zoomTarget && !chargement && (
        <div className="carte-hint">\ud83d\uddfa\ufe0f Cliquez sur une région ou naviguez via le panneau gauche</div>
      )}
    </div>
  );
}
