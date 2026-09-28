import type {
  RecordingConfig,
  RecordingError,
  RecordingState,
  RecordingStatusSnapshot,
  CompletedRecordingMeta,
  RecordingInfo
} from '@screenrecorder/protocol';
import { isValidTransition } from '@screenrecorder/protocol';
import { getBestSupportedMimeType } from './mimeDetector.js';
import { RecordingTimer } from './timer.js';
import { generateRecordingFilename } from '../utils/generateFilename.js';
import { calculateRecordingSettings } from './qualityCalculator.js';

export type StatusUpdateCallback = (snapshot: RecordingStatusSnapshot) => void;

export class RecordingController {
  private state: RecordingState = 'IDLE';
  private config: RecordingConfig = {
    source: 'screen',
    includeMic: false,
    includeSystemAudio: true,
    quality: 'high',
    fps: 'auto',
    resolution: 'source'
  };
  private mediaStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private timer: RecordingTimer = new RecordingTimer();
  private error: RecordingError | null = null;
  private lastRecording: CompletedRecordingMeta | null = null;
  private recordingInfo: RecordingInfo | null = null;
  private listeners: Set<StatusUpdateCallback> = new Set();
  private selectedMimeType = '';

  constructor() {
    this.restoreFromStorage();
  }

  public subscribe(cb: StatusUpdateCallback): () => void {
    this.listeners.add(cb);
    cb(this.getSnapshot());
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getSnapshot(): RecordingStatusSnapshot {
    const timerState = this.timer.getState();
    return {
      state: this.state,
      elapsedMs: this.timer.getElapsedMs(),
      startTime: timerState.startTime,
      pausedTime: timerState.pausedTime,
      totalPausedDuration: timerState.totalPausedDuration,
      config: { ...this.config },
      recordingInfo: this.recordingInfo ? { ...this.recordingInfo } : null,
      error: this.error ? { ...this.error } : null,
      lastRecording: this.lastRecording ? { ...this.lastRecording } : null
    };
  }

  private transitionTo(newState: RecordingState, errorDetails?: RecordingError): void {
    if (!isValidTransition(this.state, newState)) {
      console.warn(`[RecordingController] Invalid state transition from ${this.state} to ${newState}`);
      return;
    }

    this.state = newState;
    if (errorDetails) {
      this.error = errorDetails;
    } else if (newState === 'IDLE' || newState === 'STARTING') {
      this.error = null;
    }

    this.persistSnapshot();
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[RecordingController] Error in listener callback:', err);
      }
    }
  }

  private persistSnapshot(): void {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      const snapshot = this.getSnapshot();
      chrome.storage.session.set({ recording_snapshot: snapshot }).catch((err) => {
        console.warn('[RecordingController] Failed to persist session snapshot:', err);
      });
    }
  }

  public async restoreFromStorage(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      try {
        const data = await chrome.storage.session.get('recording_snapshot');
        if (data.recording_snapshot) {
          const snapshot = data.recording_snapshot as RecordingStatusSnapshot;
          if (snapshot.state === 'RECORDING' || snapshot.state === 'PAUSED') {
            this.state = snapshot.state;
            this.config = snapshot.config;
            this.recordingInfo = snapshot.recordingInfo;
            this.timer.restore({
              startTime: snapshot.startTime,
              pausedTime: snapshot.pausedTime,
              totalPausedDuration: snapshot.totalPausedDuration,
              isPaused: snapshot.state === 'PAUSED',
              isRunning: true
            });
            this.notify();
          } else if (snapshot.lastRecording) {
            this.lastRecording = snapshot.lastRecording;
            this.recordingInfo = snapshot.recordingInfo;
            this.state = snapshot.state;
            this.notify();
          }
        }
      } catch (err) {
        console.warn('[RecordingController] Error reading session storage:', err);
      }
    }
  }

  public async startRecording(config: RecordingConfig): Promise<void> {
    if (this.state === 'RECORDING' || this.state === 'STARTING') {
      return;
    }

    this.config = config;
    this.recordedChunks = [];
    this.transitionTo('STARTING');

    try {
      // 1. Determine capture constraints based on source and desired FPS
      const targetIdealFps = config.fps === 30 ? 30 : 60;
      const displayConstraints: DisplayMediaStreamOptions = {
        video: {
          frameRate: { ideal: targetIdealFps, max: targetIdealFps }
        },
        audio: config.includeSystemAudio
      };

      if (config.source === 'tab') {
        (displayConstraints.video as MediaTrackConstraints).displaySurface = 'browser';
      } else if (config.source === 'window') {
        (displayConstraints.video as MediaTrackConstraints).displaySurface = 'window';
      } else if (config.source === 'screen') {
        (displayConstraints.video as MediaTrackConstraints).displaySurface = 'monitor';
      }

      // 2. Request screen capture from browser
      const screenStream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);
      this.mediaStream = screenStream;

      // Handle user stopping screen share via Chrome native overlay bar
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.info('[RecordingController] Video track ended via browser UI.');
          if (this.state === 'RECORDING' || this.state === 'PAUSED') {
            this.stopRecording().catch((err) => {
              console.error('[RecordingController] Error stopping after track ended:', err);
            });
          }
        };
      }

      // 3. Inspect actual source track settings
      const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
      const sourceWidth = settings.width || 1920;
      const sourceHeight = settings.height || 1080;
      const sourceFps = settings.frameRate || targetIdealFps;
      const displaySurface = settings.displaySurface;

      // 4. Calculate quality settings, dynamic bitrate, and resolution
      const calculated = calculateRecordingSettings({
        sourceWidth,
        sourceHeight,
        sourceFps,
        qualityProfile: config.quality || 'high',
        fpsOption: config.fps || 'auto',
        resolutionOption: config.resolution || 'source'
      });

      // Apply resolution downscale constraint only if requested and supported
      if ((calculated.targetWidth < sourceWidth || calculated.targetHeight < sourceHeight) && videoTrack.applyConstraints) {
        try {
          await videoTrack.applyConstraints({
            width: { ideal: calculated.targetWidth },
            height: { ideal: calculated.targetHeight }
          });
        } catch (constraintErr) {
          console.warn('[RecordingController] Could not apply downscale constraint, using source resolution directly:', constraintErr);
        }
      }

      // 5. Audio handling: system audio + microphone mixing if enabled
      let finalAudioTrack: MediaStreamTrack | null = null;
      const systemAudioTracks = screenStream.getAudioTracks();
      const hasSystemAudio = systemAudioTracks.length > 0;

      if (config.includeMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          this.micStream = micStream;

          if (hasSystemAudio) {
            // Mix system audio + microphone via Web Audio API
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const audioCtx = new AudioCtx();
            this.audioContext = audioCtx;

            const systemSource = audioCtx.createMediaStreamSource(new MediaStream([systemAudioTracks[0]]));
            const micSource = audioCtx.createMediaStreamSource(micStream);
            const destination = audioCtx.createMediaStreamDestination();

            systemSource.connect(destination);
            micSource.connect(destination);

            finalAudioTrack = destination.stream.getAudioTracks()[0];
          } else {
            finalAudioTrack = micStream.getAudioTracks()[0];
          }
        } catch (micErr) {
          console.warn('[RecordingController] Microphone access denied or unavailable:', micErr);
          if (hasSystemAudio) {
            finalAudioTrack = systemAudioTracks[0];
          }
        }
      } else if (hasSystemAudio) {
        finalAudioTrack = systemAudioTracks[0];
      }

      // 6. Construct composite stream
      const tracksToRecord: MediaStreamTrack[] = [videoTrack];
      if (finalAudioTrack) {
        tracksToRecord.push(finalAudioTrack);
      }
      const compositeStream = new MediaStream(tracksToRecord);

      // 7. Select optimal supported MIME type and codec
      const codecResult = getBestSupportedMimeType(config.mimeType, Boolean(finalAudioTrack));
      this.selectedMimeType = codecResult.mimeType;

      // 8. Configure high-quality MediaRecorder
      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: calculated.videoBitsPerSecond,
        audioBitsPerSecond: calculated.audioBitsPerSecond
      };

      if (codecResult.mimeType) {
        recorderOptions.mimeType = codecResult.mimeType;
      }

      console.info('[RecordingController] Initializing MediaRecorder with high-quality options:', {
        mimeType: codecResult.mimeType,
        codec: codecResult.codec,
        videoBitsPerSecond: `${(calculated.videoBitsPerSecond / 1_000_000).toFixed(1)} Mbps`,
        audioBitsPerSecond: `${(calculated.audioBitsPerSecond / 1_000).toFixed(0)} kbps`,
        resolution: `${calculated.targetWidth}x${calculated.targetHeight}`,
        fps: calculated.targetFps
      });

      const mediaRecorder = new MediaRecorder(compositeStream, recorderOptions);
      this.mediaRecorder = mediaRecorder;

      // 9. Record actual technical info
      this.recordingInfo = {
        width: calculated.targetWidth,
        height: calculated.targetHeight,
        frameRate: calculated.targetFps,
        mimeType: codecResult.mimeType,
        codec: codecResult.codec,
        videoBitsPerSecond: calculated.videoBitsPerSecond,
        actualVideoBitsPerSecond: mediaRecorder.videoBitsPerSecond || calculated.videoBitsPerSecond,
        audioBitsPerSecond: mediaRecorder.audioBitsPerSecond || calculated.audioBitsPerSecond,
        displaySurface,
        qualityProfile: config.quality || 'high',
        lowQualityWarning: calculated.lowQualityWarning
      };

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        console.error('[RecordingController] MediaRecorder error:', event);
        this.transitionTo('ERROR', {
          code: 'MEDIARECORDER_ERROR',
          message: 'An error occurred in MediaRecorder during recording.'
        });
      };

      mediaRecorder.onstop = () => {
        this.finalizeRecording();
      };

      // 10. Start recording with 1000ms timeslices for memory safety
      mediaRecorder.start(1000);
      this.timer.start();
      this.transitionTo('RECORDING');
    } catch (err: unknown) {
      console.error('[RecordingController] Failed to start recording:', err);
      const errorObj = err as Error;

      if (errorObj.name === 'NotAllowedError') {
        if (errorObj.message && errorObj.message.includes('Permission dismissed')) {
          this.transitionTo('ERROR', {
            code: 'RECORDING_CANCELLED',
            message: 'Recording cancelled.'
          });
        } else {
          this.transitionTo('ERROR', {
            code: 'PERMISSION_DENIED',
            message: 'Screen capture permission was denied.'
          });
        }
      } else {
        this.transitionTo('ERROR', {
          code: 'CAPTURE_FAILED',
          message: errorObj.message || 'Failed to capture screen stream.'
        });
      }
      this.cleanupStreams();
    }
  }

  public pauseRecording(): void {
    if (this.state !== 'RECORDING' || !this.mediaRecorder) {
      return;
    }

    try {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
        this.timer.pause();
        this.transitionTo('PAUSED');
      }
    } catch (err) {
      console.error('[RecordingController] Failed to pause recording:', err);
    }
  }

  public resumeRecording(): void {
    if (this.state !== 'PAUSED' || !this.mediaRecorder) {
      return;
    }

    try {
      if (this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
        this.timer.resume();
        this.transitionTo('RECORDING');
      }
    } catch (err) {
      console.error('[RecordingController] Failed to resume recording:', err);
    }
  }

  public async stopRecording(): Promise<void> {
    if (this.state !== 'RECORDING' && this.state !== 'PAUSED') {
      return;
    }

    this.transitionTo('STOPPING');
    this.timer.stop();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (err) {
        console.error('[RecordingController] Error invoking mediaRecorder.stop():', err);
        this.finalizeRecording();
      }
    } else {
      this.finalizeRecording();
    }
  }

  private finalizeRecording(): void {
    this.transitionTo('PROCESSING');

    try {
      const mimeType = this.selectedMimeType || 'video/webm';
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      const durationMs = this.timer.getElapsedMs();
      const filename = generateRecordingFilename(new Date(), 'webm');

      // Calculate approximate actual bitrate (bps) from size and duration
      const durationSeconds = durationMs / 1000;
      const calculatedBitrateBps = durationSeconds > 0 ? Math.round((blob.size * 8) / durationSeconds) : 0;

      const downloadUrl = URL.createObjectURL(blob);

      const meta: CompletedRecordingMeta = {
        filename,
        downloadUrl,
        durationMs,
        sizeBytes: blob.size,
        mimeType,
        codec: this.recordingInfo?.codec,
        width: this.recordingInfo?.width,
        height: this.recordingInfo?.height,
        frameRate: this.recordingInfo?.frameRate,
        bitrateBps: calculatedBitrateBps,
        recordedAt: new Date().toISOString()
      };

      this.lastRecording = meta;
      this.cleanupStreams();

      // Trigger browser download
      this.triggerDownload(blob, filename);

      this.transitionTo('COMPLETED');
    } catch (err) {
      console.error('[RecordingController] Error finalizing recording:', err);
      this.transitionTo('ERROR', {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to assemble and save the recording.'
      });
      this.cleanupStreams();
    }
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
      chrome.downloads.download(
        {
          url,
          filename,
          saveAs: true
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            console.warn('[RecordingController] chrome.downloads error, falling back to anchor:', chrome.runtime.lastError);
            this.fallbackDownload(url, filename);
          } else if (this.lastRecording && downloadId) {
            this.lastRecording.downloadId = downloadId;
            this.persistSnapshot();
            this.notify();
          }
        }
      );
    } else {
      this.fallbackDownload(url, filename);
    }
  }

  private fallbackDownload(url: string, filename: string): void {
    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
      }, 1000);
    }
  }

  public reset(): void {
    this.cleanupStreams();
    this.timer.reset();
    this.recordedChunks = [];
    this.error = null;
    this.lastRecording = null;
    this.recordingInfo = null;
    this.transitionTo('IDLE');
  }

  private cleanupStreams(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch((err) => console.warn('Error closing AudioContext', err));
      this.audioContext = null;
    }
    this.mediaRecorder = null;
  }
}
