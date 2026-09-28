import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-brand">
        <span className="brand-dot"></span>
        <h1 className="header-title">ScreenRecorder</h1>
      </div>
      <span className="header-version">v0.1.0</span>
    </header>
  );
};
