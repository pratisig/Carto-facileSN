/**
 * ExportCarteModal v3
 * - Capture Leaflet avec html2canvas APRES zoom sur la zone
 * - Leaflet tiles: crossOrigin force, attente tiles avant capture
 * - Export PNG/PDF A4 paysage
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';

const MOIS = ['Jan','F\u00e9v','Mar','Avr','Mai','Juin','Jul','Ao\u00fb','Sep','Oct','Nov','D\u00e9c'];
function dateStr() {
  const d = new Date();
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

function CartoucheSVG({ titre, polygonesFond, polygonesMis, width=152, height=100 }) {
  if (!polygonesFond?.length) return (
    <svg width={width} height={height} style={{border:'1px solid #aaa',background:'#f5f5f5'}}>
      <text x={width/2} y={height/2} textAnchor="middle" fontSize="9" fill="#aaa">Pas de données</text>
    </svg>
  );
  const allPts = polygonesFond.flat();
  const lngs = allPts.map(p=>p[0]), lats = allPts.map(p=>p[1]);
  const [mn,mx,ml,mxl] = [Math.min(...lats),Math.max(...lats),Math.min(...lngs),Math.max(...lngs)];
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

function FlecheNord({size=36}) {
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

// Attendre que toutes les tuiles soient chargees
function waitTiles(mapEl, maxWait=4000) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const check = () => {
      const loading = mapEl.querySelectorAll('img.leaflet-tile:not([src=""])')
        .length === 0 ||
        [...mapEl.querySelectorAll('img.leaflet-tile')]
        .every(img => img.complete);
      if (loading || Date.now()-t0 > maxWait) resolve();
      else setTimeout(check, 200);
    };
    setTimeout(check, 500);
  });
}

export default function ExportCarteModal({
  onClose, featRegion, featDep, featArr, featCommune, geoData,
  titre: titreProp, sousTitre: sousTitreProp,
}) {
  const layoutRef = useRef(null);
  const [titre,    setTitre]    = useState(titreProp     || 'Carte administrative du S\u00e9n\u00e9gal');
  const [sousTitre,setSousTitre]= useState(sousTitreProp || '');
  const [source,   setSource]   = useState('OCHA/ANSD \u2013 Limites administratives S\u00e9n\u00e9gal');
  const [grille,   setGrille]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [carteImg, setCarteImg] = useState(null);
  const [msg,      setMsg]      = useState('');

  const zoneActive = featCommune || featArr || featDep || featRegion;
  const nomZone    = zoneActive?.properties?._nom || 'S\u00e9n\u00e9gal';

  const polysSenegal = (geoData?.regions?.features||[]).map(f=>extractRings(f)).flat();
  const polysRegion  = featRegion ? extractRings(featRegion) : [];
  const polysFondReg = polysRegion.length ? polysRegion : polysSenegal;
  const polysMis     = zoneActive && zoneActive!==featRegion ? extractRings(zoneActive) : [];

  // Capturer la vraie carte Leaflet
  const capturerCarte = useCallback(async () => {
    const { default: html2canvas } = await import('html2canvas');
    const mapEl = document.querySelector('.carte-wrapper .leaflet-container');
    if (!mapEl) { setMsg('Carte Leaflet introuvable'); return null; }

    setMsg('Attente du fond de carte...');
    await waitTiles(mapEl);
    setMsg('Capture en cours...');

    // Forcer crossOrigin sur toutes les tuiles OSM
    mapEl.querySelectorAll('img.leaflet-tile').forEach(img => {
      if (!img.crossOrigin) {
        img.crossOrigin = 'anonymous';
      }
    });
    // Courte pause pour que les tuiles se rechargent avec CORS
    await new Promise(r => setTimeout(r, 800));

    try {
      const canvas = await html2canvas(mapEl, {
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#dce7f0',
        // ignorer les tuiles OSM qui bloquent si CORS echoue
        ignoreElements: el => el.tagName==='IMG' && el.classList.contains('leaflet-tile') && !el.complete,
      });
      return canvas.toDataURL('image/png');
    } catch(e) {
      setMsg('Fond de carte bloque par CORS \u2014 export sans fond...');
      // Capturer sans les tuiles (les GeoJSON seuls)
      mapEl.querySelectorAll('.leaflet-tile-pane').forEach(el => el.style.display='none');
      await new Promise(r => setTimeout(r, 200));
      const canvas = await html2canvas(mapEl, {
        scale: 1.5, useCORS: true, allowTaint: true,
        logging: false, backgroundColor: '#dce7f0',
      });
      mapEl.querySelectorAll('.leaflet-tile-pane').forEach(el => el.style.display='');
      return canvas.toDataURL('image/png');
    }
  }, []);

  const generer = useCallback(async (format) => {
    setLoading(true);
    setMsg('Préparation...');
    try {
      const img = await capturerCarte();
      if (img) {
        setCarteImg(img);
        setMsg('Composition mise en page...');
        await new Promise(r => setTimeout(r, 600));
      }

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
      setMsg('✅ Export terminé !');
    } catch(e) {
      setMsg('\u274c Erreur: ' + e.message);
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

        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#1a3a5c,#1a5276)',color:'white',
          padding:'10px 18px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontWeight:700}}>📄 Mise en page — Export Carte</span>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.15)',border:'none',
            color:'white',borderRadius:6,padding:'4px 12px',cursor:'pointer'}}>× Fermer</button>
        </div>

        <div style={{display:'flex',flex:1,overflow:'hidden'}}>
          {/* Options */}
          <div style={{width:215,flexShrink:0,padding:'14px 12px',borderRight:'1px solid #eee',
            overflowY:'auto',fontSize:'0.82rem'}}>
            <b style={{color:'#1a3a5c'}}>Paramètres</b>
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

            {msg && <div style={{marginTop:10,padding:'6px 8px',background:'#eaf4fb',
              borderRadius:6,fontSize:'0.72rem',color:'#1a5276',lineHeight:1.5}}>{msg}</div>}

            <div style={{marginTop:18,borderTop:'1px solid #eee',paddingTop:12}}>
              <b style={{color:'#1a3a5c'}}>Export</b>
              <button onClick={()=>generer('png')} disabled={loading}
                style={{display:'block',width:'100%',marginTop:10,padding:'8px',
                  background:'#1a5276',color:'white',border:'none',borderRadius:7,
                  cursor:'pointer',fontWeight:700,opacity:loading?0.6:1}}>
                {loading?'⏳...' : '🖼️ PNG HD'}
              </button>
              <button onClick={()=>generer('pdf')} disabled={loading}
                style={{display:'block',width:'100%',marginTop:7,padding:'8px',
                  background:'#27ae60',color:'white',border:'none',borderRadius:7,
                  cursor:'pointer',fontWeight:700,opacity:loading?0.6:1}}>
                {loading?'⏳...' : '📄 PDF A4'}
              </button>
            </div>
            <div style={{marginTop:12,fontSize:'0.7rem',color:'#888',lineHeight:1.6}}>
              PNG 2x HD | PDF A4 paysage<br/>Projection : WGS 84
            </div>
          </div>

          {/* Apercu mise en page */}
          <div style={{flex:1,overflowY:'auto',background:'#e0e5ea',padding:14,
            display:'flex',justifyContent:'center'}}>
            <div ref={layoutRef} style={{width:850,background:'white',
              border:'2px solid #1a3a5c',fontFamily:'Arial,sans-serif'}}>

              {/* Bandeau titre */}
              <div style={{background:'linear-gradient(135deg,#1a3a5c,#1a5276)',color:'white',
                padding:'9px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700}}>{titre}</div>
                  {sousTitre&&<div style={{fontSize:10,opacity:0.8,marginTop:1}}>{sousTitre}</div>}
                </div>
                <div style={{fontSize:10,opacity:0.75}}>🇸🇳 Sénégal | {dateStr()}</div>
              </div>

              {/* Corps */}
              <div style={{display:'flex',minHeight:400}}>
                {/* Zone carte */}
                <div style={{flex:1,margin:8,marginRight:4,border:'1px solid #bbb',
                  position:'relative',overflow:'hidden',background:'#dce7f0',minHeight:380}}>
                  {carteImg
                    ? <img src={carteImg} alt="carte"
                        style={{width:'100%',height:'100%',objectFit:'fill',display:'block'}}/>
                    : <div style={{display:'flex',alignItems:'center',justifyContent:'center',
                        height:380,flexDirection:'column',gap:8,color:'#7f8c8d'}}>
                        <div style={{fontSize:32}}>🗺️</div>
                        <div style={{fontSize:11,textAlign:'center'}}>
                          Cliquez « PNG HD » ou « PDF A4 »<br/>pour capturer la carte
                        </div>
                      </div>
                  }
                  {grille&&<div style={{position:'absolute',inset:0,pointerEvents:'none',
                    backgroundImage:'linear-gradient(rgba(0,0,0,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.07) 1px,transparent 1px)',
                    backgroundSize:'50px 50px'}}/>}
                  <div style={{position:'absolute',top:6,right:6}}><FlecheNord size={36}/></div>
                  <div style={{position:'absolute',bottom:6,left:6}}><BarreEchelle zoom={7}/></div>
                  {nomZone!=='Sénégal'&&(
                    <div style={{position:'absolute',top:6,left:6,
                      background:'rgba(26,58,92,0.85)',color:'white',
                      padding:'3px 9px',borderRadius:10,fontSize:10,fontWeight:700}}>
                      📍 {nomZone}
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <div style={{width:155,margin:8,marginLeft:4,display:'flex',flexDirection:'column',gap:6}}>

                  {/* Cartouche 1 : Sénégal */}
                  <div style={{border:'1.5px solid #1a3a5c',borderRadius:4,overflow:'hidden'}}>
                    <div style={{background:'#1a3a5c',color:'white',fontSize:7,
                      fontWeight:700,padding:'3px 5px',letterSpacing:0.4}}>LOCALISATION — SÉNÉGAL</div>
                    <div style={{padding:3,background:'#f8fbfd'}}>
                      <CartoucheSVG
                        titre={featRegion?.properties?._nom||''}
                        polygonesFond={polysSenegal} polygonesMis={polysRegion}/>
                    </div>
                  </div>

                  {/* Cartouche 2 : Région */}
                  {(featDep||featArr||featCommune) && (
                    <div style={{border:'1.5px solid #1a3a5c',borderRadius:4,overflow:'hidden'}}>
                      <div style={{background:'#1a3a5c',color:'white',fontSize:7,
                        fontWeight:700,padding:'3px 5px',letterSpacing:0.4}}>
                        LOCALISATION — {featRegion?.properties?._nom?.toUpperCase()||'RÉGION'}
                      </div>
                      <div style={{padding:3,background:'#f8fbfd'}}>
                        <CartoucheSVG
                          titre={nomZone}
                          polygonesFond={polysFondReg} polygonesMis={polysMis}/>
                      </div>
                    </div>
                  )}

                  {/* Légende */}
                  <div style={{border:'1.5px solid #1a3a5c',borderRadius:4,overflow:'hidden',flex:1}}>
                    <div style={{background:'#1a3a5c',color:'white',fontSize:7,
                      fontWeight:700,padding:'3px 5px',letterSpacing:0.4}}>LÉGENDE</div>
                    <div style={{padding:'5px 7px',fontSize:8,lineHeight:2}}>
                      {[
                        {c:'#bdc3c7',b:'#7f8c8d',l:'Limite régionale'},
                        {c:'#bdc3c7',b:'#1a5276',l:'Limite départementale'},
                        {c:'#fadbd8',b:'#e74c3c',l:'Limite communale'},
                        {c:'#2471a3',b:'#1a5276',l:'Zone sélectionnée',bold:true},
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
                alignItems:'center',fontSize:8,color:'#555'}}>
                <span>📊 <b>Source :</b> {source}</span>
                <span style={{color:'#1a3a5c',fontWeight:700}}>Carto-facileSN</span>
                <span>Réalisé le {dateStr()} | WGS 84</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
