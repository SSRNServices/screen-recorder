import React from 'react';

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
      <label className="section-label">Audio</label>
      <div className="checkbox-group">
        <label className={`checkbox-label ${disabled ? 'disabled' : ''}`}>
          <input
            type="checkbox"
            checked={includeMic}
            onChange={(e) => onMicChange(e.target.checked)}
            disabled={disabled}
          />
          <span className="checkbox-text">Include microphone</span>
        </label>

        <label className={`checkbox-label ${disabled ? 'disabled' : ''}`}>
          <input
            type="checkbox"
            checked={includeSystemAudio}
            onChange={(e) => onSystemAudioChange(e.target.checked)}
            disabled={disabled}
          />
          <span className="checkbox-text">Include system audio</span>
        </label>
      </div>
    </div>
  );
};
