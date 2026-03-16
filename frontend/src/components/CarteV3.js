/**
 * CarteV3 — Carte principale responsive v5
 * Nouveautés:
 * - Zoom auto sur fichier importé
 * - Mesure de distance ET de surface
 * - Recherche par nom (localités/communes)
 * - Recherche par coordonnées
 * - Coordinate picker (clic carte → copie)
 */
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const STYLES_BASE = {
  regions:         { color:'#7f8c8d', weight:2,   fillColor:'#bdc3c7', fillOpacity:0.35 },
  departements:    { color:'#7f8c8d', weight:1.5, fillColor:'#bdc3c7', fillOpacity:0.20 },
  arrondissements: { color:'#95a5a6', weight:1,   fillColor:'#d5d8dc', fillOpacity:0.15 },
  communes:        { color:'#e74c3c', weight:1,   fillColor:'#fadbd8', fillOpacity:0.15 },
};
const STYLES_SEL_BASE = {
  regions:         { color:'#1a5276', weight:3.5, fillColor:'#2471a3', fillOpacity:0.55 },
  departements:    { color:'#154360', weight:3.5, fillColor:'#1a5276', fillOpacity:0.55 },
  arrondissements: { color:'#0e6655', weight:3.5, fillColor:'#117a65', fillOpacity:0.55 },
};

const LIGNES_TH = new Set(['routes','chemin_fer','cours_eau','courbes_niveau','frontieres']);
const POINTS_TH = new Set(['localites','aeroports','points_eau']);

