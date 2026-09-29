import { describe, it, expect } from 'vitest';
import {
  serializeError,
  createCaptureError,
  classifyCaptureError
} from './errors.js';

describe('serializeError', () => {
  it('serializes standard Error properly without producing [object Object]', () => {
    const error = new Error('Permission was denied');
    error.name = 'NotAllowedError';
    const serialized = serializeError(error);

    expect(serialized.name).toBe('NotAllowedError');
    expect(serialized.message).toBe('Permission was denied');
    expect(serialized.stack).toBeDefined();
    expect(typeof serialized.stack).toBe('string');
  });

  it('handles null and undefined gracefully', () => {
    expect(serializeError(null)).toEqual({
      name: 'UnknownError',
      message: 'Unknown error',
      stack: null
    });
    expect(serializeError(undefined)).toEqual({
      name: 'UnknownError',
      message: 'Unknown error',
      stack: null
    });
  });

  it('handles custom error objects and constraints', () => {
    const custom = {
      name: 'OverconstrainedError',
      message: 'Width too large',
      constraint: 'width'
    };
    const serialized = serializeError(custom);
    expect(serialized.name).toBe('OverconstrainedError');
    expect(serialized.message).toBe('Width too large');
    expect(serialized.constraint).toBe('width');
  });

  it('handles nested causes recursively', () => {
    const root = new Error('Root cause');
    const wrapper = new Error('Wrapper', { cause: root });
    const serialized = serializeError(wrapper);

    expect(serialized.message).toBe('Wrapper');
    expect(serialized.cause?.message).toBe('Root cause');
  });
});

describe('classifyCaptureError', () => {
  it('classifies user cancellation when message mentions cancel or dismiss', () => {
    const cancelErr = new Error('User dismissed the picker');
    const result = classifyCaptureError(cancelErr, 'screen');

    expect(result.code).toBe('USER_CANCELLED');
    expect(result.message).toBe('Recording cancelled. No capture source was selected.');
  });

  it('classifies NotAllowedError as PERMISSION_DENIED', () => {
    const deniedErr = new Error('Permission denied by user');
    deniedErr.name = 'NotAllowedError';
    const result = classifyCaptureError(deniedErr, 'screen');

    expect(result.code).toBe('PERMISSION_DENIED');
    expect(result.message).toBe('Screen capture permission was denied.');
  });

  it('classifies expired stream ID appropriately', () => {
    const expiredErr = new Error('Invalid stream id: token expired');
    const result = classifyCaptureError(expiredErr, 'tab');

    expect(result.code).toBe('STREAM_ID_EXPIRED');
    expect(result.message).toContain('expired');
  });

  it('preserves typed CaptureError instances', () => {
    const typed = createCaptureError(
      'NO_LIVE_VIDEO_TRACK',
      'No live video track received from display capture.'
    );
    const result = classifyCaptureError(typed);

    expect(result.code).toBe('NO_LIVE_VIDEO_TRACK');
    expect(result.message).toBe('No live video track received from display capture.');
  });
});
