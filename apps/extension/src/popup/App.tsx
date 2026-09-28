import React from 'react';
import { Header } from '../components/Header.js';
import { SourceSelector } from '../components/SourceSelector.js';
import { AudioOptions } from '../components/AudioOptions.js';
import { TimerDisplay } from '../components/TimerDisplay.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ActionControls } from '../components/ActionControls.js';
import { useRecordingState } from '../hooks/useRecordingState.js';

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

  const isRecording = snapshot.state === 'RECORDING';
  const isPaused = snapshot.state === 'PAUSED';
  const isBusy = isRecording || isPaused || snapshot.state === 'STARTING' || snapshot.state === 'STOPPING' || snapshot.state === 'PROCESSING';

  return (
    <div className="popup-container">
      <Header />

      <main className="popup-body">
        {/* Source Selection */}
        <SourceSelector
          source={snapshot.config.source}
          onChange={(source) => updateConfig({ source })}
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

        {/* Elapsed Timer */}
        {(isRecording || isPaused || snapshot.state === 'COMPLETED') && (
          <TimerDisplay
            elapsedMs={elapsedMs}
            isRecording={isRecording}
            isPaused={isPaused}
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

        {/* Status Line */}
        <footer className="popup-footer">
          <StatusBadge state={snapshot.state} />
        </footer>
      </main>
    </div>
  );
};
