/**
 * Core recording state machine states.
 */
export type RecordingState =
  | 'IDLE'
  | 'STARTING'
  | 'RECORDING'
  | 'PAUSED'
  | 'STOPPING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'ERROR';

/**
 * Capture source preference.
 */
export type CaptureSource = 'tab' | 'window' | 'screen';

export type QualityProfile = 'standard' | 'high' | 'ultra';
export type FpsOption = 'auto' | 30 | 60;
export type ResolutionOption = 'source' | '1080p' | '1440p' | '2160p';

/**
 * Recording configuration requested by UI.
 */
export interface RecordingConfig {
  source: CaptureSource;
  includeMic: boolean;
  includeSystemAudio: boolean;
  quality: QualityProfile;
  fps: FpsOption;
  resolution: ResolutionOption;
  mimeType?: string;
  frameRate?: number;
  streamId?: string;
  captureMethod?: 'desktop' | 'tab';
  canRequestAudioTrack?: boolean;
  targetTabId?: number;
  targetTabUrl?: string;
}

/**
 * Technical details of the active recording session.
 */
export interface RecordingInfo {
  width: number;
  height: number;
  frameRate: number;
  mimeType: string;
  codec: string;
  videoBitsPerSecond: number;
  actualVideoBitsPerSecond?: number;
  audioBitsPerSecond: number;
  displaySurface?: string;
  qualityProfile: QualityProfile;
  lowQualityWarning?: boolean;
}

/**
 * Status error codes.
 */
export type ErrorCode =
  | 'NATIVE_HOST_UNAVAILABLE'
  | 'FFMPEG_NOT_FOUND'
  | 'FFMPEG_START_FAILED'
  | 'INVALID_REQUEST'
  | 'INVALID_INPUT_FILE'
  | 'INVALID_OUTPUT_PATH'
  | 'UNSUPPORTED_FORMAT'
  | 'PROCESSING_FAILED'
  | 'PROCESSING_CANCELLED'
  | 'PERMISSION_DENIED'
  | 'CAPTURE_FAILED'
  | 'RECORDING_CANCELLED'
  | 'MEDIARECORDER_ERROR'
  | 'STREAM_ENDED_UNEXPECTEDLY'
  | 'UNKNOWN_ERROR';

/**
 * Detail for an error occurrence.
 */
export interface RecordingError {
  code: ErrorCode;
  message: string;
  details?: string;
}

/**
 * Metadata for a completed recording.
 */
export interface CompletedRecordingMeta {
  filename: string;
  downloadUrl?: string;
  downloadId?: number;
  durationMs: number;
  sizeBytes: number;
  mimeType: string;
  codec?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  bitrateBps?: number;
  recordedAt: string; // ISO string
}

/**
 * Full state snapshot for synchronization between background, recorder, and popup.
 */
export interface RecordingStatusSnapshot {
  state: RecordingState;
  elapsedMs: number;
  startTime: number | null;
  pausedTime: number | null;
  totalPausedDuration: number;
  config: RecordingConfig;
  recordingInfo: RecordingInfo | null;
  error: RecordingError | null;
  lastRecording: CompletedRecordingMeta | null;
}

/**
 * Internal extension message definitions (Popup <-> Background <-> Dedicated Recorder)
 */
export type ExtensionMessage =
  | { type: 'START_RECORDING'; config: RecordingConfig }
  | { type: 'STOP_RECORDING' }
  | { type: 'PAUSE_RECORDING' }
  | { type: 'RESUME_RECORDING' }
  | { type: 'GET_RECORDING_STATUS' }
  | { type: 'RECORDING_STATUS_UPDATE'; snapshot: RecordingStatusSnapshot }
  | { type: 'RESET_RECORDING' };

/**
 * Native messaging requests sent from Extension -> Native Host.
 */
export interface BaseNativeMessage {
  requestId: string;
}

export interface PingRequest extends BaseNativeMessage {
  type: 'ping';
}

export interface GetCapabilitiesRequest extends BaseNativeMessage {
  type: 'get_capabilities';
}

export interface ProcessRecordingRequest extends BaseNativeMessage {
  type: 'process_recording';
  input: string;
  output: string;
  profile?: 'standard' | 'highQuality' | 'smallFile';
}

export interface GetProcessingStatusRequest extends BaseNativeMessage {
  type: 'get_processing_status';
  jobId: string;
}

export interface CancelProcessingRequest extends BaseNativeMessage {
  type: 'cancel_processing';
  jobId: string;
}

export type NativeRequest =
  | PingRequest
  | GetCapabilitiesRequest
  | ProcessRecordingRequest
  | GetProcessingStatusRequest
  | CancelProcessingRequest;

/**
 * Native messaging responses sent from Native Host -> Extension.
 */
export interface PongResponse extends BaseNativeMessage {
  type: 'pong';
  timestamp: number;
}

export interface CapabilitiesResponse extends BaseNativeMessage {
  type: 'capabilities';
  ffmpegAvailable: boolean;
  version?: string;
  profiles: string[];
}

export interface ProcessingStartedResponse extends BaseNativeMessage {
  type: 'processing_started';
  jobId: string;
}

export interface ProcessingProgressEvent {
  type: 'processing_progress';
  jobId: string;
  percent: number;
  timeSeconds: number;
  fps: number;
}

export interface ProcessingCompletedResponse extends BaseNativeMessage {
  type: 'processing_completed';
  jobId: string;
  outputPath: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

export interface ProcessingCancelledResponse extends BaseNativeMessage {
  type: 'processing_cancelled';
  jobId: string;
}

export interface NativeErrorResponse extends BaseNativeMessage {
  type: 'error';
  code: ErrorCode;
  message: string;
  details?: string;
}

export type NativeResponse =
  | PongResponse
  | CapabilitiesResponse
  | ProcessingStartedResponse
  | ProcessingProgressEvent
  | ProcessingCompletedResponse
  | ProcessingCancelledResponse
  | NativeErrorResponse;
