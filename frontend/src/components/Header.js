import React from 'react';
export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <span className="header-logo">🇸🇳</span>
        <div>
          <div className="header-title">Carto-facileSN</div>
          <div className="header-subtitle">Cartographie administrative du Sénégal</div>
        </div>
      </div>
      <div className="header-right">
        <span className="header-badge">📍 WGS 84</span>
        <span className="header-badge">v2.0</span>
      </div>
    </header>
  );
}
