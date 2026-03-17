/**
 * ExportCarteModal v4 — Carte JUMELLE Leaflet
 * - Clone Leaflet dans le modal avec memes donnees/couleurs/selection
 * - Zoom auto sur la zone active (commune > arr > dep > region > Senegal)
 * - Ajustable manuellement avant export
 * - Export PNG HD / PDF A4 via leaflet-image (pas de html2canvas sur la carte)
 * - Outils cartographiques invisibles dans l'export
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';

const MOIS = ['Jan','F\u00e9v','Mar','Avr','Mai','Juin','Jul','Ao\u00fb','Sep','Oct','Nov','D\u00e9c'];
function dateStr() {
  const d = new Date();
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Styles carte jumelle ────────────────────────────────────────────────────
const ST = {
  regions:      { color:'#7f8c8d', weight:2,   fillColor:'#bdc3c7', fillOpacity:0.35 },
  departements: { color:'#7f8c8d', weight:1.5, fillColor:'#bdc3c7', fillOpacity:0.20 },
  arrond:       { color:'#95a5a6', weight:1,   fillColor:'#d5d8dc', fillOpacity:0.15 },
  communes:     { color:'#e74c3c', weight:1,   fillColor:'#fadbd8', fillOpacity:0.15 },
  selected:     (c) => ({ color:c||'#1a5276', weight:3.5, fillColor:c||'#2471a3', fillOpacity:0.55 }),
};

// ─── Zoom auto sur la zone active ───────────────────────────────────────────
function AutoZoomExport({ feature }) {
  const map = useMap();
  useEffect(() => {
    if (!feature) {
      map.flyTo([14.4, -14.4], 7, { duration: 0.6 });
      return;
    }
    try {
      const b = L.geoJSON(feature).getBounds();
      if (b.isValid()) map.flyToBounds(b, { padding: [30, 30], maxZoom: 14, duration: 0.8 });
    } catch(e) {}
  }, [feature, map]);
  return null;
}

// ─── Cartouche SVG localisation ──────────────────────────────────────────────
function CartoucheSVG({ titre, polygonesFond, polygonesMis, width=148, height=96 }) {
  if (!polygonesFond?.length) return (
    <svg width={width} height={height} style={{border:'1px solid #aaa',background:'#f5f5f5'}}>
      <text x={width/2} y={height/2} textAnchor="middle" fontSize="9" fill="#aaa">Pas de donn\u00e9es</text>
    </svg>
  );
  const allPts = polygonesFond.flat();
  const lngs = allPts.map(p=>p[0]), lats = allPts.map(p=>p[1]);
  const mn=Math.min(...lats), mx=Math.max(...lats), ml=Math.min(...lngs), mxl=Math.max(...lngs);
  const pad=8, sx=(width-2*pad)/(mxl-ml||1), sy=(height-2*pad)/(mx-mn||1), s=Math.min(sx,sy);
  const ox=pad+((width-2*pad)-(mxl-ml)*s)/2, oy=pad+((height-2*pad)-(mx-mn)*s)/2;
  const proj=([lng,lat])=>[ox+(lng-ml)*s, oy+(mx-lat)*s];
  const toPath=ring=>ring.map((pt,i)=>{ const [x,y]=proj(pt); return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ')+' Z';
  return (
    <svg width={width} height={height} style={{border:'1.5px solid #7f8c8d',background:'#dce7f0',borderRadius:3}}>
      {polygonesFond.map((r,i)=><path key={`f${i}`} d={toPath(r)} fill="#bdc3c7" stroke="#7f8c8d" strokeWidth="0.8"/>)}
      {(polygonesMis||[]).map((r,i)=><path key={`m${i}`} d={toPath(r)} fill="white" stroke="#2c3e50" strokeWidth="1.5"/>)}
      {titre&&<text x="4" y={height-5} fontSize="8" fill="#1a3a5c" fontWeight="bold">{titre}</text>}
    </svg>
  );
}

function extractRings(f) {
  if (!f?.geometry) return [];
  if (f.geometry.type==='Polygon') return f.geometry.coordinates;
  if (f.geometry.type==='MultiPolygon') return f.geometry.coordinates.flat();
  return [];
}

function FlecheNord({size=34}) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <polygon points="18,2 23,18 18,14 13,18" fill="#1a3a5c"/>
      <polygon points="18,34 23,18 18,22 13,18" fill="#bdc3c7" stroke="#1a3a5c" strokeWidth="0.5"/>
      <text x="18" y="11" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">N</text>
    </svg>
  );
}

function BarreEchelle({zoom=7}) {
  const km = zoom<=6?500:zoom<=8?100:zoom<=10?20:5;
  return (
    <svg width="110" height="22">
      <rect x="5" y="9" width="90" height="5" fill="white" stroke="#333" strokeWidth="1"/>
      <rect x="5" y="9" width="45" height="5" fill="#333"/>
      <text x="5"  y="22" fontSize="8" fill="#333">0</text>
      <text x="46" y="22" fontSize="8" fill="#333">{km/2} km</text>
      <text x="88" y="22" fontSize="8" fill="#333">{km} km</text>
    </svg>
  );
}

// ─── Carte jumelle principale ────────────────────────────────────────────────
function CarteJumelle({
  geoData, featRegion, featDep, featArr, featCommune,
  geojsonThematiques, couchesActives, catalogue,
  couleurCommune, fond, zoneActive, mapExportRef,
}) {
  const fonds = [
    { id:'osm',   url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',    attr:'&copy; OpenStreetMap' },
    { id:'sat',   url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'&copy; Esri' },
    { id:'carto', url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr:'&copy; CartoDB' },
    { id:'none',  url:'', attr:'' },
  ];
  const fondConf = fonds.find(f=>f.id===fond) || fonds[0];

  // Style regions
  const styleReg = useCallback((f) => {
    if (!featRegion) return ST.regions;
    return f.properties._pcode === featRegion.properties._pcode
      ? ST.selected('#1a5276')
      : { ...ST.regions, fillOpacity:0.05, opacity:0.3 };
  }, [featRegion]);

  // Style departements
  const styleDep = useCallback((f) => {
    if (!featDep) return ST.departements;
    return f.properties._pcode === featDep.properties._pcode
      ? ST.selected('#154360')
      : { ...ST.departements, fillOpacity:0.05, opacity:0.3 };
  }, [featDep]);

  // Style arrondissements
  const styleArr = useCallback((f) => {
    if (!featArr) return ST.arrond;
    return f.properties._pcode === featArr.properties._pcode
      ? ST.selected('#0e6655')
      : { ...ST.arrond, fillOpacity:0.05, opacity:0.3 };
  }, [featArr]);

  // Style communes
  const styleCom = useCallback((f) => {
    if (!featCommune) return ST.communes;
    return f.properties._pcode === featCommune.properties._pcode
      ? ST.selected(couleurCommune)
      : { ...ST.communes, fillOpacity:0.04, opacity:0.2 };
  }, [featCommune, couleurCommune]);

  return (
    <MapContainer
      ref={mapExportRef}
      center={[14.4, -14.4]} zoom={7}
      style={{ height:'100%', width:'100%' }}
      zoomControl={true}
      attributionControl={false}
    >
      {fondConf.url && (
        <TileLayer key={fond} url={fondConf.url} attribution={fondConf.attr} opacity={0.6} />
      )}

      <AutoZoomExport feature={zoneActive} />

      {/* Couches admin */}
      {geoData.regions && (
        <GeoJSON
          key={`exp-reg-${featRegion?.properties?._pcode||'all'}`}
          data={geoData.regions} style={styleReg}
        />
      )}
      {geoData.departements && (
        <GeoJSON
          key={`exp-dep-${featDep?.properties?._pcode||'all'}`}
          data={geoData.departements} style={styleDep}
        />
      )}
      {geoData.arrondissements && (
        <GeoJSON
          key={`exp-arr-${featArr?.properties?._pcode||'all'}`}
          data={geoData.arrondissements} style={styleArr}
        />
      )}
      {geoData.communes && (
        <GeoJSON
          key={`exp-com-${featCommune?.properties?._pcode||'all'}-${couleurCommune}`}
          data={geoData.communes} style={styleCom}
        />
      )}

      {/* Couches thematiques actives */}
      {couchesActives.map(id => {
        const data = geojsonThematiques[id];
        if (!data?.features?.length) return null;
        const cat = catalogue.find(c=>c.id===id);
        const couleur = cat?.couleur || '#666';
        const isPoint = ['localites','aeroports','points_eau'].includes(id);
        const isLine  = ['routes','chemin_fer','cours_eau','courbes_niveau','frontieres'].includes(id);
        if (isPoint) {
          return (
            <GeoJSON key={`exp-th-${id}`} data={data}
              pointToLayer={(_,latlng) => L.circleMarker(latlng, {
                radius: id==='localites'?2:3.5,
                color: couleur, weight:0.8,
                fillColor: couleur, fillOpacity:0.8,
              })}
            />
          );
        }
        return (
          <GeoJSON key={`exp-th-${id}`} data={data}
            style={() => ({ color:couleur, weight:isLine?1.2:1, fillColor:couleur, fillOpacity:isLine?0:0.3 })}
          />
        );
      })}
    </MapContainer>
  );
}

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────────
export default function ExportCarteModal({
  onClose,
  featRegion, featDep, featArr, featCommune,
  geoData, geojsonThematiques, couchesActives, catalogue,
  couleurCommune,
  titre: titreProp, sousTitre: sousTitreProp,
}) {
  const layoutRef   = useRef(null);
  const mapExportRef = useRef(null);

  const [titre,     setTitre]     = useState(titreProp     || 'Carte administrative du S\u00e9n\u00e9gal');
  const [sousTitre, setSousTitre] = useState(sousTitreProp || '');
  const [source,    setSource]    = useState('OCHA/ANSD \u2013 Limites administratives S\u00e9n\u00e9gal');
  const [fond,      setFond]      = useState('osm');
  const [grille,    setGrille]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState('');

  const zoneActive = featCommune || featArr || featDep || featRegion || null;
  const nomZone    = zoneActive?.properties?._nom || 'S\u00e9n\u00e9gal';

  const polysSenegal = (geoData?.regions?.features||[]).map(f=>extractRings(f)).flat();
  const polysRegion  = featRegion ? extractRings(featRegion) : [];
  const polysFondReg = polysRegion.length ? polysRegion : polysSenegal;
  const polysMis     = zoneActive && zoneActive !== featRegion ? extractRings(zoneActive) : [];

  // Invalider la carte jumelle quand la modal s'ouvre
  useEffect(() => {
    const t = setTimeout(() => {
      if (mapExportRef.current) {
        mapExportRef.current.invalidateSize();
      }
    }, 300);
    return () => clearTimeout(t);
  }, []);

  // ── Export ──────────────────────────────────────────────────────────────────
  const generer = useCallback(async (format) => {
    setLoading(true);
    setMsg('Capture de la carte...');
    try {
      // Capturer la carte jumelle avec leaflet-image
      const mapInstance = mapExportRef.current;
      let carteDataUrl = null;

      if (mapInstance) {
        // Attendre que les tuiles soient chargees
        await new Promise(r => setTimeout(r, 800));
        try {
          const leafletImage = await import('leaflet-image');
          const fn = leafletImage.default || leafletImage;
          carteDataUrl = await new Promise((resolve, reject) => {
            fn(mapInstance, (err, canvas) => {
              if (err) reject(err);
              else resolve(canvas.toDataURL('image/png'));
            });
          });
        } catch(e) {
          // Fallback: html2canvas sur le container
          setMsg('Fallback html2canvas...');
          const mapEl = document.querySelector('.carte-export-jumelle .leaflet-container');
          if (mapEl) {
            const { default: html2canvas } = await import('html2canvas');
            // Masquer temporairement les controles
            const controls = mapEl.querySelectorAll('.leaflet-control-container');
            controls.forEach(el => { el.style.display='none'; });
            const canvas = await html2canvas(mapEl, {
              scale:1.8, useCORS:true, allowTaint:true,
              backgroundColor:'#dce7f0', logging:false,
            });
            controls.forEach(el => { el.style.display=''; });
            carteDataUrl = canvas.toDataURL('image/png');
          }
        }
      }

      setMsg('Composition mise en page...');
      await new Promise(r => setTimeout(r, 400));

      // Composer le layout avec html2canvas
      const { default: html2canvas } = await import('html2canvas');

      // Remplacer temporairement la carte par l'image capturee
      const carteEl = layoutRef.current?.querySelector('.zone-carte-export');
      let imgTemp = null;
      if (carteEl && carteDataUrl) {
        imgTemp = document.createElement('img');
        imgTemp.src = carteDataUrl;
        imgTemp.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:10';
        carteEl.appendChild(imgTemp);
      }

      await new Promise(r => setTimeout(r, 200));

      const canvas = await html2canvas(layoutRef.current, {
        scale:2, useCORS:true, allowTaint:true,
        backgroundColor:'#ffffff', logging:false,
      });

      if (imgTemp) carteEl.removeChild(imgTemp);

      const imgData = canvas.toDataURL('image/png');

      if (format === 'png') {
        const a = document.createElement('a');
        a.href = imgData;
        a.download = `carto_${nomZone.replace(/ /g,'_')}_${Date.now()}.png`;
        a.click();
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
        pdf.addImage(imgData,'PNG',0,0,297,210);
        pdf.save(`carto_${nomZone.replace(/ /g,'_')}_${Date.now()}.pdf`);
      }
      setMsg('\u2705 Export termin\u00e9 !');
    } catch(e) {
      setMsg('\u274c Erreur: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [nomZone]);

  const FONDS_EXPORT = [
    { id:'osm',   label:'OpenStreetMap' },
    { id:'carto', label:'CartoDB Clair' },
    { id:'sat',   label:'Satellite' },
    { id:'none',  label:'Aucun fond' },
  ];

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.72)',zIndex:9999,
      display:'flex',alignItems:'center',justifyContent:'center',padding:10}}>
      <div style={{background:'white',borderRadius:12,width:'98vw',maxWidth:1200,
        maxHeight:'97vh',display:'flex',flexDirection:'column',
        boxShadow:'0 12px 50px rgba(0,0,0,0.45)',overflow:'hidden'}}>

        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#1a3a5c,#1a5276)',color:'white',
          padding:'10px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <span style={{fontWeight:700,fontSize:'0.92rem'}}>\ud83d\udcc4 Mise en page \u2014 Export Carte</span>
          <button onClick={onClose}
            style={{background:'rgba(255,255,255,0.15)',border:'none',color:'white',
              borderRadius:6,padding:'4px 14px',cursor:'pointer',fontSize:'0.82rem'}}>
            \u00d7 Fermer
          </button>
        </div>

        <div style={{display:'flex',flex:1,overflow:'hidden',minHeight:0}}>

          {/* ── Panneau options ── */}
          <div style={{width:220,flexShrink:0,padding:'12px 10px',borderRight:'1px solid #eee',
            overflowY:'auto',fontSize:'0.8rem',display:'flex',flexDirection:'column',gap:8}}>

            <div style={{fontWeight:700,color:'#1a3a5c',fontSize:'0.78rem',borderBottom:'1px solid #eee',paddingBottom:5}}>
              \ud83d\udcdd Param\u00e8tres
            </div>

            {[['Titre',titre,setTitre],['Sous-titre',sousTitre,setSousTitre],['Source',source,setSource]]
              .map(([lbl,val,set])=>(
                <div key={lbl}>
                  <label style={{display:'block',marginBottom:2,color:'#555',fontWeight:600,fontSize:'0.72rem'}}>{lbl}</label>
                  <input value={val} onChange={e=>set(e.target.value)}
                    style={{width:'100%',padding:'4px 6px',border:'1.5px solid #dce3ea',
                      borderRadius:6,fontSize:'0.74rem',boxSizing:'border-box'}}/>
                </div>
              ))}

            <div style={{fontWeight:700,color:'#1a3a5c',fontSize:'0.72rem',borderBottom:'1px solid #eee',paddingBottom:4,marginTop:4}}>
              \ud83d\uddfa Fond de carte
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:3}}>
              {FONDS_EXPORT.map(f=>(
                <label key={f.id} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',
                  padding:'3px 6px',borderRadius:6,background:fond===f.id?'#eaf4fb':'transparent',
                  border:'1px solid '+(fond===f.id?'#aed6f1':'transparent')}}>
                  <input type="radio" name="fond" value={f.id}
                    checked={fond===f.id} onChange={()=>setFond(f.id)}
                    style={{accentColor:'#1a5276'}}/>
                  <span style={{fontSize:'0.74rem'}}>{f.label}</span>
                </label>
              ))}
            </div>

            <div style={{display:'flex',alignItems:'center',gap:7,marginTop:2}}>
              <input type="checkbox" id="grille" checked={grille} onChange={e=>setGrille(e.target.checked)}/>
              <label htmlFor="grille" style={{fontSize:'0.74rem'}}>Grille coordonn\u00e9es</label>
            </div>

            {msg && (
              <div style={{padding:'6px 8px',background:'#eaf4fb',borderRadius:6,
                fontSize:'0.7rem',color:'#1a5276',lineHeight:1.5,marginTop:2}}>{msg}</div>
            )}

            <div style={{borderTop:'1px solid #eee',paddingTop:10,marginTop:4}}>
              <div style={{fontWeight:700,color:'#1a3a5c',fontSize:'0.72rem',marginBottom:8}}>\ud83d\udce4 Export</div>
              <button onClick={()=>generer('png')} disabled={loading}
                style={{display:'block',width:'100%',marginBottom:7,padding:'8px',
                  background:'#1a5276',color:'white',border:'none',borderRadius:7,
                  cursor:loading?'not-allowed':'pointer',fontWeight:700,fontSize:'0.78rem',
                  opacity:loading?0.6:1}}>
                {loading?'\u23f3...':'\ud83d\uddbc\ufe0f PNG HD'}
              </button>
              <button onClick={()=>generer('pdf')} disabled={loading}
                style={{display:'block',width:'100%',padding:'8px',
                  background:'#27ae60',color:'white',border:'none',borderRadius:7,
                  cursor:loading?'not-allowed':'pointer',fontWeight:700,fontSize:'0.78rem',
                  opacity:loading?0.6:1}}>
                {loading?'\u23f3...':'\ud83d\udcc4 PDF A4'}
              </button>
            </div>

            <div style={{fontSize:'0.66rem',color:'#999',lineHeight:1.7,marginTop:2}}>
              PNG 2x HD | PDF A4 paysage<br/>
              La carte est ajustable avant export<br/>
              Projection\u00a0: WGS\u00a084
            </div>
          </div>

          {/* ── Apercu mise en page ── */}
          <div style={{flex:1,overflowY:'auto',background:'#d5dce5',padding:14,
            display:'flex',justifyContent:'center',alignItems:'flex-start'}}>

            {/* Layout A4 paysage */}
            <div ref={layoutRef}
              style={{width:860,background:'white',border:'2px solid #1a3a5c',
                fontFamily:'Arial,sans-serif',flexShrink:0}}>

              {/* Bandeau titre */}
              <div style={{background:'linear-gradient(135deg,#1a3a5c,#1a5276)',color:'white',
                padding:'9px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700}}>{titre}</div>
                  {sousTitre && <div style={{fontSize:9,opacity:0.8,marginTop:1}}>{sousTitre}</div>}
                </div>
                <div style={{fontSize:9,opacity:0.75}}>\ud83c\uddf8\ud83c\uddf3 S\u00e9n\u00e9gal | {dateStr()}</div>
              </div>

              {/* Corps */}
              <div style={{display:'flex',height:440}}>

                {/* Zone carte jumelle */}
                <div className="zone-carte-export"
                  style={{flex:1,margin:'6px 4px 6px 6px',border:'1px solid #bbb',
                    position:'relative',overflow:'hidden',background:'#dce7f0'}}>

                  {/* Carte Leaflet jumelle */}
                  <div className="carte-export-jumelle" style={{position:'absolute',inset:0}}>
                    <CarteJumelle
                      geoData={geoData}
                      featRegion={featRegion} featDep={featDep}
                      featArr={featArr}       featCommune={featCommune}
                      geojsonThematiques={geojsonThematiques||{}}
                      couchesActives={couchesActives||[]}
                      catalogue={catalogue||[]}
                      couleurCommune={couleurCommune||'#e74c3c'}
                      fond={fond}
                      zoneActive={zoneActive}
                      mapExportRef={mapExportRef}
                    />
                  </div>

                  {/* Overlays sur la carte */}
                  {grille && (
                    <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:500,
                      backgroundImage:'linear-gradient(rgba(0,0,0,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.07) 1px,transparent 1px)',
                      backgroundSize:'50px 50px'}}/>
                  )}
                  <div style={{position:'absolute',top:6,right:6,zIndex:600,pointerEvents:'none'}}>
                    <FlecheNord size={34}/>
                  </div>
                  <div style={{position:'absolute',bottom:6,left:6,zIndex:600,pointerEvents:'none'}}>
                    <BarreEchelle zoom={7}/>
                  </div>
                  {nomZone !== 'S\u00e9n\u00e9gal' && (
                    <div style={{position:'absolute',top:6,left:6,zIndex:600,pointerEvents:'none',
                      background:'rgba(26,58,92,0.85)',color:'white',
                      padding:'3px 9px',borderRadius:10,fontSize:10,fontWeight:700}}>
                      \ud83d\udccd {nomZone}
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <div style={{width:152,margin:'6px 6px 6px 4px',display:'flex',flexDirection:'column',gap:5}}>

                  <div style={{border:'1.5px solid #1a3a5c',borderRadius:4,overflow:'hidden'}}>
                    <div style={{background:'#1a3a5c',color:'white',fontSize:7,
                      fontWeight:700,padding:'3px 5px',letterSpacing:0.4}}>LOCALISATION \u2014 S\u00c9N\u00c9GAL</div>
                    <div style={{padding:3,background:'#f8fbfd'}}>
                      <CartoucheSVG
                        titre={featRegion?.properties?._nom||''}
                        polygonesFond={polysSenegal} polygonesMis={polysRegion}/>
                    </div>
                  </div>

                  {(featDep||featArr||featCommune) && (
                    <div style={{border:'1.5px solid #1a3a5c',borderRadius:4,overflow:'hidden'}}>
                      <div style={{background:'#1a3a5c',color:'white',fontSize:7,
                        fontWeight:700,padding:'3px 5px',letterSpacing:0.4}}>
                        LOCALISATION \u2014 {featRegion?.properties?._nom?.toUpperCase()||'R\u00c9GION'}
                      </div>
                      <div style={{padding:3,background:'#f8fbfd'}}>
                        <CartoucheSVG
                          titre={nomZone}
                          polygonesFond={polysFondReg} polygonesMis={polysMis}/>
                      </div>
                    </div>
                  )}

                  <div style={{border:'1.5px solid #1a3a5c',borderRadius:4,overflow:'hidden',flex:1}}>
                    <div style={{background:'#1a3a5c',color:'white',fontSize:7,
                      fontWeight:700,padding:'3px 5px',letterSpacing:0.4}}>L\u00c9GENDE</div>
                    <div style={{padding:'5px 7px',fontSize:7.5,lineHeight:2}}>
                      {[
                        {c:'#bdc3c7',b:'#7f8c8d',l:'Limite r\u00e9gionale'},
                        {c:'#bdc3c7',b:'#1a5276',l:'Limite d\u00e9partementale'},
                        {c:'#fadbd8',b:'#e74c3c',l:'Limite communale'},
                        {c:'#2471a3',b:'#1a5276',l:'Zone s\u00e9lectionn\u00e9e',bold:true},
                      ].map((item,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:5}}>
                          <div style={{width:15,height:8,flexShrink:0,
                            background:item.c,border:`1.5px solid ${item.b}`}}/>
                          <span style={{fontWeight:item.bold?700:400}}>{item.l}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{border:'1px solid #ccc',borderRadius:4,padding:'4px 6px',
                    fontSize:7,color:'#444',lineHeight:1.8}}>
                    <div><b>Projection\u00a0:</b> WGS\u00a084</div>
                    <div><b>Datum\u00a0:</b> WGS\u00a01984</div>
                    <div><b>Date\u00a0:</b> {dateStr()}</div>
                  </div>
                </div>
              </div>

              {/* Pied de page */}
              <div style={{borderTop:'2px solid #1a3a5c',background:'#f8fbfd',
                padding:'5px 16px',display:'flex',justifyContent:'space-between',
                alignItems:'center',fontSize:7.5,color:'#555'}}>
                <span>\ud83d\udcca <b>Source\u00a0:</b> {source}</span>
                <span style={{color:'#1a3a5c',fontWeight:700}}>Carto-facileSN</span>
                <span>R\u00e9alis\u00e9 le {dateStr()} | WGS\u00a084</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
