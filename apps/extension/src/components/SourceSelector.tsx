import React from 'react';
import type { CaptureSource } from '@screenrecorder/protocol';
import { IconTab, IconWindow, IconMonitor } from './Icons.js';

interface SourceSelectorProps {
  source: CaptureSource;
  onChange: (source: CaptureSource) => void;
  disabled: boolean;
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({ source, onChange, disabled }) => {
  const options: Array<{ id: CaptureSource; label: string; icon: React.ReactNode }> = [
    { id: 'screen', label: 'Screen', icon: <IconMonitor size={15} /> },
    { id: 'window', label: 'Window', icon: <IconWindow size={15} /> },
    { id: 'tab', label: 'Tab', icon: <IconTab size={15} /> }
  ];

  return (
    <div className="form-group">
      <label className="section-label">Capture Source</label>
      <div className="segmented-grid" role="radiogroup" aria-label="Capture source">
        {options.map((opt) => {
          const isSelected = source === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`segmented-item ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => !disabled && onChange(opt.id)}
              disabled={disabled}
            >
              <span className="segmented-icon">{opt.icon}</span>
              <span className="segmented-text">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
