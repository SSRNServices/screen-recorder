import { useState, useEffect, useCallback } from 'react';
import type {
  RecordingConfig,
  RecordingStatusSnapshot
} from '@screenrecorder/protocol';
import { getRecordingStatus, startRecording, sendCommand } from '../services/messageClient.js';
import { RecordingTimer } from '../recorder/timer.js';
import { loadSavedSettings, saveSettings, DEFAULT_RECORDING_CONFIG } from '../services/settingsService.js';

const defaultSnapshot: RecordingStatusSnapshot = {
  state: 'IDLE',
  elapsedMs: 0,
  startTime: null,
  pausedTime: null,
  totalPausedDuration: 0,
  config: { ...DEFAULT_RECORDING_CONFIG },
  recordingInfo: null,
  error: null,
  lastRecording: null
};

export function useRecordingState() {
  const [snapshot, setSnapshot] = useState<RecordingStatusSnapshot>(defaultSnapshot);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Sync snapshot and saved settings
  const refreshStatus = useCallback(async () => {
    const [latestSnapshot, savedSettings] = await Promise.all([
      getRecordingStatus(),
      loadSavedSettings()
    ]);

    if (latestSnapshot) {
      // If extension restarted or tab was closed while STARTING, recover to IDLE
      if (latestSnapshot.state === 'STARTING') {
        setSnapshot({
          ...latestSnapshot,
          state: 'IDLE',
          error: null,
          config: { ...latestSnapshot.config, ...savedSettings }
        });
      } else {
        setSnapshot(latestSnapshot);
      }
    } else {
      setSnapshot((prev) => ({
        ...prev,
        config: { ...prev.config, ...savedSettings }
      }));
    }
  }, []);

  useEffect(() => {
    refreshStatus();

    // Listen for storage changes across popup/tabs
    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'session' && changes.recording_snapshot?.newValue) {
        setSnapshot(changes.recording_snapshot.newValue as RecordingStatusSnapshot);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(storageListener);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(storageListener);
      }
    };
  }, [refreshStatus]);

  // Safety timeout: Never allow UI to remain stuck on STARTING permanently
  useEffect(() => {
    if (snapshot.state === 'STARTING') {
      const timeout = setTimeout(() => {
        setSnapshot((prev) => {
          if (prev.state === 'STARTING') {
            console.warn('[ScreenRecorder] Recording startup timed out in popup UI.');
            return {
              ...prev,
              state: 'ERROR',
              error: {
                code: 'CAPTURE_FAILED',
                message: 'Recording initialization timed out. Please try again.'
              }
            };
          }
          return prev;
        });
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [snapshot.state]);

  // Elapsed time calculation with zero-drift timer
  useEffect(() => {
    const timer = new RecordingTimer();
    timer.restore({
      startTime: snapshot.startTime,
      pausedTime: snapshot.pausedTime,
      totalPausedDuration: snapshot.totalPausedDuration,
      isPaused: snapshot.state === 'PAUSED',
      isRunning: snapshot.state === 'RECORDING' || snapshot.state === 'PAUSED'
    });

    setElapsedMs(timer.getElapsedMs());

    if (snapshot.state === 'RECORDING') {
      const interval = setInterval(() => {
        setElapsedMs(timer.getElapsedMs());
      }, 250);
      return () => clearInterval(interval);
    }
  }, [snapshot.state, snapshot.startTime, snapshot.pausedTime, snapshot.totalPausedDuration]);

  const updateConfig = (newConfig: Partial<RecordingConfig>) => {
    setSnapshot((prev) => {
      const updatedConfig = { ...prev.config, ...newConfig };
      saveSettings(updatedConfig).catch((err) => console.warn('Failed saving settings:', err));
      return {
        ...prev,
        config: updatedConfig
      };
    });
  };

  const handleStart = async () => {
    if (snapshot.state === 'STARTING' || snapshot.state === 'RECORDING') {
      return;
    }

    try {
      setSnapshot((prev) => ({
        ...prev,
        state: 'STARTING',
        error: null
      }));
      await startRecording(snapshot.config);
    } catch (err: unknown) {
      console.error('[ScreenRecorder] Recording startup failed:', err);
      const errMsg = (err as Error)?.message || 'Failed to start recording.';
      const isCancelled = errMsg.toLowerCase().includes('cancel');
      setSnapshot((prev) => ({
        ...prev,
        state: isCancelled ? 'IDLE' : 'ERROR',
        error: isCancelled
          ? null
          : {
              code: isCancelled ? 'RECORDING_CANCELLED' : 'CAPTURE_FAILED',
              message: errMsg
            }
      }));
    }
  };

  const handleStop = async () => {
    await sendCommand({ type: 'STOP_RECORDING' });
  };

  const handlePause = async () => {
    await sendCommand({ type: 'PAUSE_RECORDING' });
  };

  const handleResume = async () => {
    await sendCommand({ type: 'RESUME_RECORDING' });
  };

  const handleReset = async () => {
    await sendCommand({ type: 'RESET_RECORDING' });
    const saved = await loadSavedSettings();
    setSnapshot({
      ...defaultSnapshot,
      config: { ...DEFAULT_RECORDING_CONFIG, ...saved }
    });
  };

  return {
    snapshot,
    elapsedMs,
    updateConfig,
    start: handleStart,
    stop: handleStop,
    pause: handlePause,
    resume: handleResume,
    reset: handleReset
  };
}
