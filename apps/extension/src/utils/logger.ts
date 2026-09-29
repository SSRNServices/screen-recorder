import { serializeError, type SerializedError } from './errors.js';

export type DiagnosticStage =
  | 'START'
  | 'CONFIG'
  | 'RECORDER_READY'
  | 'CAPTURE_REQUEST'
  | 'CAPTURE_RESPONSE'
  | 'STREAM_VALIDATION'
  | 'AUDIO_SETUP'
  | 'MEDIARECORDER_SETUP'
  | 'RECORDING_STARTED'
  | 'STOPPING'
  | 'PROCESSING'
  | 'FAILURE';

export interface DiagnosticContext {
  stage?: DiagnosticStage;
  source?: string;
  captureMethod?: string;
  streamIdPresent?: boolean;
  streamIdLength?: number;
  includeSystemAudio?: boolean;
  includeMic?: boolean;
  canRequestAudioTrack?: boolean;
  documentVisibility?: string;
  pageUrl?: string;
  readyState?: string;
  videoTrackCount?: number;
  audioTrackCount?: number;
  audioRequested?: boolean;
  audioAvailable?: boolean;
  [key: string]: unknown;
}

/**
 * Sanitizes arbitrary log data so raw stream IDs are never exposed in logs.
 */
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key === 'streamId' || key === 'chromeMediaSourceId') {
      if (typeof value === 'string' && value.length > 0) {
        sanitized.streamIdPresent = true;
        sanitized.streamIdLength = value.length;
      } else {
        sanitized.streamIdPresent = false;
      }
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
}

export class ScreenRecorderLogger {
  private prefix = '[ScreenRecorder]';

  public log(stage: DiagnosticStage, details?: Record<string, unknown>): void {
    const sanitized = details ? sanitizeLogData(details) : {};
    console.log(`${this.prefix} ${stage}`, sanitized);
  }

  public warn(stage: string, details?: Record<string, unknown>): void {
    const sanitized = details ? sanitizeLogData(details) : {};
    console.warn(`${this.prefix} ${stage}`, sanitized);
  }

  public error(stage: DiagnosticStage | string, error: unknown, context?: DiagnosticContext): void {
    const serializedErr: SerializedError = serializeError(error);
    const sanitizedContext = context ? sanitizeLogData(context as Record<string, unknown>) : {};

    console.error(`${this.prefix} ${stage}:`, {
      stage,
      error: serializedErr,
      ...sanitizedContext
    });
  }
}

export const logger = new ScreenRecorderLogger();
