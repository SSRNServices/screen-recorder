import { describe, it, expect } from 'vitest';
import { isValidTransition, isValidNativeRequest } from '../src/schemas.js';

describe('isValidTransition', () => {
  it('allows valid transitions according to state machine', () => {
    expect(isValidTransition('IDLE', 'STARTING')).toBe(true);
    expect(isValidTransition('STARTING', 'RECORDING')).toBe(true);
    expect(isValidTransition('RECORDING', 'PAUSED')).toBe(true);
    expect(isValidTransition('PAUSED', 'RECORDING')).toBe(true);
    expect(isValidTransition('RECORDING', 'STOPPING')).toBe(true);
    expect(isValidTransition('STOPPING', 'COMPLETED')).toBe(true);
    expect(isValidTransition('COMPLETED', 'IDLE')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(isValidTransition('IDLE', 'RECORDING')).toBe(false);
    expect(isValidTransition('IDLE', 'STOPPING')).toBe(false);
    expect(isValidTransition('RECORDING', 'IDLE')).toBe(false);
    expect(isValidTransition('PAUSED', 'STARTING')).toBe(false);
  });

  it('allows same state transitions (no-op)', () => {
    expect(isValidTransition('RECORDING', 'RECORDING')).toBe(true);
  });
});

describe('isValidNativeRequest', () => {
  it('validates ping and get_capabilities requests', () => {
    expect(isValidNativeRequest({ type: 'ping', requestId: '123' })).toBe(true);
    expect(isValidNativeRequest({ type: 'get_capabilities', requestId: 'req-1' })).toBe(true);
  });

  it('rejects requests without requestId', () => {
    expect(isValidNativeRequest({ type: 'ping' })).toBe(false);
    expect(isValidNativeRequest({ type: 'ping', requestId: '' })).toBe(false);
  });

  it('validates process_recording requires input and output', () => {
    expect(
      isValidNativeRequest({
        type: 'process_recording',
        requestId: 'req-2',
        input: 'a.webm',
        output: 'b.mp4'
      })
    ).toBe(true);
    expect(
      isValidNativeRequest({
        type: 'process_recording',
        requestId: 'req-2',
        input: '',
        output: 'b.mp4'
      })
    ).toBe(false);
  });
});
