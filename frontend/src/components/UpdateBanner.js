import React, { useState, useEffect } from 'react';

/**
 * Banniere de mise a jour automatique.
 * S'affiche quand le Service Worker detecte une nouvelle version deployee.
 */
export default function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Deja detecte avant le montage du composant
    if (window.__swUpdateAvailable) setVisible(true);

    const handler = () => setVisible(true);
    window.addEventListener('swUpdateAvailable', handler);
    return () => window.removeEventListener('swUpdateAvailable', handler);
  }, []);

  const appliquerMiseAJour = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          window.location.reload();
        }
      });
    } else {
      window.location.reload();
    }
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 60,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: 'linear-gradient(135deg, #1a3a5c, #2471a3)',
      color: 'white',
      borderRadius: 12,
      padding: '10px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
      fontSize: '0.78rem',
      fontWeight: 600,
      border: '1px solid rgba(255,255,255,0.2)',
      maxWidth: '90vw',
      animation: 'slideUpBanner 0.4s ease',
    }}>
      <span>🚀</span>
      <span>Nouvelle version disponible !</span>
      <button
        onClick={appliquerMiseAJour}
        style={{
          background: 'white',
          color: '#1a3a5c',
          border: 'none',
          borderRadius: 8,
          padding: '5px 14px',
          cursor: 'pointer',
          fontSize: '0.76rem',
          fontWeight: 700,
        }}
      >
        Actualiser
      </button>
      <button
        onClick={() => setVisible(false)}
        style={{
          background: 'rgba(255,255,255,0.15)',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          width: 24, height: 24,
          cursor: 'pointer',
          fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✕</button>
    </div>
  );
}
