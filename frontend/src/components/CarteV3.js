/**
 * CarteV3 — carte principale avec:
 * - Etiquettes zoom-dependantes (regions>6, deps>8, arrs/communes>10)
 * - Etiquettes activables individuellement
 * - Couches thematiques correctement rendues
 * - Outils: dessin, mesure, fond de carte
 * - Export centre sur la zone selectionnee
 */
import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  MapContainer, TileLayer, GeoJSON, useMap, useMapEvents,
  LayersControl, FeatureGroup, Tooltip
} from 'react-leaflet';
import L from 'leaflet';

// ── Styles ────────────────────────────────────────────────────────────────
const STYLES_BASE = {
  regions:         { color:'#7f8c8d', weight:2,   fillColor:'#bdc3c7', fillOpacity:0.35 },
  departements:    { color:'#7f8c8d', weight:1.5, fillColor:'#bdc3c7', fillOpacity:0.20 },
  arrondissements: { color:'#95a5a6', weight:1,   fillColor:'#d5d8dc', fillOpacity:0.15 },
  communes:        { color:'#e74c3c', weight:1,   fillColor:'#fadbd8', fillOpacity:0.15 },
};
const STYLES_SEL = {
  regions:         { color:'#1a5276', weight:3.5, fillColor:'#2471a3', fillOpacity:0.55 },
  departements:    { color:'#154360', weight:3.5, fillColor:'#1a5276', fillOpacity:0.55 },
  arrondissements: { color:'#0e6655', weight:3.5, fillColor:'#117a65', fillOpacity:0.55 },
  communes:        { color:'#c0392b', weight:3.5, fillColor:'#e74c3c', fillOpacity:0.65 },
};

const COULEURS_TH = {
  routes:'#888', chemin_fer:'#444', aeroports:'#2c3e50',
  cours_eau:'#2980b9', plans_eau:'#85c1e9', points_eau:'#1a6fa0',
  aires_protegees:'#1e8449', surfaces_boisees:'#27ae60',
  courbes_niveau:'#b7950b', sable:'#d4ac0d',
  agglomerations:'#e67e22', localites:'#c0392b', frontieres:'#2c3e50',
};
const LIGNES_TH = new Set(['routes','chemin_fer','cours_eau','courbes_niveau','frontieres']);

// Fonds de carte disponibles
const FONDS = [
  { id:'osm',   label:'OpenStreetMap', url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr:'&copy; OpenStreetMap' },
  { id:'topo',  label:'OpenTopoMap',   url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',  attr:'&copy; OpenTopoMap' },
  { id:'sat',   label:'Satellite (Esri)', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'&copy; Esri' },
  { id:'carto', label:'CartoDB Clair', url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr:'&copy; CartoDB' },
  { id:'dark',  label:'CartoDB Sombre',url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',  attr:'&copy; CartoDB' },
  { id:'none',  label:'Aucun fond',    url:'', attr:'' },
];

// ── Zoom auto sur la zone selectionnee ───────────────────────────────────────
function AutoZoom({ feature }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (!feature || feature === prev.current) return;
    prev.current = feature;
    try {
      const b = L.geoJSON(feature).getBounds();
      if (b.isValid()) map.flyToBounds(b, { padding:[40,40], maxZoom:14, duration:0.8 });
    } catch(e){}
  }, [feature, map]);
  return null;
}

// ── Coordonnees curseur ──────────────────────────────────────────────────────
function CoordsBar({ onCoords, onZoom }) {
  const map = useMap();
  useMapEvents({
    mousemove: e => onCoords(e.latlng),
    zoomend:   () => onZoom(map.getZoom()),
  });
  return null;
}

// ── Etiquettes zoom-dependantes ──────────────────────────────────────────────
// zoom: pays=6-7, region=8-9, dep=10-11, commune=12+
const ZOOM_MIN = { regions:5, departements:8, arrondissements:10, communes:11, localites:11 };

