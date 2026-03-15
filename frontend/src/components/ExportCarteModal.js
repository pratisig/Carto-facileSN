/**
 * ExportCarteModal.js
 * Génère une image PNG / PDF avec mise en page cartographique professionnelle :
 *   - Carte principale (capture du MapContainer Leaflet)
 *   - Cartouche localisation Sénégal (pays gris, région en blanc)
 *   - Cartouche localisation Région (région grise, zone sélectionnée en blanc)
 *   - Titre, sous-titre, légende, échelle, flèche Nord, projection, date, source
 *
 * Dépendances : html2canvas, jspdf  (npm install html2canvas jspdf)
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Juin','Jul','Aoû','Sep','Oct','Nov','Déc'];
function dateStr() {
  const d = new Date();
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Dessin d'un cartouche de localisation SVG ──────────────────────────────
// polygones simplifiés passés comme tableaux [[lng,lat],…]
function CartoucheSVG({ titre, polygonesFond, polygonesMis, width = 160, height = 120 }) {
  if (!polygonesFond?.length) return (
    <svg width={width} height={height} style={{ border: '1px solid #aaa', background: '#f8f8f8' }}>
      <text x={width/2} y={height/2} textAnchor="middle" fontSize="10" fill="#888">{titre || 'Localisation'}</text>
    </svg>
  );

  // Projection simple (plate-carrée) ajustée sur les polygonesFond
  const allPts = polygonesFond.flat();
  const lngs = allPts.map(p => p[0]); const lats = allPts.map(p => p[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const pad = 8;
  const scaleX = (width - 2*pad)  / (maxLng - minLng || 1);
  const scaleY = (height - 2*pad) / (maxLat - minLat || 1);
  const scale  = Math.min(scaleX, scaleY);
  const offX   = pad + ((width  - 2*pad) - (maxLng - minLng) * scale) / 2;
  const offY   = pad + ((height - 2*pad) - (maxLat - minLat) * scale) / 2;

  const proj = ([lng, lat]) => [
    offX + (lng - minLng) * scale,
    offY + (maxLat - lat) * scale,
  ];

  const toPath = (ring) => ring.map((pt, i) => {
    const [x, y] = proj(pt);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z';

  return (
    <svg width={width} height={height} style={{ border: '1.5px solid #7f8c8d', background: '#dce7f0', borderRadius: 3 }}>
      {/* Fond – polygones gris (pays ou région) */}
      {polygonesFond.map((ring, i) => (
        <path key={`f${i}`} d={toPath(ring)} fill="#bdc3c7" stroke="#7f8c8d" strokeWidth="0.8" />
      ))}
      {/* Mis en évidence – blanc */}
      {(polygonesMis || []).map((ring, i) => (
        <path key={`m${i}`} d={toPath(ring)} fill="white" stroke="#2c3e50" strokeWidth="1.2" />
      ))}
      {/* Titre */}
      {titre && (
        <text x="4" y={height - 5} fontSize="8" fill="#1a3a5c" fontWeight="bold">
          {titre}
        </text>
      )}
    </svg>
  );
}

// ── Extraire les anneaux de coordonnées d'un GeoJSON feature ───────────────
function extractRings(feature) {
  if (!feature?.geometry) return [];
  const g = feature.geometry;
  if (g.type === 'Polygon') return g.coordinates;
  if (g.type === 'MultiPolygon') return g.coordinates.flat();
  return [];
}

// ── Flèche Nord SVG ────────────────────────────────────────────────────────
function FlecheNord({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <polygon points="18,2 23,18 18,14 13,18" fill="#1a3a5c" />
      <polygon points="18,34 23,18 18,22 13,18" fill="#bdc3c7" stroke="#1a3a5c" strokeWidth="0.5" />
      <text x="18" y="11" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">N</text>
    </svg>
  );
}

