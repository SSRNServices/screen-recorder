import React, { useState } from 'react';
import { Header } from '../components/Header.js';
import { SourceSelector } from '../components/SourceSelector.js';
import { AudioOptions } from '../components/AudioOptions.js';
import { QualitySettings } from '../components/QualitySettings.js';
import { TimerDisplay } from '../components/TimerDisplay.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ActionControls } from '../components/ActionControls.js';
import { useRecordingState } from '../hooks/useRecordingState.js';
import { IconShield, IconInfo } from '../components/Icons.js';

export const App: React.FC = () => {
  const {
    snapshot,
    elapsedMs,
    updateConfig,
    start,
    stop,
    pause,
    resume,
    reset
  } = useRecordingState();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isRecording = snapshot.state === 'RECORDING';
  const isPaused = snapshot.state === 'PAUSED';
  const isBusy =
    isRecording ||
    isPaused ||
    snapshot.state === 'STARTING' ||
    snapshot.state === 'STOPPING' ||
    snapshot.state === 'PROCESSING';

  return (
    <div className="popup-container">
      <Header
        onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
        isSettingsOpen={isSettingsOpen}
      />

      <main className="popup-body">
        {isSettingsOpen ? (
          <div className="settings-panel" role="region" aria-label="Application Settings & Privacy">
            <div className="settings-section">
              <div className="settings-header-row">
                <IconShield size={16} className="text-accent" />
                <h2 className="settings-heading">Privacy & Architecture</h2>
              </div>
              <p className="settings-desc">
                ScreenRecorder operates entirely local-first. Video and audio streams are processed in local browser memory and never transmitted to external servers.
              </p>
            </div>

            <div className="settings-section">
              <div className="settings-header-row">
                <IconInfo size={16} className="text-muted" />
                <h2 className="settings-heading">System Information</h2>
              </div>
              <div className="settings-keyval">
                <span className="key">Engine:</span>
                <span className="val">MediaRecorder (VP9 / Opus)</span>
              </div>
              <div className="settings-keyval">
                <span className="key">Native Processing:</span>
                <span className="val">FFmpeg (Phase 2 Integration)</span>
              </div>
              <div className="settings-keyval">
                <span className="key">Platform:</span>
                <span className="val">Manifest V3 · Chromium</span>
              </div>
              <div className="settings-keyval">
                <span className="key">License:</span>
                <span className="val">MIT Open Source</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsSettingsOpen(false)}
              style={{ marginTop: '8px' }}
            >
              Back to Recording
            </button>
          </div>
        ) : (
          <>
            {/* Source Selection */}
            <SourceSelector
              source={snapshot.config.source}
              onChange={(source) => updateConfig({ source })}
              disabled={isBusy}
            />

            {/* Video Quality, FPS, and Resolution */}
            <QualitySettings
              quality={snapshot.config.quality}
              fps={snapshot.config.fps}
              resolution={snapshot.config.resolution}
              onQualityChange={(quality) => updateConfig({ quality })}
              onFpsChange={(fps) => updateConfig({ fps })}
              onResolutionChange={(resolution) => updateConfig({ resolution })}
              disabled={isBusy}
            />

            {/* Audio Toggles */}
            <AudioOptions
              includeMic={snapshot.config.includeMic}
              includeSystemAudio={snapshot.config.includeSystemAudio}
              onMicChange={(includeMic) => updateConfig({ includeMic })}
              onSystemAudioChange={(includeSystemAudio) => updateConfig({ includeSystemAudio })}
              disabled={isBusy}
            />

            {/* Elapsed Timer & Technical Specs */}
            {(isRecording || isPaused || snapshot.state === 'COMPLETED') && (
              <TimerDisplay
                elapsedMs={elapsedMs}
                isRecording={isRecording}
                isPaused={isPaused}
                recordingInfo={snapshot.recordingInfo}
              />
            )}

            {/* Actions & State Controls */}
            <ActionControls
              state={snapshot.state}
              error={snapshot.error}
              lastRecording={snapshot.lastRecording}
              onStart={start}
              onStop={stop}
              onPause={pause}
              onResume={resume}
              onReset={reset}
            />
          </>
        )}

        {/* Status Line */}
        <footer className="popup-footer">
          <StatusBadge state={snapshot.state} />
        </footer>
      </main>
    </div>
  );
};
