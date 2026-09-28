import React, { useState } from 'react';
import type { RecordingState, CompletedRecordingMeta, RecordingError } from '@screenrecorder/protocol';
import { formatDuration } from '../utils/formatTime.js';
import {
  IconRecord,
  IconPause,
  IconPlay,
  IconStop,
  IconDownload,
  IconRefresh,
  IconAlert,
  IconChevronDown
} from './Icons.js';

interface ActionControlsProps {
  state: RecordingState;
  error: RecordingError | null;
  lastRecording: CompletedRecordingMeta | null;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  state,
  error,
  lastRecording,
  onStart,
  onStop,
  onPause,
  onResume,
  onReset
}) => {
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  return (
    <div className="action-controls-section">
      {state === 'IDLE' && (
        <button
          type="button"
          className="btn btn-record"
          onClick={onStart}
          aria-label="Start screen recording"
        >
          <span className="btn-icon"><IconRecord size={16} /></span>
          <span>Start Recording</span>
        </button>
      )}

      {state === 'STARTING' && (
        <button type="button" className="btn btn-record starting" disabled aria-busy="true">
          <span className="spinner" aria-hidden="true" />
          <span>Preparing recording...</span>
        </button>
      )}

      {state === 'RECORDING' && (
        <div className="button-row">
          <button
            type="button"
            className="btn btn-warning"
            onClick={onPause}
            aria-label="Pause recording"
          >
            <span className="btn-icon"><IconPause size={15} /></span>
            <span>Pause</span>
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onStop}
            aria-label="Stop recording"
          >
            <span className="btn-icon"><IconStop size={15} /></span>
            <span>Stop</span>
          </button>
        </div>
      )}

      {state === 'PAUSED' && (
        <div className="button-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onResume}
            aria-label="Resume recording"
          >
            <span className="btn-icon"><IconPlay size={14} /></span>
            <span>Resume</span>
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onStop}
            aria-label="Stop recording"
          >
            <span className="btn-icon"><IconStop size={15} /></span>
            <span>Stop</span>
          </button>
        </div>
      )}

      {(state === 'STOPPING' || state === 'PROCESSING') && (
        <div className="processing-indicator" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <span>Finalizing recording...</span>
        </div>
      )}

      {state === 'COMPLETED' && (
        <div className="completed-box" role="region" aria-label="Recording complete details">
          <div className="completed-header">
            <span className="completed-badge">Saved</span>
            <span className="completed-title">Recording Complete</span>
          </div>
          {lastRecording && (
            <div className="completed-meta">
              <div className="meta-filename" title={lastRecording.filename}>
                {lastRecording.filename}
              </div>
              <div className="meta-grid">
                {lastRecording.width && lastRecording.height && (
                  <div className="meta-item">
                    <span className="meta-k">Resolution</span>
                    <span className="meta-v">{lastRecording.width} × {lastRecording.height}</span>
                  </div>
                )}
                {lastRecording.frameRate && (
                  <div className="meta-item">
                    <span className="meta-k">FPS</span>
                    <span className="meta-v">{lastRecording.frameRate}</span>
                  </div>
                )}
                {lastRecording.codec && (
                  <div className="meta-item">
                    <span className="meta-k">Codec</span>
                    <span className="meta-v">{lastRecording.codec}</span>
                  </div>
                )}
                <div className="meta-item">
                  <span className="meta-k">Duration</span>
                  <span className="meta-v">{formatDuration(lastRecording.durationMs)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-k">Size</span>
                  <span className="meta-v">
                    {lastRecording.sizeBytes >= 1024 * 1024 * 1024
                      ? `${(lastRecording.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                      : `${(lastRecording.sizeBytes / (1024 * 1024)).toFixed(2)} MB`}
                  </span>
                </div>
                {lastRecording.bitrateBps && (
                  <div className="meta-item">
                    <span className="meta-k">Bitrate</span>
                    <span className="meta-v">{(lastRecording.bitrateBps / 1_000_000).toFixed(1)} Mbps</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="button-row" style={{ marginTop: '14px' }}>
            {lastRecording?.downloadUrl && (
              <a
                href={lastRecording.downloadUrl}
                download={lastRecording.filename}
                className="btn btn-primary btn-link"
                aria-label="Download video recording"
              >
                <span className="btn-icon"><IconDownload size={15} /></span>
                <span>Download</span>
              </a>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onReset}
              aria-label="Record another session"
            >
              <span className="btn-icon"><IconRefresh size={14} /></span>
              <span>Record Again</span>
            </button>
          </div>
        </div>
      )}

      {state === 'ERROR' && (
        <div className="error-box" role="alert">
          <div className="error-header">
            <span className="error-icon"><IconAlert size={16} /></span>
            <span className="error-title">Capture Error</span>
          </div>
          <p className="error-message">
            {error?.message || 'Recording could not be completed.'}
          </p>
          {error?.code && (
            <div className="error-details-container">
              <button
                type="button"
                className="error-details-toggle"
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                aria-expanded={showErrorDetails}
              >
                <span>{showErrorDetails ? 'Hide technical details' : 'Show details'}</span>
                <span className={`toggle-arrow ${showErrorDetails ? 'open' : ''}`}>
                  <IconChevronDown size={12} />
                </span>
              </button>
              {showErrorDetails && (
                <div className="error-details-content">
                  <div><strong>Error Code:</strong> {error.code}</div>
                  {error.details && <div><strong>Context:</strong> {error.details}</div>}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onReset}
            style={{ marginTop: '10px' }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
