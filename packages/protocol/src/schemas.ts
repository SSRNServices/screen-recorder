import type { RecordingState, NativeRequest } from './messages.js';

/**
 * Valid state transitions for the recording state machine.
 */
export const VALID_RECORDING_TRANSITIONS: Record<RecordingState, RecordingState[]> = {
  IDLE: ['STARTING', 'ERROR'],
  STARTING: ['RECORDING', 'ERROR', 'IDLE'],
  RECORDING: ['PAUSED', 'STOPPING', 'ERROR'],
  PAUSED: ['RECORDING', 'STOPPING', 'ERROR'],
  STOPPING: ['PROCESSING', 'COMPLETED', 'ERROR'],
  PROCESSING: ['COMPLETED', 'ERROR'],
  COMPLETED: ['IDLE', 'STARTING'],
  ERROR: ['IDLE', 'STARTING']
};

/**
 * Validate whether a state transition is legal.
 */
export function isValidTransition(from: RecordingState, to: RecordingState): boolean {
  if (from === to) return true;
  const allowed = VALID_RECORDING_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Validate native requests sent to native host.
 */
export function isValidNativeRequest(obj: unknown): obj is NativeRequest {
  if (!obj || typeof obj !== 'object') return false;
  const req = obj as Record<string, unknown>;
  if (typeof req.requestId !== 'string' || req.requestId.trim() === '') return false;
  if (typeof req.type !== 'string') return false;

  switch (req.type) {
    case 'ping':
    case 'get_capabilities':
      return true;
    case 'process_recording':
      return (
        typeof req.input === 'string' &&
        req.input.length > 0 &&
        typeof req.output === 'string' &&
        req.output.length > 0
      );
    case 'get_processing_status':
    case 'cancel_processing':
      return typeof req.jobId === 'string' && req.jobId.length > 0;
    default:
      return false;
  }
}
