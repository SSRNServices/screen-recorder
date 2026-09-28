import React from 'react';
import type { RecordingState } from '@screenrecorder/protocol';

interface StatusBadgeProps {
  state: RecordingState;
}

const STATE_LABELS: Record<RecordingState, string> = {
  IDLE: 'Ready',
  STARTING: 'Starting...',
  RECORDING: 'Recording',
  PAUSED: 'Paused',
  STOPPING: 'Stopping...',
  PROCESSING: 'Processing...',
  COMPLETED: 'Completed',
  ERROR: 'Error'
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state }) => {
  return (
    <div className="status-badge-wrapper">
      <span className="status-label-prefix">Status:</span>
      <span className={`status-pill pill-${state.toLowerCase()}`}>
        <span className="status-dot-indicator"></span>
        {STATE_LABELS[state]}
      </span>
    </div>
  );
};
