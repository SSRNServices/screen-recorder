import { useState, useEffect, useCallback } from 'react';
import type {
  RecordingConfig,
  RecordingStatusSnapshot
} from '@screenrecorder/protocol';
import { getRecordingStatus, startRecording, sendCommand } from '../services/messageClient.js';
import { RecordingTimer } from '../recorder/timer.js';

const defaultSnapshot: RecordingStatusSnapshot = {
  state: 'IDLE',
  elapsedMs: 0,
  startTime: null,
  pausedTime: null,
  totalPausedDuration: 0,
  config: {
    source: 'screen',
    includeMic: false,
    includeSystemAudio: true
  },
  error: null,
  lastRecording: null
};

export function useRecordingState() {
  const [snapshot, setSnapshot] = useState<RecordingStatusSnapshot>(defaultSnapshot);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Sync snapshot
  const refreshStatus = useCallback(async () => {
    const latest = await getRecordingStatus();
    if (latest) {
      setSnapshot(latest);
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
    setSnapshot((prev) => ({
      ...prev,
      config: { ...prev.config, ...newConfig }
    }));
  };

  const handleStart = async () => {
    await startRecording(snapshot.config);
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
    setSnapshot(defaultSnapshot);
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
