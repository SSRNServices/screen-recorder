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
        <label className="section-label">Video Quality</label>
      </div>

      <div className="select-grid">
        {/* Quality Profile */}
        <div className="select-field">
          <label className="field-sublabel">Profile</label>
          <select
            value={quality}
            onChange={(e) => onQualityChange(e.target.value as QualityProfile)}
            disabled={disabled}
            className="setting-select"
          >
            <option value="standard">Standard (18-20 Mbps)</option>
            <option value="high">High (25-30 Mbps)</option>
            <option value="ultra">Ultra (35-50 Mbps)</option>
          </select>
        </div>

        {/* Frame Rate */}
        <div className="select-field">
          <label className="field-sublabel">FPS</label>
          <select
            value={fps}
            onChange={(e) => {
              const val = e.target.value;
              onFpsChange(val === 'auto' ? 'auto' : (Number(val) as 30 | 60));
            }}
            disabled={disabled}
            className="setting-select"
          >
            <option value="auto">Auto (Native)</option>
            <option value="60">60 FPS</option>
            <option value="30">30 FPS</option>
          </select>
        </div>

        {/* Resolution */}
        <div className="select-field">
          <label className="field-sublabel">Resolution</label>
          <select
            value={resolution}
            onChange={(e) => onResolutionChange(e.target.value as ResolutionOption)}
            disabled={disabled}
            className="setting-select"
          >
            <option value="source">Source (Native)</option>
            <option value="1080p">1080p (Max)</option>
            <option value="1440p">1440p (Max)</option>
            <option value="2160p">2160p / 4K</option>
          </select>
        </div>
      </div>
    </div>
  );
};
