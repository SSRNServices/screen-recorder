import React from 'react';
import type { QualityProfile, FpsOption, ResolutionOption } from '@screenrecorder/protocol';

interface QualitySettingsProps {
  quality: QualityProfile;
  fps: FpsOption;
  resolution: ResolutionOption;
  onQualityChange: (quality: QualityProfile) => void;
  onFpsChange: (fps: FpsOption) => void;
  onResolutionChange: (resolution: ResolutionOption) => void;
  disabled: boolean;
}

export const QualitySettings: React.FC<QualitySettingsProps> = ({
  quality,
  fps,
  resolution,
  onQualityChange,
  onFpsChange,
  onResolutionChange,
  disabled
}) => {
  return (
    <div className="form-group quality-settings-group">
      <div className="section-label-row">
        <label className="section-label">Recording Quality</label>
        <span className="section-hint">High bitrate VP9</span>
      </div>

      <div className="select-grid">
        {/* Quality Profile */}
        <div className="select-field">
          <label htmlFor="select-quality-profile" className="field-sublabel">
            Profile
          </label>
          <select
            id="select-quality-profile"
            value={quality}
            onChange={(e) => onQualityChange(e.target.value as QualityProfile)}
            disabled={disabled}
            className="setting-select"
            aria-label="Quality profile"
          >
            <option value="standard">Standard · ~18 Mbps</option>
            <option value="high">High · ~25 Mbps</option>
            <option value="ultra">Ultra · ~35 Mbps</option>
          </select>
        </div>

        {/* Frame Rate */}
        <div className="select-field">
          <label htmlFor="select-fps" className="field-sublabel">
            Frame Rate
          </label>
          <select
            id="select-fps"
            value={fps}
            onChange={(e) => {
              const val = e.target.value;
              onFpsChange(val === 'auto' ? 'auto' : (Number(val) as 30 | 60));
            }}
            disabled={disabled}
            className="setting-select"
            aria-label="Target frame rate"
          >
            <option value="auto">Auto (Source)</option>
            <option value="60">60 FPS</option>
            <option value="30">30 FPS</option>
          </select>
        </div>

        {/* Resolution */}
        <div className="select-field">
          <label htmlFor="select-resolution" className="field-sublabel">
            Resolution
          </label>
          <select
            id="select-resolution"
            value={resolution}
            onChange={(e) => onResolutionChange(e.target.value as ResolutionOption)}
            disabled={disabled}
            className="setting-select"
            aria-label="Target resolution limit"
          >
            <option value="source">Source (Native)</option>
            <option value="1080p">1080p (Max)</option>
            <option value="1440p">1440p (Max)</option>
            <option value="2160p">2160p (4K Max)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
