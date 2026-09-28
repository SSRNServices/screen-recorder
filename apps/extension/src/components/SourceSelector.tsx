import React from 'react';
import type { CaptureSource } from '@screenrecorder/protocol';

interface SourceSelectorProps {
  source: CaptureSource;
  onChange: (source: CaptureSource) => void;
  disabled: boolean;
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({ source, onChange, disabled }) => {
  return (
    <div className="form-group">
      <label className="section-label">Recording Source</label>
      <div className="source-options">
        <label className={`radio-label ${source === 'tab' ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
          <input
            type="radio"
            name="source"
            value="tab"
            checked={source === 'tab'}
            onChange={() => onChange('tab')}
            disabled={disabled}
          />
          <span className="radio-text">Browser Tab</span>
        </label>

        <label className={`radio-label ${source === 'window' ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
          <input
            type="radio"
            name="source"
            value="window"
            checked={source === 'window'}
            onChange={() => onChange('window')}
            disabled={disabled}
          />
          <span className="radio-text">Window</span>
        </label>

        <label className={`radio-label ${source === 'screen' ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
          <input
            type="radio"
            name="source"
            value="screen"
            checked={source === 'screen'}
            onChange={() => onChange('screen')}
            disabled={disabled}
          />
          <span className="radio-text">Entire Screen</span>
        </label>
      </div>
    </div>
  );
};
