import React from 'react';
import { formatDuration } from '../utils/formatTime.js';

interface TimerDisplayProps {
  elapsedMs: number;
  isRecording: boolean;
  isPaused: boolean;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ elapsedMs, isRecording, isPaused }) => {
  return (
    <div className={`timer-container ${isRecording ? 'recording' : ''} ${isPaused ? 'paused' : ''}`}>
      <span className="timer-value">{formatDuration(elapsedMs)}</span>
    </div>
  );
};
