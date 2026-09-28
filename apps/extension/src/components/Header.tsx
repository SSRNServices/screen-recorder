import React from 'react';
import { IconSettings } from './Icons.js';

interface HeaderProps {
  onToggleSettings?: () => void;
  isSettingsOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSettings, isSettingsOpen }) => {
  return (
    <header className="header">
      <div className="header-brand">
        <span className="brand-dot" aria-hidden="true"></span>
        <h1 className="header-title">ScreenRecorder</h1>
        <span className="header-badge">v0.1.0</span>
      </div>
      {onToggleSettings && (
        <button
          type="button"
          className={`icon-btn ${isSettingsOpen ? 'active' : ''}`}
          onClick={onToggleSettings}
          title={isSettingsOpen ? 'Close settings' : 'Open settings'}
          aria-label={isSettingsOpen ? 'Close settings' : 'Open settings'}
        >
          <IconSettings size={16} />
        </button>
      )}
    </header>
  );
};
