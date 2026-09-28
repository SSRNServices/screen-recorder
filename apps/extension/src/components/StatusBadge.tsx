import React from 'react';
import type { RecordingState } from '@screenrecorder/protocol';
import { IconShield } from './Icons.js';

interface StatusBadgeProps {
  state: RecordingState;
}

const STATE_LABELS: Record<RecordingState, string> = {
  IDLE: 'Ready',
  STARTING: 'Initializing',
  RECORDING: 'Recording',
  PAUSED: 'Paused',
  STOPPING: 'Stopping',
  PROCESSING: 'Saving',
  COMPLETED: 'Completed',
  ERROR: 'Error'
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state }) => {
  return (
    <div className="status-footer-wrapper">
      <div className="privacy-pill" title="All processing occurs locally in browser memory without external network calls">
        <IconShield size={12} className="privacy-icon" />
        <span>Local • No Upload</span>
      </div>

      <div className={`status-pill pill-${state.toLowerCase()}`} role="status">
        <span className="status-dot-indicator" aria-hidden="true" />
        <span className="status-text">{STATE_LABELS[state]}</span>
      </div>
    </div>
  );
};