const FONDS = [
  { id:'osm',   label:'OpenStreetMap',  url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',    attr:'&copy; OpenStreetMap' },
  { id:'topo',  label:'OpenTopoMap',    url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',      attr:'&copy; OpenTopoMap' },
  { id:'sat',   label:'Satellite Esri', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'&copy; Esri' },
  { id:'carto', label:'CartoDB Clair',  url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',  attr:'&copy; CartoDB' },
  { id:'dark',  label:'CartoDB Sombre', url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',   attr:'&copy; CartoDB' },
  { id:'none',  label:'Aucun fond',     url:'', attr:'' },
];

const ZOOM_MIN = { regions:5, departements:8, arrondissements:10, communes:11, localites:9 };

// ─── Helpers géométrie ────────────────────────────────────────────
function sphericalArea(latlngs) {
  // Shoelace sur WGS84 → m²
  const R = 6371000;
  const pts = latlngs.map(p => [p.lat * Math.PI/180, p.lng * Math.PI/180]);
  let area = 0;
  for (let i=0, n=pts.length; i<n; i++) {
    const [lat1,lon1] = pts[i];
    const [lat2,lon2] = pts[(i+1)%n];
    area += (lon2-lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs(area * R * R / 2);
}

// ─── Auto-zoom sur selection admin ────────────────────────────────
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

// ─── Auto-zoom sur fichier importé (indépendant) ──────────────────
function AutoZoomImport({ importData }) {
  const map = useMap();
  const prevLen = useRef(null);
  useEffect(() => {
    if (!importData?.features?.length) return;
    const len = importData.features.length;
    if (len === prevLen.current) return;
    prevLen.current = len;
    try {
      const b = L.geoJSON(importData).getBounds();
      if (b.isValid()) map.flyToBounds(b, { padding:[50,50], maxZoom:16, duration:1.0 });
    } catch(e){}
  }, [importData, map]);
  return null;
}

// ─── Barre coords + zoom ──────────────────────────────────────────
function CoordsBar({ onCoords, onZoom, pickerActif, onPickerClick }) {
  const map = useMap();
  useMapEvents({
    mousemove: e => onCoords(e.latlng),
    zoomend:   () => onZoom(map.getZoom()),
    click:     e => { if (pickerActif) onPickerClick(e.latlng); },
  });
  return null;
}

// ─── Étiquettes admin ─────────────────────────────────────────────
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
        if (!nom) return;
        layer.bindTooltip(nom, { permanent:true, direction:'center', className:cssClass, sticky:false });
      }}
    />
  );
}

function EtiquettesLocalites({ data, visible, zoom }) {
  if (!visible || !data?.features) return null;
  if (zoom < ZOOM_MIN.localites) return null;
  return (
    <GeoJSON
      key={`etiq-localites-${zoom}-${data.features.length}`}
      data={data}
      style={() => ({ color:'transparent', weight:0, fillOpacity:0, fillColor:'transparent' })}
      pointToLayer={() => L.circleMarker([0,0], { radius:0, opacity:0, fillOpacity:0 })}
      onEachFeature={(feature, layer) => {
        const nom = feature.properties._nom || feature.properties.NOM || feature.properties.NAME || '';
        if (!nom) return;
        layer.bindTooltip(nom, { permanent:true, direction:'right', offset:[4,0], className:'leaflet-label-localite', sticky:false });
      }}
    />
  );
}

// ─── Panel Outils ─────────────────────────────────────────────────
function PanelOutils({ geoData, geojsonThematiques, pickerActif, setPickerActif, pickerCoords }) {
  const map = useMap();
  const [onglet, setOnglet] = useState('mesure'); // mesure | surface | recherche | coords

  // --- Mesure distance ---
  const [modeMesure, setModeMesure] = useState(false);
  const ptsMesure = useRef([]);
  const markersMesure = useRef([]);
  const lignesMesure = useRef([]);
  const nettoyerMesure = useCallback(() => {
    markersMesure.current.forEach(m => map.removeLayer(m));
    lignesMesure.current.forEach(l => map.removeLayer(l));
    markersMesure.current=[]; lignesMesure.current=[]; ptsMesure.current=[];
  }, [map]);

  // --- Mesure surface ---
  const [modeSurface, setModeSurface] = useState(false);
  const ptsSurface = useRef([]);
  const layersSurface = useRef([]);
  const [surfaceResult, setSurfaceResult] = useState(null);
  const nettoyerSurface = useCallback(() => {
    layersSurface.current.forEach(l => map.removeLayer(l));
    layersSurface.current=[]; ptsSurface.current=[]; setSurfaceResult(null);
  }, [map]);

  // --- Recherche ---
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState([]);
  const markersRech = useRef([]);
  const nettoyerRecherche = useCallback(() => {
    markersRech.current.forEach(m => map.removeLayer(m));
    markersRech.current=[]; setResultats([]);
  }, [map]);

  // --- Coords ---
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [coordMarker, setCoordMarker] = useState(null);
  const [copie, setCopie] = useState(false);

  useMapEvents({
    click: (e) => {
      // mesure distance
      if (modeMesure) {
        const pt = e.latlng;
        ptsMesure.current.push(pt);
        markersMesure.current.push(L.circleMarker(pt,{radius:4,color:'#e74c3c',fillOpacity:1}).addTo(map));
        if (ptsMesure.current.length >= 2) {
          const pts = ptsMesure.current;
          const dist  = pts[pts.length-2].distanceTo(pt);
          const total = pts.reduce((acc,p,i)=>i===0?0:acc+pts[i-1].distanceTo(p),0);
          const l = L.polyline([pts[pts.length-2],pt],{color:'#e74c3c',weight:2,dashArray:'5,5'}).addTo(map);
          l.bindTooltip(`${(dist/1000).toFixed(2)} km | total: ${(total/1000).toFixed(2)} km`,
            {permanent:true,className:'label-mesure'});
          lignesMesure.current.push(l);
        }
      }
      // mesure surface
      if (modeSurface) {
        const pt = e.latlng;
        ptsSurface.current.push(pt);
        const mk = L.circleMarker(pt,{radius:4,color:'#8e44ad',fillOpacity:1}).addTo(map);
        layersSurface.current.push(mk);
        if (ptsSurface.current.length >= 3) {
          layersSurface.current.filter(l=>l instanceof L.Polygon).forEach(l=>map.removeLayer(l));
          layersSurface.current = layersSurface.current.filter(l=>!(l instanceof L.Polygon));
          const poly = L.polygon(ptsSurface.current,{color:'#8e44ad',weight:2,fillColor:'#9b59b6',fillOpacity:0.25,dashArray:'4,4'}).addTo(map);
          const m2 = sphericalArea(ptsSurface.current);
          const km2 = m2/1e6;
          const ha  = m2/1e4;
          poly.bindTooltip(
            km2>=1 ? `${km2.toFixed(2)} km²` : `${ha.toFixed(1)} ha`,
            {permanent:true,className:'label-mesure'}
          );
          layersSurface.current.push(poly);
          setSurfaceResult(km2>=1?`${km2.toFixed(3)} km²`:`${ha.toFixed(2)} ha (${km2.toFixed(4)} km²)`);
        }
      }
    },
    dblclick: () => {
      if (modeMesure) { setModeMesure(false); nettoyerMesure(); }
      if (modeSurface){ setModeSurface(false); nettoyerSurface(); }
    },
  });

  // Recherche par nom dans toutes les sources
  const lancerRecherche = useCallback(() => {
    if (!recherche.trim() || recherche.length < 2) return;
    nettoyerRecherche();
    const q = recherche.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const sources = [
      ...(geoData.communes?.features||[]).map(f=>({...f,_src:'Commune'})),
      ...(geoData.regions?.features||[]).map(f=>({...f,_src:'Région'})),
      ...(geoData.departements?.features||[]).map(f=>({...f,_src:'Département'})),
      ...(geojsonThematiques.localites?.features||[]).map(f=>({...f,_src:'Localité'})),
    ];
    const trouvees = sources.filter(f => {
      const nom = (f.properties._nom||f.properties.NOM||f.properties.NAME||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return nom.includes(q);
    }).slice(0,10);
    setResultats(trouvees.map(f=>({
      nom: f.properties._nom||f.properties.NOM||f.properties.NAME||'?',
      src: f._src,
      feature: f,
    })));
  }, [recherche, geoData, geojsonThematiques, nettoyerRecherche]);

  const zoomSurResultat = useCallback((feat) => {
    try {
      if (feat.geometry.type==='Point') {
        const [lon,lat] = feat.geometry.coordinates;
        const mk = L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div style="background:#e74c3c;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',iconAnchor:[6,6]})}).addTo(map);
        markersRech.current.push(mk);
        map.flyTo([lat,lon],14,{duration:0.8});
      } else {
        const b = L.geoJSON(feat).getBounds();
        if (b.isValid()) map.flyToBounds(b,{padding:[40,40],maxZoom:14,duration:0.8});
      }
    } catch(e){}
  }, [map]);

  // Recherche par coordonnées
  const allerAuxCoords = useCallback(() => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    if (isNaN(lat)||isNaN(lon)) return;
    if (coordMarker) map.removeLayer(coordMarker);
    const mk = L.marker([lat,lon],{
      icon: L.divIcon({className:'',
        html:'<div style="background:#2471a3;color:white;padding:3px 7px;border-radius:5px;font-size:0.65rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍 '+lat.toFixed(4)+', '+lon.toFixed(4)+'</div>',
        iconAnchor:[0,0]
      })
    }).addTo(map);
    setCoordMarker(mk);
    map.flyTo([lat,lon],14,{duration:0.8});
  }, [latInput, lonInput, map, coordMarker]);

  // Coordinate picker → copie
  const copierPickerCoords = useCallback(() => {
    if (!pickerCoords) return;
    const txt = `${pickerCoords.lat.toFixed(6)}, ${pickerCoords.lng.toFixed(6)}`;
    navigator.clipboard.writeText(txt).then(()=>{ setCopie(true); setTimeout(()=>setCopie(false),2000); });
  }, [pickerCoords]);

  const BTN = ({label, actif, onClick}) => (
    <button onClick={onClick} style={{
      background:actif?'#1a5276':'#f0f4f8', color:actif?'white':'#1a3a5c',
      border:'1px solid '+(actif?'#1a5276':'#cdd9e0'), borderRadius:6,
      padding:'5px 8px', cursor:'pointer', fontSize:'0.76rem',
      fontWeight:actif?700:400, textAlign:'left', width:'100%',
    }}>{label}</button>
  );

  const ONGLETS = [
    {id:'mesure',   icon:'📏', label:'Distance'},
    {id:'surface',  icon:'⬜', label:'Surface'},
    {id:'recherche',icon:'🔍', label:'Recherche'},
    {id:'coords',   icon:'📍', label:'Coords'},
  ];

  return (
    <div style={{position:'absolute',top:58,right:10,zIndex:1000,background:'white',
      borderRadius:10,boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
      width:240,overflow:'hidden',border:'1px solid #dce3ea'}}>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#0d2137,#1a3a5c)',color:'white',
        padding:'7px 12px',fontSize:'0.72rem',fontWeight:700}}>🛠 OUTILS CARTOGRAPHIQUES</div>

      {/* Onglets */}
      <div style={{display:'flex',borderBottom:'1px solid #eef2f7',background:'#f7f9fc'}}>
        {ONGLETS.map(o=>(
          <button key={o.id} onClick={()=>setOnglet(o.id)}
            style={{flex:1,padding:'6px 2px',border:'none',cursor:'pointer',
              background:onglet===o.id?'white':'transparent',
              borderBottom:onglet===o.id?'2px solid #1a5276':'2px solid transparent',
              color:onglet===o.id?'#1a3a5c':'#7f8c8d',
              fontSize:'0.6rem',fontWeight:onglet===o.id?700:400,
              display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
            <span style={{fontSize:'0.9rem'}}>{o.icon}</span>
            {o.label}
          </button>
        ))}
      </div>

      <div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:8}}>

        {/* ── Mesure distance ── */}
        {onglet==='mesure' && (<>
          <BTN label={modeMesure?'⏹ Arrêter mesure':'▶ Démarrer mesure distance'}
            actif={modeMesure}
            onClick={()=>{ if(modeMesure){nettoyerMesure();} setModeMesure(!modeMesure); }}
          />
          {modeMesure && <div style={{fontSize:'0.67rem',color:'#5d6d7e',lineHeight:1.6,background:'#eaf4fb',borderRadius:6,padding:'5px 8px'}}>
            🖱 Cliquez pour ajouter des points<br/>Double-clic pour terminer
          </div>}
          <button onClick={nettoyerMesure}
            style={{background:'#fdf0f0',color:'#c0392b',border:'1px solid #f5c6c6',
              borderRadius:6,padding:'5px 8px',cursor:'pointer',fontSize:'0.72rem'}}>
            🗑️ Effacer
          </button>
        </>)}

        {/* ── Mesure surface ── */}
        {onglet==='surface' && (<>
          <BTN label={modeSurface?'⏹ Arrêter surface':'▶ Démarrer mesure surface'}
            actif={modeSurface}
            onClick={()=>{ if(modeSurface){nettoyerSurface();} setModeSurface(!modeSurface); }}
          />
          {modeSurface && <div style={{fontSize:'0.67rem',color:'#5d6d7e',lineHeight:1.6,background:'#f5eef8',borderRadius:6,padding:'5px 8px'}}>
            🖱 Cliquez pour délimiter le polygone<br/>Double-clic pour terminer
          </div>}
          {surfaceResult && <div style={{background:'#eaf8ee',border:'1px solid #a9dfbf',borderRadius:7,padding:'7px 10px',textAlign:'center',fontWeight:700,fontSize:'0.82rem',color:'#1e8449'}}>
            📐 {surfaceResult}
          </div>}
          <button onClick={nettoyerSurface}
            style={{background:'#fdf0f0',color:'#c0392b',border:'1px solid #f5c6c6',
              borderRadius:6,padding:'5px 8px',cursor:'pointer',fontSize:'0.72rem'}}>
            🗑️ Effacer
          </button>
        </>)}

        {/* ── Recherche par nom ── */}
        {onglet==='recherche' && (<>
          <div style={{display:'flex',gap:5}}>
            <input
              value={recherche}
              onChange={e=>setRecherche(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&lancerRecherche()}
              placeholder="Nom localité, commune…"
              style={{flex:1,padding:'6px 8px',border:'1.5px solid #dce3ea',
                borderRadius:7,fontSize:'0.76rem',outline:'none'}}
            />
            <button onClick={lancerRecherche}
              style={{background:'#1a5276',color:'white',border:'none',
                borderRadius:7,padding:'6px 10px',cursor:'pointer',fontSize:'0.8rem'}}>
              🔍
            </button>
          </div>
          {resultats.length===0 && recherche.length>1 && (
            <div style={{fontSize:'0.68rem',color:'#999',textAlign:'center'}}>Aucun résultat</div>
          )}
          <div style={{maxHeight:160,overflowY:'auto',display:'flex',flexDirection:'column',gap:3}}>
            {resultats.map((r,i)=>(
              <div key={i} onClick={()=>zoomSurResultat(r.feature)}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'5px 8px',borderRadius:6,cursor:'pointer',background:'#f7f9fc',
                  border:'1px solid #eef2f7',transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='#eaf4fb'}
                onMouseLeave={e=>e.currentTarget.style.background='#f7f9fc'}
              >
                <span style={{fontSize:'0.75rem',fontWeight:600,color:'#1a3a5c'}}>{r.nom}</span>
                <span style={{fontSize:'0.6rem',background:'#1a5276',color:'white',
                  padding:'1px 5px',borderRadius:9,flexShrink:0}}>{r.src}</span>
              </div>
            ))}
          </div>
          {resultats.length > 0 && (
            <button onClick={nettoyerRecherche}
              style={{background:'#fdf0f0',color:'#c0392b',border:'1px solid #f5c6c6',
                borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:'0.7rem'}}>
              🗑️ Effacer résultats
            </button>
          )}
        </>)}

        {/* ── Coords ── */}
        {onglet==='coords' && (<>
          <div style={{fontSize:'0.67rem',color:'#5d6d7e',fontWeight:700,marginBottom:2}}>Aller aux coordonnées</div>
          <div style={{display:'flex',gap:5}}>
            <input value={latInput} onChange={e=>setLatInput(e.target.value)}
              placeholder="Latitude" type="number" step="0.0001"
              style={{flex:1,padding:'5px 7px',border:'1.5px solid #dce3ea',
                borderRadius:7,fontSize:'0.74rem',outline:'none'}}
            />
            <input value={lonInput} onChange={e=>setLonInput(e.target.value)}
              placeholder="Longitude" type="number" step="0.0001"
              style={{flex:1,padding:'5px 7px',border:'1.5px solid #dce3ea',
                borderRadius:7,fontSize:'0.74rem',outline:'none'}}
            />
          </div>
          <button onClick={allerAuxCoords}
            style={{background:'#1a5276',color:'white',border:'none',borderRadius:7,
              padding:'7px',cursor:'pointer',fontSize:'0.76rem',fontWeight:600}}>
            📍 Centrer sur ces coordonnées
          </button>

          <hr style={{border:'none',borderTop:'1px solid #eef2f7',margin:'4px 0'}}/>
          <div style={{fontSize:'0.67rem',color:'#5d6d7e',fontWeight:700,marginBottom:2}}>Coordinate Picker</div>
          <button onClick={()=>setPickerActif(!pickerActif)}
            style={{
              background:pickerActif?'#8e44ad':'#f0f4f8',
              color:pickerActif?'white':'#1a3a5c',
              border:'1px solid '+(pickerActif?'#8e44ad':'#cdd9e0'),
              borderRadius:6,padding:'6px 8px',cursor:'pointer',
              fontSize:'0.76rem',fontWeight:pickerActif?700:400,
            }}>
            {pickerActif?'⏹ Désactiver Picker':'🖱 Activer Coordinate Picker'}
          </button>
          {pickerActif && <div style={{fontSize:'0.67rem',color:'#6c3483',background:'#f5eef8',
            borderRadius:6,padding:'5px 8px',lineHeight:1.6}}>
            Cliquez sur la carte pour capturer les coordonnées
          </div>}
          {pickerCoords && (
            <div style={{background:'#eaf4fb',border:'1px solid #aed6f1',borderRadius:7,
              padding:'7px 10px',display:'flex',flexDirection:'column',gap:4}}>
              <div style={{fontFamily:'monospace',fontSize:'0.75rem',fontWeight:700,color:'#1a3a5c'}}>
                {pickerCoords.lat.toFixed(6)}, {pickerCoords.lng.toFixed(6)}
              </div>
              <button onClick={copierPickerCoords}
                style={{background:copie?'#1e8449':'#1a5276',color:'white',border:'none',
                  borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:'0.7rem',
                  transition:'background .2s'}}>
                {copie?'✅ Copié !':'📋 Copier les coordonnées'}
              </button>
            </div>
          )}
        </>)}

      </div>
    </div>
  );
}