function EtiquetteLayer({ data, cssClass, niveau, visible, zoom }) {
  if (!visible || !data?.features) return null;
  if (zoom < ZOOM_MIN[niveau]) return null;
  return (
    <GeoJSON
      key={`etiq-${niveau}-${zoom}-${data.features.length}`}
      data={data}
      style={() => ({ color:'transparent', weight:0, fillOpacity:0 })}
      onEachFeature={(feature, layer) => {
        const nom = feature.properties._nom || '';
        if (!nom || nom.startsWith(niveau.slice(0,-1)+' ')) return; // skip "regions 1"
        layer.bindTooltip(nom, {
          permanent: true, direction:'center',
          className: cssClass, sticky:false,
        });
      }}
    />
  );
}

// ── Outils: dessin & mesure ─────────────────────────────────────────────────────
function OutilsDessin({ actif, onToggle }) {
  const map = useMap();
  const dessinRef = useRef(null);
  const mesureRef = useRef(null);
  const [mode, setMode] = useState(null); // 'ligne'|'polygone'|'mesure'|null
  const ptsMesure = useRef([]);
  const markersMesure = useRef([]);
  const lignesMesure = useRef([]);

  const nettoyerMesure = useCallback(() => {
    markersMesure.current.forEach(m => map.removeLayer(m));
    lignesMesure.current.forEach(l => map.removeLayer(l));
    markersMesure.current = [];
    lignesMesure.current = [];
    ptsMesure.current = [];
  }, [map]);

  useMapEvents({
    click: (e) => {
      if (mode === 'mesure') {
        const pt = e.latlng;
        ptsMesure.current.push(pt);
        const m = L.circleMarker(pt, {radius:4, color:'#e74c3c', fillOpacity:1}).addTo(map);
        markersMesure.current.push(m);
        if (ptsMesure.current.length >= 2) {
          const pts = ptsMesure.current;
          const dist = pts[pts.length-2].distanceTo(pts[pts.length-1]);
          const total = pts.reduce((acc, p, i) => i===0?0:acc+pts[i-1].distanceTo(p), 0);
          const km = (dist/1000).toFixed(2);
          const totalKm = (total/1000).toFixed(2);
          const l = L.polyline([pts[pts.length-2], pt], {color:'#e74c3c', weight:2, dashArray:'5,5'}).addTo(map);
          l.bindTooltip(`${km} km (total: ${totalKm} km)`, {permanent:true, className:'label-mesure'});
          lignesMesure.current.push(l);
        }
      }
    },
    dblclick: () => { if (mode==='mesure') { setMode(null); nettoyerMesure(); } }
  });

  if (!actif) return null;
  return (
    <div className="outils-dessin" style={{
      position:'absolute', top:60, right:10, zIndex:1000,
      background:'white', borderRadius:8, boxShadow:'0 2px 12px rgba(0,0,0,0.18)',
      padding:8, display:'flex', flexDirection:'column', gap:4, minWidth:130,
    }}>
      <div style={{fontSize:'0.7rem',fontWeight:700,color:'#1a3a5c',marginBottom:2,padding:'0 4px'}}>OUTILS</div>
      {[
        {id:'mesure', icon:'📏', label:'Mesurer distance'},
      ].map(outil => (
        <button key={outil.id}
          onClick={() => setMode(mode===outil.id ? null : outil.id)}
          style={{
            background: mode===outil.id ? '#1a5276' : '#f0f4f8',
            color:      mode===outil.id ? 'white'   : '#1a3a5c',
            border:'1px solid #cdd9e0', borderRadius:6,
            padding:'5px 10px', cursor:'pointer', fontSize:'0.78rem',
            textAlign:'left', fontWeight: mode===outil.id?700:400,
          }}>
          {outil.icon} {outil.label}
        </button>
      ))}
      {mode==='mesure' && (
        <div style={{fontSize:'0.68rem',color:'#888',padding:'2px 4px',lineHeight:1.5}}>
          Cliquez pour ajouter des points.<br/>Double-clic pour terminer.
        </div>
      )}
      <button onClick={nettoyerMesure}
        style={{background:'#fdf0f0',color:'#c0392b',border:'1px solid #f5c6c6',
          borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:'0.72rem',marginTop:2}}>
        🗑️ Effacer mesures
      </button>
    </div>
  );
}

