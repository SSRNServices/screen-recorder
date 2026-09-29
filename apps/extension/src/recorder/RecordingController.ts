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
import { captureMedia } from './captureService.js';
import { setupAudioPipeline } from './audioMixer.js';
import { logger } from '../utils/logger.js';
import { createCaptureError, classifyCaptureError, serializeError } from '../utils/errors.js';

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
  private currentObjectUrl: string | null = null;
  private isStarting = false;
  private isCleaningUp = false;
  private startupTimeoutId: number | null = null;

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
      logger.warn(`Invalid state transition attempted from ${this.state} to ${newState}`);
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
        logger.error('FAILURE', err, { stage: 'START', note: 'Error in listener callback' });
      }
    }
  }

  private persistSnapshot(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      const snapshot = this.getSnapshot();
      chrome.storage.session.set({ recording_snapshot: snapshot }).catch((err) => {
        logger.warn('Failed to persist session snapshot', { error: String(err) });
      });
    }
  }

  public async restoreFromStorage(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
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
        logger.warn('Error reading session storage during restore', { error: String(err) });
      }
    }
  }

  public async startRecording(config: RecordingConfig): Promise<void> {
    // Startup lock / mutex
    if (this.isStarting || this.state === 'RECORDING' || this.state === 'STARTING') {
      logger.warn('START: Duplicate or concurrent startRecording call rejected');
      return;
    }

    this.isStarting = true;
    logger.log('START', { source: config.source });
    this.config = { ...config };
    this.recordedChunks = [];
    this.transitionTo('STARTING');

    // 15-second safety startup timeout
    this.startupTimeoutId = window.setTimeout(() => {
      if (this.state === 'STARTING') {
        logger.error('FAILURE', new Error('Recording initialization timed out'), {
          stage: 'START',
          source: config.source
        });
        this.cleanup();
        this.transitionTo('ERROR', {
          code: 'RECORDING_START_TIMEOUT',
          message: 'Recording initialization timed out. Please try again.'
        });
        this.isStarting = false;
      }
    }, 15000);

    try {
      logger.log('CONFIG', {
        source: config.source,
        quality: config.quality,
        fps: config.fps,
        resolution: config.resolution,
        includeMic: config.includeMic,
        includeSystemAudio: config.includeSystemAudio
      });

      // 1. Authoritative Capture Dispatch
      const captureResult = await captureMedia(config);
      this.mediaStream = captureResult.stream;

      // 2. Validate acquired display stream
      const videoTracks = captureResult.stream.getVideoTracks();
      const audioTracks = captureResult.stream.getAudioTracks();

      logger.log('STREAM_VALIDATION', {
        videoTrackCount: videoTracks.length,
        audioTrackCount: audioTracks.length,
        videoReadyState: videoTracks[0]?.readyState
      });

      if (videoTracks.length === 0 || videoTracks[0].readyState !== 'live') {
        throw createCaptureError(
          'NO_LIVE_VIDEO_TRACK',
          'No live video track received from display capture.'
        );
      }

      const videoTrack = videoTracks[0];
      const videoSettings = videoTrack.getSettings ? videoTrack.getSettings() : {};

      logger.log('STREAM_VALIDATION', {
        trackKind: videoTrack.kind,
        trackLabel: videoTrack.label,
        trackReadyState: videoTrack.readyState,
        width: videoSettings.width,
        height: videoSettings.height,
        frameRate: videoSettings.frameRate,
        displaySurface: videoSettings.displaySurface
      });

      // Handle user ending screen capture via Chrome browser UI overlay bar
      videoTrack.onended = () => {
        logger.log('STOPPING', { reason: 'Video track ended via browser UI overlay' });
        if (this.state === 'RECORDING' || this.state === 'PAUSED') {
          this.stopRecording().catch((err) => {
            logger.error('FAILURE', err, { stage: 'STOPPING' });
          });
        }
      };

      // 3. Technical quality calculation
      const targetIdealFps = config.fps === 30 ? 30 : 60;
      const sourceWidth = videoSettings.width || 1920;
      const sourceHeight = videoSettings.height || 1080;
      const sourceFps = videoSettings.frameRate || targetIdealFps;

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
          logger.warn('Could not apply downscale constraint, using source resolution directly', {
            error: String(constraintErr)
          });
        }
      }

      // 4. Audio pipeline setup (system audio + optional microphone mixing)
      const audioResult = await setupAudioPipeline(
        captureResult.stream,
        config,
        captureResult.isTabCapture
      );
      this.micStream = audioResult.micStream;
      this.audioContext = audioResult.audioContext;

      // 5. Combine tracks into final composite stream
      const tracksToRecord: MediaStreamTrack[] = [videoTrack];
      if (audioResult.finalAudioTrack && audioResult.finalAudioTrack.readyState === 'live') {
        tracksToRecord.push(audioResult.finalAudioTrack);
      }
      const compositeStream = new MediaStream(tracksToRecord);

      // 6. Optimal codec and MIME type selection
      const hasAudioTrack = Boolean(audioResult.finalAudioTrack);
      const codecResult = getBestSupportedMimeType(config.mimeType, hasAudioTrack);
      this.selectedMimeType = codecResult.mimeType;

      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: calculated.videoBitsPerSecond,
        audioBitsPerSecond: calculated.audioBitsPerSecond
      };
      if (codecResult.mimeType) {
        recorderOptions.mimeType = codecResult.mimeType;
      }

      logger.log('MEDIARECORDER_SETUP', {
        mimeType: codecResult.mimeType,
        codec: codecResult.codec,
        hasAudioTrack,
        videoBitsPerSecond: calculated.videoBitsPerSecond,
        audioBitsPerSecond: calculated.audioBitsPerSecond
      });

      // 7. Instantiate MediaRecorder with fallback
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(compositeStream, recorderOptions);
      } catch (err1) {
        logger.warn('MEDIARECORDER_SETUP: Creation with full options failed, falling back to mimeType only', {
          error: String(err1)
        });
        try {
          mediaRecorder = new MediaRecorder(compositeStream, {
            mimeType: codecResult.mimeType || undefined
          });
        } catch (err2) {
          logger.warn('MEDIARECORDER_SETUP: Creation with mimeType failed, falling back to default', {
            error: String(err2)
          });
          try {
            mediaRecorder = new MediaRecorder(compositeStream);
          } catch (err3) {
            logger.error('FAILURE', err3, { stage: 'MEDIARECORDER_SETUP' });
            throw createCaptureError(
              'MEDIARECORDER_FAILED',
              'MediaRecorder could not be initialized with the captured stream.',
              serializeError(err3).message,
              err3
            );
          }
        }
      }

      this.mediaRecorder = mediaRecorder;

      this.recordingInfo = {
        width: calculated.targetWidth,
        height: calculated.targetHeight,
        frameRate: calculated.targetFps,
        mimeType: codecResult.mimeType,
        codec: codecResult.codec,
        videoBitsPerSecond: calculated.videoBitsPerSecond,
        actualVideoBitsPerSecond: mediaRecorder.videoBitsPerSecond || calculated.videoBitsPerSecond,
        audioBitsPerSecond: mediaRecorder.audioBitsPerSecond || calculated.audioBitsPerSecond,
        displaySurface: videoSettings.displaySurface,
        qualityProfile: config.quality || 'high',
        lowQualityWarning: calculated.lowQualityWarning
      };

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        logger.error('FAILURE', event, { stage: 'MEDIARECORDER_SETUP' });
        this.transitionTo('ERROR', {
          code: 'MEDIARECORDER_ERROR',
          message: 'An unexpected error occurred in MediaRecorder during recording.'
        });
      };

      mediaRecorder.onstop = () => {
        this.finalizeRecording();
      };

      // 8. Start recording with 1000ms timeslices for memory safety
      mediaRecorder.start(1000);

      // Cancel startup timeout immediately upon success
      if (this.startupTimeoutId) {
        clearTimeout(this.startupTimeoutId);
        this.startupTimeoutId = null;
      }

      this.timer.start();
      this.transitionTo('RECORDING');
      this.isStarting = false;
      logger.log('RECORDING_STARTED', {
        source: config.source,
        codec: codecResult.codec
      });
    } catch (err: unknown) {
      if (this.startupTimeoutId) {
        clearTimeout(this.startupTimeoutId);
        this.startupTimeoutId = null;
      }
      this.isStarting = false;

      const classified = classifyCaptureError(err, config.source);
      logger.error('FAILURE', err, {
        stage: 'START',
        source: config.source,
        classifiedCode: classified.code
      });

      this.cleanup();

      // If user cancelled, transition back to IDLE cleanly (or ERROR if needed by UI)
      if (classified.code === 'USER_CANCELLED') {
        this.transitionTo('IDLE');
        // Notify listeners with cancellation error details so UI can show friendly notice
        this.error = classified;
        this.notify();
      } else {
        this.transitionTo('ERROR', classified);
      }
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
      logger.error('FAILURE', err, { stage: 'START', note: 'Failed to pause recording' });
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
      logger.error('FAILURE', err, { stage: 'START', note: 'Failed to resume recording' });
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
        logger.error('FAILURE', err, { stage: 'STOPPING' });
        this.finalizeRecording();
      }
    } else {
      this.finalizeRecording();
    }
  }

  private finalizeRecording(): void {
    if (this.state === 'COMPLETED' || this.state === 'PROCESSING') {
      return;
    }

    this.transitionTo('PROCESSING');

    try {
      const mimeType = this.selectedMimeType || 'video/webm';
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      const durationMs = this.timer.getElapsedMs();
      const filename = generateRecordingFilename(new Date(), 'webm');

      const durationSeconds = durationMs / 1000;
      const calculatedBitrateBps = durationSeconds > 0 ? Math.round((blob.size * 8) / durationSeconds) : 0;

      // Revoke any previous object URL
      if (this.currentObjectUrl) {
        try {
          URL.revokeObjectURL(this.currentObjectUrl);
        } catch {
          // Ignore
        }
      }

      // Generate download URL ONCE
      const downloadUrl = URL.createObjectURL(blob);
      this.currentObjectUrl = downloadUrl;

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
      this.cleanup();

      // Trigger browser download using the single generated downloadUrl
      this.triggerDownload(downloadUrl, filename);

      this.transitionTo('COMPLETED');
    } catch (err) {
      logger.error('FAILURE', err, { stage: 'PROCESSING' });
      this.transitionTo('ERROR', {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to assemble and save the recording.'
      });
      this.cleanup();
    }
  }

  private triggerDownload(url: string, filename: string): void {
    if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
      chrome.downloads.download(
        {
          url,
          filename,
          saveAs: true
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            logger.warn('chrome.downloads error, falling back to anchor download', {
              error: chrome.runtime.lastError.message
            });
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
        try {
          document.body.removeChild(a);
        } catch {
          // Ignore
        }
      }, 1000);
    }
  }

  public reset(): void {
    this.cleanup();
    this.timer.reset();
    this.recordedChunks = [];
    this.error = null;
    this.lastRecording = null;
    this.recordingInfo = null;
    this.transitionTo('IDLE');
  }

  /**
   * Central, idempotent cleanup method.
   * Calling multiple times is completely safe.
   */
  public cleanup(): void {
    if (this.isCleaningUp) return;
    this.isCleaningUp = true;

    try {
      if (this.startupTimeoutId) {
        clearTimeout(this.startupTimeoutId);
        this.startupTimeoutId = null;
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch {
          // Ignore if already stopping
        }
      }
      this.mediaRecorder = null;

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignore
          }
        });
        this.mediaStream = null;
      }

      if (this.micStream) {
        this.micStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignore
          }
        });
        this.micStream = null;
      }

      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(() => {});
        this.audioContext = null;
      }
    } finally {
      this.isCleaningUp = false;
    }
  }
}