function BarreFond({ fondActif, setFond }) {
  const [open, setOpen] = useState(false);
  const fond = FONDS.find(f=>f.id===fondActif)||FONDS[0];
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
          border:'1.5px solid #cdd9e0',borderRadius:8,
          boxShadow:'0 4px 16px rgba(0,0,0,0.18)',minWidth:180,overflow:'hidden'}}>
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

function CoucheThematique({ id, data, couleur }) {
  if (!data?.features?.length) return null;
  const isLine  = LIGNES_TH.has(id);
  const isPoint = POINTS_TH.has(id);
  const styleFn = () => ({ color:couleur, weight:isLine?1.6:1, fillColor:couleur, fillOpacity:isLine?0:0.35, opacity:0.85 });
  const popupFn = (f, layer) => {
    const lignes = Object.entries(f.properties||{}).filter(([k,v])=>v&&!k.startsWith('_'))
      .slice(0,6).map(([k,v])=>`<b>${k}</b>: ${v}`).join('<br/>');
    if (lignes) layer.bindPopup(`<div style="font-size:0.8rem;max-width:220px">${lignes}</div>`);
  };
  if (isPoint) {
    return (
      <GeoJSON key={`th-${id}-${data.features.length}`} data={data}
        pointToLayer={(f,latlng) => L.circleMarker(latlng, {
          radius:id==='localites'?2.5:4, color:couleur, weight:1,
          fillColor:couleur, fillOpacity:0.75, opacity:0.9,
        })}
        onEachFeature={popupFn} />
    );
  }
  return (
    <GeoJSON key={`th-${id}-${data.features.length}`} data={data}
      style={styleFn} onEachFeature={popupFn} />
  );
}

