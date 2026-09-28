import React from 'react';
import type { RecordingState, CompletedRecordingMeta, RecordingError } from '@screenrecorder/protocol';
import { formatDuration } from '../utils/formatTime.js';

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
  return (
    <div className="action-controls-section">
      {state === 'IDLE' && (
        <button type="button" className="btn btn-record" onClick={onStart}>
          <span className="rec-circle"></span>
          Start Recording
        </button>
      )}

      {state === 'STARTING' && (
        <button type="button" className="btn btn-record starting" disabled>
          Initializing capture...
        </button>
      )}

      {state === 'RECORDING' && (
        <div className="button-row">
          <button type="button" className="btn btn-warning" onClick={onPause}>
            Pause
          </button>
          <button type="button" className="btn btn-danger" onClick={onStop}>
            Stop
          </button>
        </div>
      )}

      {state === 'PAUSED' && (
        <div className="button-row">
          <button type="button" className="btn btn-primary" onClick={onResume}>
            Resume
          </button>
          <button type="button" className="btn btn-danger" onClick={onStop}>
            Stop
          </button>
        </div>
      )}

      {(state === 'STOPPING' || state === 'PROCESSING') && (
        <div className="processing-indicator">
          <div className="spinner"></div>
          <span>Finalizing high-quality stream...</span>
        </div>
      )}

      {state === 'COMPLETED' && (
        <div className="completed-box">
          <div className="completed-header">Recording complete</div>
          {lastRecording && (
            <div className="completed-meta">
              <div className="meta-row">
                <span className="meta-label">File:</span>
                <span className="meta-val">{lastRecording.filename}</span>
              </div>
              {lastRecording.width && lastRecording.height && (
                <div className="meta-row">
                  <span className="meta-label">Resolution:</span>
                  <span className="meta-val">{lastRecording.width} × {lastRecording.height}</span>
                </div>
              )}
              {lastRecording.frameRate && (
                <div className="meta-row">
                  <span className="meta-label">Frame Rate:</span>
                  <span className="meta-val">{lastRecording.frameRate} FPS</span>
                </div>
              )}
              {lastRecording.codec && (
                <div className="meta-row">
                  <span className="meta-label">Codec:</span>
                  <span className="meta-val">{lastRecording.codec}</span>
                </div>
              )}
              <div className="meta-row">
                <span className="meta-label">Duration:</span>
                <span className="meta-val">{formatDuration(lastRecording.durationMs)}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Size:</span>
                <span className="meta-val">
                  {lastRecording.sizeBytes >= 1024 * 1024 * 1024
                    ? `${(lastRecording.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                    : `${(lastRecording.sizeBytes / (1024 * 1024)).toFixed(2)} MB`}
                </span>
              </div>
              {lastRecording.bitrateBps && (
                <div className="meta-row">
                  <span className="meta-label">Bitrate:</span>
                  <span className="meta-val">{(lastRecording.bitrateBps / 1_000_000).toFixed(1)} Mbps</span>
                </div>
              )}
            </div>
          )}
          <div className="button-row" style={{ marginTop: '12px' }}>
            {lastRecording?.downloadUrl && (
              <a
                href={lastRecording.downloadUrl}
                download={lastRecording.filename}
                className="btn btn-primary btn-link"
              >
                Download
              </a>
            )}
            <button type="button" className="btn btn-secondary" onClick={onReset}>
              Record Again
            </button>
          </div>
        </div>
      )}

      {state === 'ERROR' && (
        <div className="error-box">
          <div className="error-title">Capture Error</div>
          <div className="error-message">{error?.message || 'An unexpected error occurred.'}</div>
          <button type="button" className="btn btn-secondary" onClick={onReset} style={{ marginTop: '10px' }}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
