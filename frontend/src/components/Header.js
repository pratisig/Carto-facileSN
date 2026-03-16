import React from 'react';

export default function Header({ isMobile }) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <span className="app-header-logo">🗺️</span>
        <div>
          <div className="app-header-title">Carto-facileSN</div>
          {!isMobile && <div className="app-header-sub">Cartographie administrative du Sénégal</div>}
        </div>
      </div>
      <div className="app-header-right">
        <span className="app-header-badge">WGS 84 v2.0</span>
        {!isMobile && <span className="app-header-badge">SHP IGN-SN</span>}
      </div>
    </header>
  );
}
