import { describe, it, expect } from 'vitest';
import {
  calculateRecordingSettings,
  determineEffectiveResolution,
  determineEffectiveFps
} from './qualityCalculator.js';

describe('determineEffectiveResolution', () => {
  it('preserves native source resolution when resolution is "source"', () => {
    const res = determineEffectiveResolution(1920, 1080, 'source');
    expect(res).toEqual({ width: 1920, height: 1080 });

    const res4k = determineEffectiveResolution(3840, 2160, 'source');
    expect(res4k).toEqual({ width: 3840, height: 2160 });
  });

  it('never upscales if source resolution is lower than requested', () => {
    // 1080p source requested as 4k must remain 1080p
    const res4k = determineEffectiveResolution(1920, 1080, '2160p');
    expect(res4k).toEqual({ width: 1920, height: 1080 });

    // 1080p source requested as 1440p must remain 1080p
    const res1440 = determineEffectiveResolution(1920, 1080, '1440p');
    expect(res1440).toEqual({ width: 1920, height: 1080 });
  });

  it('correctly downscales when source resolution is higher than requested', () => {
    // 4k source requested as 1080p
    const res = determineEffectiveResolution(3840, 2160, '1080p');
    expect(res).toEqual({ width: 1920, height: 1080 });

    // 4k source requested as 1440p
    const res1440 = determineEffectiveResolution(3840, 2160, '1440p');
    expect(res1440).toEqual({ width: 2560, height: 1440 });
  });
});

describe('determineEffectiveFps', () => {
  it('handles 30 and 60 fps options', () => {
    expect(determineEffectiveFps(60, 30)).toBe(30);
    expect(determineEffectiveFps(60, 60)).toBe(60);
  });

  it('does not artificially force 60fps if source cannot support it', () => {
    expect(determineEffectiveFps(30, 60)).toBe(30);
  });

  it('auto selects 60fps for high refresh source, 30fps otherwise', () => {
    expect(determineEffectiveFps(60, 'auto')).toBe(60);
    expect(determineEffectiveFps(30, 'auto')).toBe(30);
  });
});

describe('calculateRecordingSettings', () => {
  it('calculates approximately 25 Mbps for 1080p30 on High profile', () => {
    const settings = calculateRecordingSettings({
      sourceWidth: 1920,
      sourceHeight: 1080,
      sourceFps: 30,
      qualityProfile: 'high',
      fpsOption: 30,
      resolutionOption: 'source'
    });

    expect(settings.targetWidth).toBe(1920);
    expect(settings.targetHeight).toBe(1080);
    expect(settings.targetFps).toBe(30);
    // Base 25 Mbps * 1.0 (30fps) = 25 Mbps (25,000,000)
    expect(settings.videoBitsPerSecond).toBe(25_000_000);
    expect(settings.audioBitsPerSecond).toBe(256_000);
    expect(settings.lowQualityWarning).toBe(false);
  });

  it('applies FPS multiplier for 1080p60 on High profile (~31.25 Mbps)', () => {
    const settings = calculateRecordingSettings({
      sourceWidth: 1920,
      sourceHeight: 1080,
      sourceFps: 60,
      qualityProfile: 'high',
      fpsOption: 60,
      resolutionOption: 'source'
    });

    expect(settings.targetFps).toBe(60);
    // Base 25 Mbps * 1.25 = 31,250,000 bps
    expect(settings.videoBitsPerSecond).toBe(31_250_000);
  });

  it('calculates approximately 40 Mbps for 1440p30 and 60 Mbps for 4K30 on High profile', () => {
    const settings1440 = calculateRecordingSettings({
      sourceWidth: 2560,
      sourceHeight: 1440,
      sourceFps: 30,
      qualityProfile: 'high',
      fpsOption: 30,
      resolutionOption: 'source'
    });
    expect(settings1440.videoBitsPerSecond).toBe(40_000_000);

    const settings4k = calculateRecordingSettings({
      sourceWidth: 3840,
      sourceHeight: 2160,
      sourceFps: 30,
      qualityProfile: 'high',
      fpsOption: 30,
      resolutionOption: 'source'
    });
    expect(settings4k.videoBitsPerSecond).toBe(60_000_000);
  });

  it('flags lowQualityWarning when source is under 1280x720', () => {
    const settings = calculateRecordingSettings({
      sourceWidth: 1024,
      sourceHeight: 768,
      sourceFps: 30,
      qualityProfile: 'high',
      fpsOption: 'auto',
      resolutionOption: 'source'
    });

    expect(settings.lowQualityWarning).toBe(true);
  });
});
