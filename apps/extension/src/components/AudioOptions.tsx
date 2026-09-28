import React from 'react';
import { IconMic, IconVolume } from './Icons.js';

interface AudioOptionsProps {
  includeMic: boolean;
  includeSystemAudio: boolean;
  onMicChange: (enabled: boolean) => void;
  onSystemAudioChange: (enabled: boolean) => void;
  disabled: boolean;
}

export const AudioOptions: React.FC<AudioOptionsProps> = ({
  includeMic,
  includeSystemAudio,
  onMicChange,
  onSystemAudioChange,
  disabled
}) => {
  return (
    <div className="form-group">
      <label className="section-label">Audio Sources</label>
      <div className="toggle-list">
        {/* Microphone Toggle */}
        <div className={`toggle-row ${disabled ? 'disabled' : ''}`}>
          <div className="toggle-info">
            <span className="toggle-icon"><IconMic size={15} /></span>
            <span className="toggle-title">Microphone</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={includeMic}
            className={`switch ${includeMic ? 'checked' : ''}`}
            onClick={() => !disabled && onMicChange(!includeMic)}
            disabled={disabled}
            aria-label="Toggle microphone audio"
          >
            <span className="switch-thumb" />
          </button>
        </div>

        {/* System Audio Toggle */}
        <div className={`toggle-row ${disabled ? 'disabled' : ''}`}>
          <div className="toggle-info">
            <span className="toggle-icon"><IconVolume size={15} /></span>
            <span className="toggle-title">System / Tab Audio</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={includeSystemAudio}
            className={`switch ${includeSystemAudio ? 'checked' : ''}`}
            onClick={() => !disabled && onSystemAudioChange(!includeSystemAudio)}
            disabled={disabled}
            aria-label="Toggle system and tab audio"
          >
            <span className="switch-thumb" />
          </button>
        </div>
      </div>
    </div>
  );
};