// ══════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function CarteV3({
  geoData, featRegion, featDep, featArr, featCommune,
  visRegions, visDeps, visArrs, visCommunes, visEtiquettes,
  geojsonThematiques, couchesActives, catalogue,
  importData, chargement,
  selRegion, selDep, selArr, selCommune,
  onRegionClick, onDepClick, onCommuneClick,
  couleurCommune, mapRef,
  isMobile, onOpenDrawerGauche, onOpenDrawerDroit,
}) {
  const [coords, setCoords]         = useState(null);
  const [zoom,   setZoom]           = useState(7);
  const [fond,   setFond]           = useState('osm');
  const [outils, setOutils]         = useState(false);
  const [pickerActif, setPickerActif] = useState(false);
  const [pickerCoords, setPickerCoords] = useState(null);

  const zoomTarget = featCommune || featArr || featDep || featRegion;
  const fondConf   = FONDS.find(f=>f.id===fond)||FONDS[0];

  const getStyleCommune = useCallback((couleur) => ({
    selectionne: { color:couleur, weight:3.5, fillColor:couleur, fillOpacity:0.60 },
    base:        { color:'#e74c3c', weight:1, fillColor:'#fadbd8', fillOpacity:0.15 },
    attenue:     { color:'#e74c3c', weight:1, fillColor:'#fadbd8', fillOpacity:0.04, opacity:0.2 },
  }), []);

  const styleF = useCallback((niveau, selPcode) => (feature) => {
    const base = { ...STYLES_BASE[niveau] };
    if (niveau==='communes' && selPcode) {
      const s = getStyleCommune(couleurCommune);
      return feature.properties._pcode===selPcode ? s.selectionne : s.attenue;
    }
    if (!selPcode) return base;
    const sel = STYLES_SEL_BASE[niveau];
    return feature.properties._pcode===selPcode
      ? {...sel}
      : {...base, fillOpacity:0.04, opacity:0.2};
  }, [couleurCommune, getStyleCommune]);

  const onEachRegion = useCallback((feature, layer) => {
    layer.on('click',     () => onRegionClick?.(feature.properties._pcode));
    layer.on('mouseover', () => { if (feature.properties._pcode!==selRegion) layer.setStyle({weight:2.5,fillOpacity:0.5}); });
    layer.on('mouseout',  () => layer.setStyle(styleF('regions',selRegion)(feature)));
  }, [selRegion, onRegionClick, styleF]);

  const onEachDep = useCallback((feature, layer) => {
    layer.on('click', () => onDepClick?.(feature.properties._pcode));
  }, [onDepClick]);

  const onEachCommune = useCallback((feature, layer) => {
    layer.on('click',     () => onCommuneClick?.(feature.properties._pcode));
    layer.on('mouseover', () => layer.setStyle({weight:2.5,fillOpacity:0.55}));
    layer.on('mouseout',  () => layer.setStyle(styleF('communes',selCommune)(feature)));
  }, [selCommune, onCommuneClick, styleF]);

  const localitesData = geojsonThematiques['localites'];

  // Curseur picker
  const cursorStyle = pickerActif ? { cursor:'crosshair' } : {};

  return (
    <div className="carte-wrapper" ref={mapRef} style={{position:'relative',...cursorStyle}}>
      {chargement && <div className="carte-spinner">⏳ Chargement…</div>}

      {/* Bouton outils desktop */}
      {!isMobile && (
        <button onClick={()=>setOutils(!outils)}
          style={{position:'absolute',top:10,right:10,zIndex:1001,
            background:outils?'#1a5276':'white',
            color:outils?'white':'#1a3a5c',
            border:'1.5px solid #cdd9e0',borderRadius:7,
            padding:'5px 12px',cursor:'pointer',fontSize:'0.78rem',fontWeight:700,
            boxShadow:'0 2px 8px rgba(0,0,0,0.13)'}}>
          🛠 Outils
        </button>
      )}

      {/* Boutons flottants mobile */}
      {isMobile && (
        <div className="mobile-fab-bar">
          <button className="mobile-fab" onClick={onOpenDrawerGauche} title="Navigation">🗺️</button>
          <button className="mobile-fab" onClick={()=>setOutils(!outils)} title="Outils">🛠</button>
          <button className="mobile-fab" onClick={onOpenDrawerDroit} title="Couches">🗹</button>
        </div>
      )}

      {/* Indicateur picker actif */}
      {pickerActif && (
        <div style={{position:'absolute',top:50,left:'50%',transform:'translateX(-50%)',
          zIndex:1001,background:'rgba(142,68,173,0.9)',color:'white',
          padding:'4px 14px',borderRadius:20,fontSize:'0.72rem',fontWeight:700,
          pointerEvents:'none',boxShadow:'0 2px 10px rgba(0,0,0,0.2)'}}>
          🖱 Picker actif — Cliquez sur la carte
        </div>
      )}

      <MapContainer center={[14.4,-14.4]} zoom={7}
        style={{height:'100%',width:'100%'}} zoomControl={true} doubleClickZoom={false}>
        {fondConf.url && <TileLayer key={fond} url={fondConf.url} attribution={fondConf.attr} opacity={0.5} />}
        <AutoZoom feature={zoomTarget} />
        <AutoZoomImport importData={importData} />
        <CoordsBar
          onCoords={setCoords} onZoom={setZoom}
          pickerActif={pickerActif}
          onPickerClick={latlng => setPickerCoords(latlng)}
        />

        {/* Couches admin */}
        {visRegions && geoData.regions && (
          <GeoJSON key={`reg-${selRegion}-${geoData.regions.features.length}`}
            data={geoData.regions} style={styleF('regions',selRegion)} onEachFeature={onEachRegion} />
        )}
        {visDeps && geoData.departements && (
          <GeoJSON key={`dep-${selDep}-${geoData.departements.features.length}`}
            data={geoData.departements} style={styleF('departements',selDep)} onEachFeature={onEachDep} />
        )}
        {visArrs && geoData.arrondissements && (
          <GeoJSON key={`arr-${selArr}-${geoData.arrondissements.features.length}`}
            data={geoData.arrondissements} style={styleF('arrondissements',selArr)} />
        )}
        {visCommunes && geoData.communes && (
          <GeoJSON key={`com-${selCommune}-${couleurCommune}-${geoData.communes.features.length}`}
            data={geoData.communes} style={styleF('communes',selCommune)} onEachFeature={onEachCommune} />
        )}

        {/* Etiquettes admin */}
        <EtiquetteLayer data={geoData.regions}         niveau="regions"         cssClass="leaflet-label-region"  visible={visEtiquettes.regions}         zoom={zoom} />
        <EtiquetteLayer data={geoData.departements}    niveau="departements"    cssClass="leaflet-label-dept"    visible={visEtiquettes.departements}    zoom={zoom} />
        <EtiquetteLayer data={geoData.arrondissements} niveau="arrondissements" cssClass="leaflet-label-arr"     visible={visEtiquettes.arrondissements} zoom={zoom} />
        <EtiquetteLayer data={geoData.communes}        niveau="communes"        cssClass="leaflet-label-commune" visible={visEtiquettes.communes}        zoom={zoom} />

        {/* Localités */}
        {couchesActives.includes('localites') && localitesData?.features?.length > 0 && (
          <GeoJSON key={`th-localites-pts-${localitesData.features.length}`} data={localitesData}
            pointToLayer={(f,latlng) => L.circleMarker(latlng, {
              radius:2.5, color:'#c0392b', weight:0.8,
              fillColor:'#c0392b', fillOpacity:0.75, opacity:0.9,
            })}
            onEachFeature={(f,layer) => {
              const nom = f.properties._nom||f.properties.NOM||f.properties.NAME||'';
              if (nom) layer.bindPopup(`<b>${nom}</b>`);
            }}
          />
        )}
        {couchesActives.includes('localites') && (
          <EtiquettesLocalites data={localitesData} visible={visEtiquettes.localites} zoom={zoom} />
        )}

        {/* Couches thématiques */}
        {couchesActives.filter(id=>id!=='localites').map(id => {
          const catItem = catalogue.find(c=>c.id===id);
          return <CoucheThematique key={`th-${id}`} id={id}
            data={geojsonThematiques[id]} couleur={catItem?.couleur||'#666'} />;
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

        {/* Panel Outils (dans MapContainer pour accéder à useMap) */}
        {outils && (
          <PanelOutils
            geoData={geoData}
            geojsonThematiques={geojsonThematiques}
            pickerActif={pickerActif}
            setPickerActif={setPickerActif}
            pickerCoords={pickerCoords}
          />
        )}
      </MapContainer>

      <BarreFond fondActif={fond} setFond={setFond} />

      {coords && (
        <div className="coords-bar">
          <span>📍 {coords.lat.toFixed(5)} | {coords.lng.toFixed(5)}</span>
          <span>Zoom {zoom}</span>
        </div>
      )}
    </div>
  );
}
