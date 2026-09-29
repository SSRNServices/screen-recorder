import type { ErrorCode, RecordingError, CaptureSource } from '@screenrecorder/protocol';

export interface SerializedError {
  name: string;
  message: string;
  stack?: string | null;
  code?: string | null;
  constraint?: string | null;
  cause?: SerializedError | null;
}

/**
 * Robust serializer that guarantees NO error prints as [object Object].
 */
export function serializeError(error: unknown): SerializedError {
  if (!error) {
    return {
      name: 'UnknownError',
      message: 'Unknown error',
      stack: null
    };
  }

  if (error instanceof Error || (typeof error === 'object' && error !== null && 'name' in error)) {
    const err = error as Error & {
      code?: string | number;
      constraint?: string;
      cause?: unknown;
    };

    return {
      name: err.name || 'Error',
      message: err.message || String(error),
      stack: err.stack || null,
      code: err.code ? String(err.code) : null,
      constraint: err.constraint || null,
      cause: err.cause ? serializeError(err.cause) : null
    };
  }

  return {
    name: 'NonErrorObject',
    message: typeof error === 'string' ? error : JSON.stringify(error),
    stack: null
  };
}

export class CaptureError extends Error {
  public code: ErrorCode;
  public details?: string;
  public override cause?: unknown;

  constructor(code: ErrorCode, message: string, details?: string, cause?: unknown) {
    super(message);
    this.name = 'CaptureError';
    this.code = code;
    this.details = details;
    this.cause = cause;
    Object.setPrototypeOf(this, CaptureError.prototype);
  }

  public toRecordingError(): RecordingError {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

export function createCaptureError(
  code: ErrorCode,
  message: string,
  details?: string,
  cause?: unknown
): CaptureError {
  return new CaptureError(code, message, details, cause);
}

/**
 * Classify a DOMException, Error, or string into a structured RecordingError.
 * Distinguishes user cancellation from actual permission denial, device errors, and expired tokens.
 */
export function classifyCaptureError(error: unknown, source?: CaptureSource): RecordingError {
  if (error instanceof CaptureError) {
    return error.toRecordingError();
  }

  const serialized = serializeError(error);
  const name = serialized.name;
  const rawMsg = serialized.message || '';
  const msgLower = rawMsg.toLowerCase();
  const sourceLabel = source === 'window' ? 'Window' : source === 'tab' ? 'Tab' : 'Screen';

  // 1. Explicit cancellation detection
  if (
    msgLower.includes('cancel') ||
    msgLower.includes('dismiss') ||
    name === 'AbortError'
  ) {
    return {
      code: 'USER_CANCELLED',
      message: 'Recording cancelled. No capture source was selected.',
      details: rawMsg
    };
  }

  // 2. Permission denied (user or OS explicitly denied capture)
  if (name === 'NotAllowedError') {
    // In Chrome, if user denied permission
    return {
      code: 'PERMISSION_DENIED',
      message: `${sourceLabel} capture permission was denied.`,
      details: rawMsg
    };
  }

  // 3. Invalid or expired stream ID tokens
  if (
    msgLower.includes('invalid stream id') ||
    msgLower.includes('invalid chrome media source') ||
    msgLower.includes('invalid state')
  ) {
    if (msgLower.includes('expired')) {
      return {
        code: 'STREAM_ID_EXPIRED',
        message: 'The capture session expired before recording started. Please try again.',
        details: rawMsg
      };
    }
    return {
      code: 'STREAM_ID_ALREADY_USED',
      message: 'The capture session was already used or invalidated. Please start a new recording.',
      details: rawMsg
    };
  }

  // 4. Overconstrained / Resolution / FPS not supported
  if (name === 'OverconstrainedError') {
    return {
      code: 'CAPTURE_FAILED',
      message: 'The requested capture resolution or frame rate is not supported by the selected source.',
      details: serialized.constraint ? `Constraint failed: ${serialized.constraint}` : rawMsg
    };
  }

  // 5. Not readable / locked hardware
  if (name === 'NotReadableError') {
    return {
      code: 'CAPTURE_FAILED',
      message: 'Could not read capture source. It may be locked by another application or protected by DRM.',
      details: rawMsg
    };
  }

  // 6. Device not found
  if (name === 'NotFoundError') {
    return {
      code: 'CAPTURE_FAILED',
      message: 'No capture source or device was found.',
      details: rawMsg
    };
  }

  // 7. Security Error
  if (name === 'SecurityError') {
    return {
      code: 'PERMISSION_DENIED',
      message: 'Security policy blocked screen capture for this origin or page.',
      details: rawMsg
    };
  }

  // 8. Generic fallback with clean message
  let displayMessage = `${sourceLabel} capture failed.`;
  if (rawMsg && !rawMsg.includes('object DOMException') && !rawMsg.includes('object Object')) {
    displayMessage = `${sourceLabel} capture failed: ${rawMsg}`;
  }

  return {
    code: 'MEDIA_STREAM_FAILED',
    message: displayMessage,
    details: rawMsg
  };
}
