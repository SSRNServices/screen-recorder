import React from 'react';
import { formatDuration } from '../utils/formatTime.js';
import type { RecordingInfo } from '@screenrecorder/protocol';

interface TimerDisplayProps {
  elapsedMs: number;
  isRecording: boolean;
  isPaused: boolean;
  recordingInfo?: RecordingInfo | null;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  elapsedMs,
  isRecording,
  isPaused,
  recordingInfo
}) => {
  return (
    <div className={`timer-container ${isRecording ? 'recording' : ''} ${isPaused ? 'paused' : ''}`}>
      <span className="timer-value">{formatDuration(elapsedMs)}</span>

      {recordingInfo && (
        <div className="technical-info-chips">
          <span className="tech-chip">{recordingInfo.width} × {recordingInfo.height}</span>
          <span className="tech-chip">{recordingInfo.frameRate} FPS</span>
          <span className="tech-chip">{recordingInfo.codec}</span>
          <span className="tech-chip">{(recordingInfo.videoBitsPerSecond / 1_000_000).toFixed(0)} Mbps</span>
        </div>
      )}

      {recordingInfo?.lowQualityWarning && (
        <div className="low-quality-warning">
          <span>Source resolution is relatively low ({recordingInfo.width}×{recordingInfo.height}). Video clarity is limited by source.</span>
        </div>
      )}
    </div>
  );
};
