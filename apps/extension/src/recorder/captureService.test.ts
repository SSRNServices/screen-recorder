import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureMedia } from './captureService.js';
import type { RecordingConfig } from '@screenrecorder/protocol';

describe('captureMedia', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unsupported recording sources with INVALID_SOURCE', async () => {
    const invalidConfig = {
      source: 'invalid_source' as unknown,
      includeMic: false,
      includeSystemAudio: true,
      quality: 'high',
      fps: 'auto',
      resolution: 'source'
    } as RecordingConfig;

    await expect(captureMedia(invalidConfig)).rejects.toThrow('Unsupported recording source');
  });

  it('rejects tab capture when targetTabId is missing', async () => {
    const tabConfig: RecordingConfig = {
      source: 'tab',
      includeMic: false,
      includeSystemAudio: true,
      quality: 'high',
      fps: 'auto',
      resolution: 'source'
    };

    await expect(captureMedia(tabConfig)).rejects.toThrow('No active web tab identified');
  });
});