// ── Barre d'échelle SVG ────────────────────────────────────────────────────
function BarreEchelle({ zoom = 7 }) {
  // Valeur indicative selon le zoom Leaflet
  const km = zoom <= 7 ? 200 : zoom <= 9 ? 50 : zoom <= 11 ? 20 : 5;
  return (
    <svg width="110" height="22" viewBox="0 0 110 22">
      <rect x="5" y="10" width="90" height="5" fill="white" stroke="#333" strokeWidth="1" />
      <rect x="5" y="10" width="45" height="5" fill="#333" />
      <text x="5" y="22" fontSize="8" fill="#333">0</text>
      <text x="47" y="22" fontSize="8" fill="#333">{km/2} km</text>
      <text x="90" y="22" fontSize="8" fill="#333">{km} km</text>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function ExportCarteModal({
  onClose,
  mapRef,           // ref vers le DOM du MapContainer
  featRegion,
  featDep,
  featArr,
  featCommune,
  geoData,
  titre: titreProp,
  sousTitre: sousTitreProp,
  source: sourceProp,
}) {
  const previewRef = useRef(null);
  const [titre,     setTitre]     = useState(titreProp     || 'Carte administrative du Sénégal');
  const [sousTitre, setSousTitre] = useState(sousTitreProp || '');
  const [source,    setSource]    = useState(sourceProp    || 'OCHA/ANSD – Limites administratives Sénégal');
  const [grille,    setGrille]    = useState(false);
  const [loading,   setLoading]   = useState(false);

  // Zone la plus précise sélectionnée
  const zoneActive = featCommune || featArr || featDep || featRegion;
  const nomZone    = zoneActive?.properties?._nom || 'Sénégal';

  // Polygones pour cartouche 1 : Sénégal (toutes régions) + région sélectionnée
  const polysSenegal = (geoData?.regions?.features || []).map(f => extractRings(f)).flat();
  const polysRegion  = featRegion ? extractRings(featRegion) : [];

  // Polygones pour cartouche 2 : région + zone précise
  const polysFondReg = featRegion ? extractRings(featRegion) : polysSenegal;
  const polysMis     = zoneActive && zoneActive !== featRegion ? extractRings(zoneActive) : [];

  // ── Capture + génération ──────────────────────────────────────────────────
  const generer = useCallback(async (format) => {
    setLoading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');

      if (format === 'png') {
        const a = document.createElement('a');
        a.href = imgData;
        a.download = `carto_${nomZone.replace(/ /g, '_')}_${Date.now()}.png`;
        a.click();
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const w = 297; const h = 210;
        pdf.addImage(imgData, 'PNG', 0, 0, w, h);
        pdf.save(`carto_${nomZone.replace(/ /g, '_')}_${Date.now()}.pdf`);
      }
    } catch (e) {
      alert('Erreur export : ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [nomZone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 10, width: '96vw', maxWidth: 1050,
        maxHeight: '95vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)', overflow: 'hidden',
      }}>
        {/* En-tête modal */}
        <div style={{
          background: 'linear-gradient(135deg,#1a3a5c,#1a5276)', color: 'white',
          padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>📄 Mise en page — Export Carte</span>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
            borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.85rem',
          }}>✕ Fermer</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── Panneau options ── */}
          <div style={{
            width: 220, flexShrink: 0, padding: '14px 14px',
            borderRight: '1px solid #eee', overflowY: 'auto', fontSize: '0.82rem',
          }}>
            <b style={{ color: '#1a3a5c' }}>Paramètres</b>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, color: '#555', fontWeight: 600 }}>Titre</label>
              <input value={titre} onChange={e => setTitre(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #dce3ea', borderRadius: 6, fontSize: '0.8rem' }} />
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: 'block', marginBottom: 4, color: '#555', fontWeight: 600 }}>Sous-titre</label>
              <input value={sousTitre} onChange={e => setSousTitre(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #dce3ea', borderRadius: 6, fontSize: '0.8rem' }} />
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: 'block', marginBottom: 4, color: '#555', fontWeight: 600 }}>Source</label>
              <input value={source} onChange={e => setSource(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #dce3ea', borderRadius: 6, fontSize: '0.8rem' }} />
            </div>

            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="grille" checked={grille} onChange={e => setGrille(e.target.checked)} />
              <label htmlFor="grille">Grille coordonnées</label>
            </div>

            <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 14 }}>
              <b style={{ color: '#1a3a5c' }}>Export</b>
              <button
                onClick={() => generer('png')}
                disabled={loading}
                style={{
                  display: 'block', width: '100%', marginTop: 10,
                  padding: '9px', background: '#1a5276', color: 'white',
                  border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                }}
              >
                {loading ? '⏳ Export...' : '🖼️ Télécharger PNG HD'}
              </button>
              <button
                onClick={() => generer('pdf')}
                disabled={loading}
                style={{
                  display: 'block', width: '100%', marginTop: 8,
                  padding: '9px', background: '#27ae60', color: 'white',
                  border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                }}
              >
                {loading ? '⏳ Export...' : '📄 Télécharger PDF A4'}
              </button>
            </div>

            <div style={{ marginTop: 14, fontSize: '0.72rem', color: '#888', lineHeight: 1.5 }}>
              Format PDF : A4 paysage<br/>
              Format PNG : 2× résolution (HD)<br/>
              Projection : WGS 84
            </div>
          </div>

          {/* ── Aperçu mise en page ── */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#e8ecf0', padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
            <div
              ref={previewRef}
              style={{
                width: 900, background: 'white',
                boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
                fontFamily: 'Arial, sans-serif',
                border: '2px solid #1a3a5c',
                display: 'flex', flexDirection: 'column',
                transformOrigin: 'top left',
                transform: 'scale(0.72)',
                marginBottom: -200,
              }}
            >
              {/* ── Bandeau titre ── */}
              <div style={{
                background: 'linear-gradient(135deg,#1a3a5c,#1a5276)',
                color: 'white', padding: '10px 18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>{titre || 'Carte'}</div>
                  {sousTitre && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{sousTitre}</div>}
                </div>
                <div style={{ fontSize: 11, opacity: 0.75, textAlign: 'right' }}>
                  🇸🇳 Sénégal<br/>{dateStr()}
                </div>
              </div>

              {/* ── Corps : carte + sidebar ── */}
              <div style={{ display: 'flex', flex: 1 }}>

                {/* Carte principale */}
                <div style={{
                  flex: 1, background: '#dce7f0', position: 'relative', minHeight: 480,
                  border: '1px solid #aaa', margin: 8, marginRight: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* Capture de la vraie carte sera injectée via html2canvas */}
                  <div style={{ color: '#7f8c8d', fontSize: 13, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🗺️</div>
                    <div>Carte Leaflet</div>
                    <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>Capturée lors de l'export</div>
                  </div>

                  {/* Grille coordonnées */}
                  {grille && (
                    <div style={{
                      position: 'absolute', inset: 0, pointerEvents: 'none',
                      backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px,transparent 1px), linear-gradient(90deg,rgba(0,0,0,0.1) 1px,transparent 1px)',
                      backgroundSize: '60px 60px',
                    }} />
                  )}

                  {/* Flèche Nord */}
                  <div style={{ position: 'absolute', top: 10, right: 10 }}>
                    <FlecheNord size={40} />
                  </div>

                  {/* Barre d'échelle */}
                  <div style={{ position: 'absolute', bottom: 10, left: 12 }}>
                    <BarreEchelle zoom={7} />
                  </div>

                  {/* Zone sélectionnée */}
                  {nomZone && nomZone !== 'Sénégal' && (
                    <div style={{
                      position: 'absolute', top: 10, left: 10,
                      background: 'rgba(26,58,92,0.85)', color: 'white',
                      padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                    }}>
                      📍 {nomZone}
                    </div>
                  )}
                </div>

                {/* Sidebar droite de la mise en page */}
                <div style={{
                  width: 168, flexShrink: 0, margin: 8, marginLeft: 6,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>

                  {/* Cartouche 1 : Localisation dans le Sénégal */}
                  <div style={{ border: '1.5px solid #1a3a5c', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      background: '#1a3a5c', color: 'white',
                      fontSize: 8, fontWeight: 700, padding: '3px 6px', letterSpacing: 0.5,
                    }}>LOCALISATION — SÉNÉGAL</div>
                    <div style={{ padding: 4, background: '#f8fbfd' }}>
                      <CartoucheSVG
                        titre={featRegion?.properties?._nom || ''}
                        polygonesFond={polysSenegal}
                        polygonesMis={polysRegion}
                        width={158} height={110}
                      />
                    </div>
                  </div>

                  {/* Cartouche 2 : Localisation dans la Région */}
                  {(featDep || featArr || featCommune) && (
                    <div style={{ border: '1.5px solid #1a3a5c', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        background: '#1a3a5c', color: 'white',
                        fontSize: 8, fontWeight: 700, padding: '3px 6px', letterSpacing: 0.5,
                      }}>LOCALISATION — {featRegion?.properties?._nom?.toUpperCase() || 'RÉGION'}</div>
                      <div style={{ padding: 4, background: '#f8fbfd' }}>
                        <CartoucheSVG
                          titre={nomZone}
                          polygonesFond={polysFondReg}
                          polygonesMis={polysMis}
                          width={158} height={110}
                        />
                      </div>
                    </div>
                  )}

                  {/* Légende */}
                  <div style={{ border: '1.5px solid #1a3a5c', borderRadius: 4, overflow: 'hidden', flex: 1 }}>
                    <div style={{
                      background: '#1a3a5c', color: 'white',
                      fontSize: 8, fontWeight: 700, padding: '3px 6px', letterSpacing: 0.5,
                    }}>LÉGENDE</div>
                    <div style={{ padding: '6px 8px', fontSize: 9, lineHeight: 1.8 }}>
                      {[
                        { color: '#bdc3c7', border: '#7f8c8d', label: 'Limite régionale' },
                        { color: '#bdc3c7', border: '#1a5276', label: 'Limite départementale' },
                        { color: '#fadbd8', border: '#e74c3c', label: 'Limite communale' },
                        { color: '#2471a3', border: '#1a5276', label: 'Zone sélectionnée', bold: true },
                      ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 18, height: 10, flexShrink: 0,
                            background: item.color, border: `1.5px solid ${item.border}`,
                          }} />
                          <span style={{ fontWeight: item.bold ? 700 : 400 }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Projection */}
                  <div style={{
                    border: '1px solid #ccc', borderRadius: 4,
                    padding: '4px 7px', fontSize: 8, color: '#444',
                  }}>
                    <div><b>Projection :</b> WGS 84 (EPSG:4326)</div>
                    <div><b>Datum :</b> WGS 1984</div>
                    <div><b>Date :</b> {dateStr()}</div>
                  </div>

                </div>
              </div>

              {/* ── Pied de page ── */}
              <div style={{
                borderTop: '2px solid #1a3a5c', background: '#f8fbfd',
                padding: '6px 18px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', fontSize: 9, color: '#555',
              }}>
                <div>📊 <b>Source :</b> {source}</div>
                <div style={{ color: '#1a3a5c', fontWeight: 700 }}>Carto-facileSN — cartographie.sn</div>
                <div>Réalisé le {dateStr()} | WGS 84</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
