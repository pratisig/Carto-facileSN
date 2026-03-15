/**
 * ExportCarteModal — mise en page cartographique professionnelle
 * Capture la VRAIE carte Leaflet via html2canvas
 */
import React, { useRef, useState, useCallback } from 'react';

const MOIS = ['Jan','F\u00e9v','Mar','Avr','Mai','Juin','Jul','Ao\u00fb','Sep','Oct','Nov','D\u00e9c'];
function dateStr() {
  const d = new Date();
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Cartouche de localisation SVG ─────────────────────────────────────────────
function CartoucheSVG({ titre, polygonesFond, polygonesMis, width=160, height=120 }) {
  if (!polygonesFond?.length) return (
    <svg width={width} height={height} style={{border:'1px solid #aaa',background:'#f0f0f0'}}>
      <text x={width/2} y={height/2} textAnchor="middle" fontSize="10" fill="#888">Pas de donn\u00e9es</text>
    </svg>
  );
  const allPts = polygonesFond.flat();
  const lngs = allPts.map(p=>p[0]); const lats = allPts.map(p=>p[1]);
  const minLng=Math.min(...lngs), maxLng=Math.max(...lngs);
  const minLat=Math.min(...lats), maxLat=Math.max(...lats);
  const pad=8;
  const scaleX=(width-2*pad)/(maxLng-minLng||1);
  const scaleY=(height-2*pad)/(maxLat-minLat||1);
  const scale=Math.min(scaleX,scaleY);
  const offX=pad+((width-2*pad)-(maxLng-minLng)*scale)/2;
  const offY=pad+((height-2*pad)-(maxLat-minLat)*scale)/2;
  const proj=([lng,lat])=>[offX+(lng-minLng)*scale, offY+(maxLat-lat)*scale];
  const toPath=ring=>ring.map((pt,i)=>{ const [x,y]=proj(pt); return `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ')+' Z';
  return (
    <svg width={width} height={height} style={{border:'1.5px solid #7f8c8d',background:'#dce7f0',borderRadius:3}}>
      {polygonesFond.map((ring,i)=>(<path key={`f${i}`} d={toPath(ring)} fill="#bdc3c7" stroke="#7f8c8d" strokeWidth="0.8" />))}
      {(polygonesMis||[]).map((ring,i)=>(<path key={`m${i}`} d={toPath(ring)} fill="white" stroke="#2c3e50" strokeWidth="1.5" />))}
      {titre&&<text x="4" y={height-5} fontSize="8" fill="#1a3a5c" fontWeight="bold">{titre}</text>}
    </svg>
  );
}

function extractRings(feature) {
  if (!feature?.geometry) return [];
  const g = feature.geometry;
  if (g.type==='Polygon') return g.coordinates;
  if (g.type==='MultiPolygon') return g.coordinates.flat();
  return [];
}

function FlecheNord({size=36}) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <polygon points="18,2 23,18 18,14 13,18" fill="#1a3a5c" />
      <polygon points="18,34 23,18 18,22 13,18" fill="#bdc3c7" stroke="#1a3a5c" strokeWidth="0.5" />
      <text x="18" y="11" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">N</text>
    </svg>
  );
}

function BarreEchelle({zoom=7}) {
  const km = zoom<=7?200:zoom<=9?50:zoom<=11?20:5;
  return (
    <svg width="110" height="22">
      <rect x="5" y="10" width="90" height="5" fill="white" stroke="#333" strokeWidth="1"/>
      <rect x="5" y="10" width="45" height="5" fill="#333"/>
      <text x="5" y="22" fontSize="8" fill="#333">0</text>
      <text x="47" y="22" fontSize="8" fill="#333">{km/2} km</text>
      <text x="90" y="22" fontSize="8" fill="#333">{km} km</text>
    </svg>
  );
}

export default function ExportCarteModal({
  onClose, featRegion, featDep, featArr, featCommune, geoData, titre: titreProp, sousTitre: sousTitreProp,
}) {
  const layoutRef = useRef(null);
  const [titre,     setTitre]     = useState(titreProp     || 'Carte administrative du S\u00e9n\u00e9gal');
  const [sousTitre, setSousTitre] = useState(sousTitreProp || '');
  const [source,    setSource]    = useState('OCHA/ANSD \u2013 Limites administratives S\u00e9n\u00e9gal');
  const [grille,    setGrille]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [carteImg,  setCarteImg]  = useState(null); // capture de la carte Leaflet

  const zoneActive = featCommune || featArr || featDep || featRegion;
  const nomZone    = zoneActive?.properties?._nom || 'S\u00e9n\u00e9gal';

  const polysSenegal = (geoData?.regions?.features||[]).map(f=>extractRings(f)).flat();
  const polysRegion  = featRegion ? extractRings(featRegion) : [];
  const polysFondReg = polysRegion.length ? polysRegion : polysSenegal;
  const polysMis     = zoneActive && zoneActive!==featRegion ? extractRings(zoneActive) : [];

  // Capture la carte Leaflet dans le DOM
  const capturerCarte = useCallback(async () => {
    const { default: html2canvas } = await import('html2canvas');
    // Le MapContainer Leaflet est dans .carte-wrapper
    const mapEl = document.querySelector('.carte-wrapper .leaflet-container');
    if (!mapEl) return null;
    const canvas = await html2canvas(mapEl, {
      scale: 1.5, useCORS: true, allowTaint: true, logging: false,
      backgroundColor: '#dce7f0',
    });
    return canvas.toDataURL('image/png');
  }, []);

  const generer = useCallback(async (format) => {
    setLoading(true);
    try {
      // 1. Capturer la carte Leaflet
      const imgCarte = await capturerCarte();
      setCarteImg(imgCarte);

      // Petite pause pour que React mette a jour le DOM avec l'image
      await new Promise(r => setTimeout(r, 400));

      // 2. Capturer le layout complet
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(layoutRef.current, {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: '#ffffff', logging: false,
      });
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
    } catch(e) {
      alert('Erreur export: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [capturerCarte, nomZone]);

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:9999,
      display:'flex',alignItems:'center',justifyContent:'center',padding:12}}>
      <div style={{background:'white',borderRadius:10,width:'97vw',maxWidth:1080,
        maxHeight:'95vh',display:'flex',flexDirection:'column',
        boxShadow:'0 8px 40px rgba(0,0,0,0.4)',overflow:'hidden'}}>

        {/* En-tete */}
        <div style={{background:'linear-gradient(135deg,#1a3a5c,#1a5276)',color:'white',
          padding:'10px 18px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontWeight:700}}>\ud83d\udcc4 Mise en page \u2014 Export Carte</span>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.15)',border:'none',
            color:'white',borderRadius:6,padding:'4px 12px',cursor:'pointer'}}>\u2715 Fermer</button>
        </div>

        <div style={{display:'flex',flex:1,overflow:'hidden'}}>
          {/* Options */}
          <div style={{width:210,flexShrink:0,padding:'14px 12px',borderRight:'1px solid #eee',
            overflowY:'auto',fontSize:'0.82rem'}}>
            <b style={{color:'#1a3a5c'}}>Param\u00e8tres</b>
            {[['Titre',titre,setTitre],['Sous-titre',sousTitre,setSousTitre],['Source',source,setSource]]
              .map(([lbl,val,set])=>(
                <div key={lbl} style={{marginTop:10}}>
                  <label style={{display:'block',marginBottom:3,color:'#555',fontWeight:600}}>{lbl}</label>
                  <input value={val} onChange={e=>set(e.target.value)}
                    style={{width:'100%',padding:'5px 7px',border:'1.5px solid #dce3ea',
                      borderRadius:6,fontSize:'0.78rem'}}/>
                </div>
              ))}
            <div style={{marginTop:10,display:'flex',alignItems:'center',gap:7}}>
              <input type="checkbox" id="grille" checked={grille} onChange={e=>setGrille(e.target.checked)}/>
              <label htmlFor="grille">Grille coord.</label>
            </div>
            <div style={{marginTop:18,borderTop:'1px solid #eee',paddingTop:12}}>
              <b style={{color:'#1a3a5c'}}>Export</b>
              <button onClick={()=>generer('png')} disabled={loading}
                style={{display:'block',width:'100%',marginTop:10,padding:'8px',
                  background:'#1a5276',color:'white',border:'none',borderRadius:7,
                  cursor:'pointer',fontWeight:700}}>
                {loading?'\u23f3...':'\ud83d\uddbc\ufe0f PNG HD'}
              </button>
              <button onClick={()=>generer('pdf')} disabled={loading}
                style={{display:'block',width:'100%',marginTop:7,padding:'8px',
                  background:'#27ae60',color:'white',border:'none',borderRadius:7,
                  cursor:'pointer',fontWeight:700}}>
                {loading?'\u23f3...':'\ud83d\udcc4 PDF A4'}
              </button>
            </div>
            <div style={{marginTop:12,fontSize:'0.7rem',color:'#888',lineHeight:1.6}}>
              PNG : 2x HD | PDF : A4 paysage<br/>Projection : WGS 84
            </div>
          </div>

          {/* Apercu */}
          <div style={{flex:1,overflowY:'auto',background:'#e0e5ea',padding:14,
            display:'flex',justifyContent:'center',alignItems:'flex-start'}}>
            <div ref={layoutRef} style={{width:860,background:'white',
              border:'2px solid #1a3a5c',fontFamily:'Arial,sans-serif',
              transform:'scale(0.75)',transformOrigin:'top left',marginBottom:-200}}>

              {/* Bandeau titre */}
              <div style={{background:'linear-gradient(135deg,#1a3a5c,#1a5276)',color:'white',
                padding:'9px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:17,fontWeight:700}}>{titre}</div>
                  {sousTitre&&<div style={{fontSize:10,opacity:0.8,marginTop:1}}>{sousTitre}</div>}
                </div>
                <div style={{fontSize:10,opacity:0.75,textAlign:'right'}}>
                  \ud83c\uddf8\ud83c\uddf3 S\u00e9n\u00e9gal | {dateStr()}
                </div>
              </div>

              {/* Corps */}
              <div style={{display:'flex'}}>

                {/* Carte */}
                <div style={{flex:1,minHeight:460,margin:8,marginRight:0,
                  border:'1px solid #aaa',position:'relative',overflow:'hidden',
                  background:'#dce7f0'}}>
                  {carteImg
                    ? <img src={carteImg} alt="carte" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : (<div style={{display:'flex',alignItems:'center',justifyContent:'center',
                        height:'100%',color:'#7f8c8d',flexDirection:'column',gap:6}}>
                        <div style={{fontSize:28}}>\ud83d\uddfa\ufe0f</div>
                        <div style={{fontSize:11}}>Cliquez sur PNG/PDF pour capturer la carte</div>
                      </div>)
                  }
                  {grille&&<div style={{position:'absolute',inset:0,pointerEvents:'none',
                    backgroundImage:'linear-gradient(rgba(0,0,0,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.08) 1px,transparent 1px)',
                    backgroundSize:'50px 50px'}}/>}
                  <div style={{position:'absolute',top:8,right:8}}><FlecheNord size={38}/></div>
                  <div style={{position:'absolute',bottom:8,left:8}}><BarreEchelle zoom={7}/></div>
                  {nomZone!=='S\u00e9n\u00e9gal'&&<div style={{position:'absolute',top:8,left:8,
                    background:'rgba(26,58,92,0.85)',color:'white',padding:'3px 9px',
                    borderRadius:10,fontSize:10,fontWeight:700}}>\ud83d\udccd {nomZone}</div>}
                </div>

                {/* Sidebar mise en page */}
                <div style={{width:160,margin:8,marginLeft:6,display:'flex',flexDirection:'column',gap:7}}>

                  {/* Cartouche 1 : Senegal */}
                  <div style={{border:'1.5px solid #1a3a5c',borderRadius:4,overflow:'hidden'}}>
                    <div style={{background:'#1a3a5c',color:'white',fontSize:7,fontWeight:700,
                      padding:'3px 5px',letterSpacing:0.4}}>LOCALISATION \u2014 S\u00c9N\u00c9GAL</div>
                    <div style={{padding:3,background:'#f8fbfd'}}>
                      <CartoucheSVG
                        titre={featRegion?.properties?._nom||''}
                        polygonesFond={polysSenegal} polygonesMis={polysRegion}
                        width={152} height={105}/>
                    </div>
                  </div>

                  {/* Cartouche 2 : Region */}
                  {(featDep||featArr||featCommune) && (
                    <div style={{border:'1.5px solid #1a3a5c',borderRadius:4,overflow:'hidden'}}>
                      <div style={{background:'#1a3a5c',color:'white',fontSize:7,fontWeight:700,
                        padding:'3px 5px',letterSpacing:0.4}}>
                        LOCALISATION \u2014 {featRegion?.properties?._nom?.toUpperCase()||'R\u00c9GION'}
                      </div>
                      <div style={{padding:3,background:'#f8fbfd'}}>
                        <CartoucheSVG
                          titre={nomZone}
                          polygonesFond={polysFondReg} polygonesMis={polysMis}
                          width={152} height={105}/>
                      </div>
                    </div>
                  )}

                  {/* Legende */}
                  <div style={{border:'1.5px solid #1a3a5c',borderRadius:4,overflow:'hidden',flex:1}}>
                    <div style={{background:'#1a3a5c',color:'white',fontSize:7,fontWeight:700,
                      padding:'3px 5px',letterSpacing:0.4}}>L\u00c9GENDE</div>
                    <div style={{padding:'5px 7px',fontSize:8,lineHeight:1.9}}>
                      {[
                        {c:'#bdc3c7',b:'#7f8c8d',l:'Limite r\u00e9gionale'},
                        {c:'#bdc3c7',b:'#1a5276',l:'Limite d\u00e9partementale'},
                        {c:'#fadbd8',b:'#e74c3c',l:'Limite communale'},
                        {c:'#2471a3',b:'#1a5276',l:'Zone s\u00e9lectionn\u00e9e',bold:true},
                      ].map((item,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:5}}>
                          <div style={{width:16,height:9,flexShrink:0,
                            background:item.c,border:`1.5px solid ${item.b}`}}/>
                          <span style={{fontWeight:item.bold?700:400}}>{item.l}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Projection */}
                  <div style={{border:'1px solid #ccc',borderRadius:4,padding:'4px 6px',
                    fontSize:7.5,color:'#444',lineHeight:1.7}}>
                    <div><b>Projection :</b> WGS 84</div>
                    <div><b>Datum :</b> WGS 1984</div>
                    <div><b>Date :</b> {dateStr()}</div>
                  </div>
                </div>
              </div>

              {/* Pied de page */}
              <div style={{borderTop:'2px solid #1a3a5c',background:'#f8fbfd',
                padding:'5px 16px',display:'flex',justifyContent:'space-between',
                alignItems:'center',fontSize:8.5,color:'#555'}}>
                <div>\ud83d\udcca <b>Source :</b> {source}</div>
                <div style={{color:'#1a3a5c',fontWeight:700}}>Carto-facileSN</div>
                <div>R\u00e9alis\u00e9 le {dateStr()} | WGS 84</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
