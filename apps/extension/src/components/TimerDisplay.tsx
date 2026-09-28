import React from 'react';
import { formatDuration } from '../utils/formatTime.js';
import type { RecordingInfo } from '@screenrecorder/protocol';
import { IconAlert } from './Icons.js';

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
    <div
      className={`timer-container ${isRecording ? 'recording' : ''} ${isPaused ? 'paused' : ''}`}
      role="timer"
      aria-label="Recording duration"
    >
      <div className="timer-header">
        <span className="timer-status-dot" aria-hidden="true" />
        <span className="timer-status-text">
          {isRecording ? 'Recording' : isPaused ? 'Paused' : 'Elapsed'}
        </span>
      </div>

      <span className="timer-value">{formatDuration(elapsedMs)}</span>

      {recordingInfo && (
        <div className="technical-info-chips" aria-label="Technical stream parameters">
          <span className="tech-chip">{recordingInfo.width} × {recordingInfo.height}</span>
          <span className="tech-chip">{recordingInfo.frameRate} FPS</span>
          <span className="tech-chip">{recordingInfo.codec}</span>
          <span className="tech-chip">{(recordingInfo.videoBitsPerSecond / 1_000_000).toFixed(0)} Mbps</span>
        </div>
      )}

      {recordingInfo?.lowQualityWarning && (
        <div className="low-quality-warning" role="note">
          <IconAlert size={14} className="warning-icon" />
          <span>Source resolution is relatively low ({recordingInfo.width}×{recordingInfo.height}). Video clarity is limited by source.</span>
        </div>
      )}
    </div>
  );
};