// ── Barre fond de carte ────────────────────────────────────────────────────────
function BarreFond({ fondActif, setFond }) {
  const [open, setOpen] = useState(false);
  const fond = FONDS.find(f=>f.id===fondActif) || FONDS[0];
  return (
    <div style={{position:'absolute',bottom:36,right:10,zIndex:1000}}>
      <button onClick={()=>setOpen(!open)}
        style={{background:'white',border:'1.5px solid #cdd9e0',borderRadius:7,
          padding:'5px 10px',cursor:'pointer',fontSize:'0.78rem',fontWeight:700,
          boxShadow:'0 2px 8px rgba(0,0,0,0.13)',color:'#1a3a5c'}}>
        🗺 {fond.label} ▾
      </button>
      {open && (
        <div style={{position:'absolute',bottom:36,right:0,background:'white',
          border:'1.5px solid #cdd9e0',borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,0.18)',
          minWidth:180,overflow:'hidden'}}>
          {FONDS.map(f=>(
            <div key={f.id} onClick={()=>{setFond(f.id);setOpen(false);}}
              style={{padding:'7px 14px',cursor:'pointer',fontSize:'0.8rem',
                background:f.id===fondActif?'#eaf0f6':'white',
                color:f.id===fondActif?'#1a3a5c':'#333',
                fontWeight:f.id===fondActif?700:400,
                borderBottom:'1px solid #f0f0f0'}}>
              {f.id===fondActif?'✓ ':''}{f.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── COMPOSANT PRINCIPAL ────────────────────────────────────────────────────────
export default function CarteV3({
  geoData,
  featRegion, featDep, featArr, featCommune,
  visRegions, visDeps, visArrs, visCommunes,
  visEtiquettes,        // objet: { regions, departements, arrondissements, communes }
  geojsonThematiques, couchesActives, catalogue,
  importData, chargement,
  selRegion, selDep, selArr, selCommune,
  onRegionClick, onDepClick, onCommuneClick,
  mapRef,
  outilsActifs,
}) {
  const [coords, setCoords]   = useState(null);
  const [zoom,   setZoom]     = useState(7);
  const [fond,   setFond]     = useState('osm');
  const [outils, setOutils]   = useState(false);

  const zoomTarget = featCommune || featArr || featDep || featRegion;
  const fondConf   = FONDS.find(f=>f.id===fond) || FONDS[0];

  const styleF = useCallback((niveau, selPcode) => (feature) => {
    const base = { ...STYLES_BASE[niveau] };
    if (!selPcode) return base;
    return feature.properties._pcode === selPcode
      ? { ...STYLES_SEL[niveau] }
      : { ...base, fillOpacity:0.04, opacity:0.2 };
  }, []);

  const onEachRegion = useCallback((feature, layer) => {
    layer.on('click', () => onRegionClick?.(feature.properties._pcode));
    layer.on('mouseover', () => { if(feature.properties._pcode!==selRegion) layer.setStyle({weight:2.5,fillOpacity:0.5}); });
    layer.on('mouseout',  () => layer.setStyle(styleF('regions', selRegion)(feature)));
  }, [selRegion, onRegionClick, styleF]);

  const onEachDep = useCallback((feature, layer) => {
    layer.on('click', () => onDepClick?.(feature.properties._pcode));
  }, [onDepClick]);

  const onEachCommune = useCallback((feature, layer) => {
    layer.on('click', () => onCommuneClick?.(feature.properties._pcode));
    layer.on('mouseover', () => layer.setStyle({weight:2.5,fillOpacity:0.55}));
    layer.on('mouseout',  () => layer.setStyle(styleF('communes', selCommune)(feature)));
  }, [selCommune, onCommuneClick, styleF]);

  return (
    <div className="carte-wrapper" ref={mapRef} style={{position:'relative'}}>
      {chargement && <div className="carte-spinner">⏳ Chargement des données...</div>}

      {/* Bouton outils */}
      <button onClick={()=>setOutils(!outils)}
        style={{position:'absolute',top:10,right:10,zIndex:1001,
          background:outils?'#1a5276':'white', color:outils?'white':'#1a3a5c',
          border:'1.5px solid #cdd9e0',borderRadius:7,padding:'5px 10px',
          cursor:'pointer',fontSize:'0.78rem',fontWeight:700,
          boxShadow:'0 2px 8px rgba(0,0,0,0.13)'}}>
        🛠 Outils
      </button>

      <MapContainer center={[14.4,-14.4]} zoom={7}
        style={{height:'100%',width:'100%'}} zoomControl={true}
        doubleClickZoom={false}>

        {fondConf.url && (
          <TileLayer key={fond} url={fondConf.url} attribution={fondConf.attr} opacity={0.5} />
        )}

        <AutoZoom feature={zoomTarget} />
        <CoordsBar onCoords={setCoords} onZoom={setZoom} />

        {/* Couches admin polygones */}
        {visRegions && geoData.regions && (
          <GeoJSON key={`reg-${selRegion}-${geoData.regions.features.length}`}
            data={geoData.regions}
            style={styleF('regions', selRegion)}
            onEachFeature={onEachRegion} />
        )}
        {visDeps && geoData.departements && (
          <GeoJSON key={`dep-${selDep}-${geoData.departements.features.length}`}
            data={geoData.departements}
            style={styleF('departements', selDep)}
            onEachFeature={onEachDep} />
        )}
        {visArrs && geoData.arrondissements && (
          <GeoJSON key={`arr-${selArr}-${geoData.arrondissements.features.length}`}
            data={geoData.arrondissements}
            style={styleF('arrondissements', selArr)} />
        )}
        {visCommunes && geoData.communes && (
          <GeoJSON key={`com-${selCommune}-${geoData.communes.features.length}`}
            data={geoData.communes}
            style={styleF('communes', selCommune)}
            onEachFeature={onEachCommune} />
        )}

        {/* Etiquettes zoom-dependantes */}
        <EtiquetteLayer data={geoData.regions}         niveau="regions"         cssClass="leaflet-label-region"
          visible={visEtiquettes.regions}    zoom={zoom} />
        <EtiquetteLayer data={geoData.departements}    niveau="departements"    cssClass="leaflet-label-dept"
          visible={visEtiquettes.departements}  zoom={zoom} />
        <EtiquetteLayer data={geoData.arrondissements} niveau="arrondissements" cssClass="leaflet-label-arr"
          visible={visEtiquettes.arrondissements} zoom={zoom} />
        <EtiquetteLayer data={geoData.communes}        niveau="communes"        cssClass="leaflet-label-commune"
          visible={visEtiquettes.communes}   zoom={zoom} />

        {/* Couches thematiques */}
        {couchesActives.map(id => {
          const data = geojsonThematiques[id];
          if (!data?.features?.length) return null;
          const couleur = COULEURS_TH[id] || '#666';
          const isLine  = LIGNES_TH.has(id);
          return (
            <GeoJSON key={`th-${id}-${data.features.length}`} data={data}
              style={f => ({
                color:couleur, weight:isLine?1.8:1,
                fillColor:couleur, fillOpacity:isLine?0:0.4, opacity:0.9,
              })}
              onEachFeature={(f,layer) => {
                const lignes = Object.entries(f.properties||{})
                  .filter(([k,v])=>v&&!k.startsWith('_')).slice(0,6)
                  .map(([k,v])=>`<b>${k}</b>: ${v}`).join('<br/>');
                if(lignes) layer.bindPopup(`<div style="font-size:0.8rem">${lignes}</div>`);
              }}
            />
          );
        })}

        {/* Import */}
        {importData && (
          <GeoJSON key={`imp-${importData.features?.length}`} data={importData}
            style={()=>({color:'#8e44ad',weight:2,fillColor:'#9b59b6',fillOpacity:0.5})}
            onEachFeature={(f,layer)=>{
              const l=Object.entries(f.properties||{}).filter(([k,v])=>v).slice(0,8)
                .map(([k,v])=>`<b>${k}</b>: ${v}`).join('<br/>');
              layer.bindPopup(`<div style="font-size:0.8rem">${l}</div>`);
            }}
          />
        )}

        {outils && <OutilsDessin actif={outils} />}
      </MapContainer>

      {outils && <BarreFond fondActif={fond} setFond={setFond} />}

      {coords && (
        <div className="coords-bar">
          <span>📍 Lat: {coords.lat.toFixed(5)} &nbsp; Lng: {coords.lng.toFixed(5)}</span>
          <span>WGS 84 | Zoom: {zoom}</span>
        </div>
      )}
    </div>
  );
}
