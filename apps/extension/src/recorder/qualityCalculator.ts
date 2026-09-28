import type { QualityProfile, FpsOption, ResolutionOption } from '@screenrecorder/protocol';

export interface QualityCalculationInput {
  sourceWidth: number;
  sourceHeight: number;
  sourceFps: number;
  qualityProfile: QualityProfile;
  fpsOption: FpsOption;
  resolutionOption: ResolutionOption;
}

export interface CalculatedRecordingSettings {
  targetWidth: number;
  targetHeight: number;
  targetFps: number;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  lowQualityWarning: boolean;
}

const PIXELS_1080P = 1920 * 1080; // 2,073,600
const PIXELS_1440P = 2560 * 1440; // 3,686,400
const PIXELS_4K = 3840 * 2160; // 8,294,400

const PROFILE_BASE_BITRATES: Record<QualityProfile, { p1080: number; p1440: number; p4k: number; audio: number; min: number; max: number }> = {
  standard: {
    p1080: 18_000_000, // 18 Mbps
    p1440: 28_000_000, // 28 Mbps
    p4k: 45_000_000,   // 45 Mbps
    audio: 192_000,    // 192 kbps
    min: 8_000_000,
    max: 55_000_000
  },
  high: {
    p1080: 25_000_000, // 25 Mbps
    p1440: 40_000_000, // 40 Mbps
    p4k: 60_000_000,   // 60 Mbps
    audio: 256_000,    // 256 kbps
    min: 12_000_000,
    max: 75_000_000
  },
  ultra: {
    p1080: 35_000_000, // 35 Mbps
    p1440: 50_000_000, // 50 Mbps
    p4k: 80_000_000,   // 80 Mbps
    audio: 256_000,    // 256 kbps
    min: 16_000_000,
    max: 95_000_000
  }
};

/**
 * Determine effective resolution based on source dimensions and user selection.
 * Never upscales source content.
 */
export function determineEffectiveResolution(
  sourceWidth: number,
  sourceHeight: number,
  resolutionOption: ResolutionOption
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: 1920, height: 1080 };
  }

  if (resolutionOption === 'source') {
    return { width: sourceWidth, height: sourceHeight };
  }

  const aspectRatio = sourceWidth / sourceHeight;
  let maxW = sourceWidth;
  let maxH = sourceHeight;

  if (resolutionOption === '1080p') {
    maxW = 1920;
    maxH = 1080;
  } else if (resolutionOption === '1440p') {
    maxW = 2560;
    maxH = 1440;
  } else if (resolutionOption === '2160p') {
    maxW = 3840;
    maxH = 2160;
  }

  // Only downscale if the source is larger than the requested bounds.
  // NEVER upscale!
  if (sourceWidth > maxW || sourceHeight > maxH) {
    if (sourceWidth / maxW > sourceHeight / maxH) {
      const targetWidth = maxW;
      const targetHeight = Math.round(maxW / aspectRatio);
      // Ensure even dimensions for video codecs
      return { width: targetWidth - (targetWidth % 2), height: targetHeight - (targetHeight % 2) };
    } else {
      const targetHeight = maxH;
      const targetWidth = Math.round(maxH * aspectRatio);
      return { width: targetWidth - (targetWidth % 2), height: targetHeight - (targetHeight % 2) };
    }
  }

  return { width: sourceWidth, height: sourceHeight };
}

/**
 * Determine target frame rate.
 */
export function determineEffectiveFps(sourceFps: number, fpsOption: FpsOption): number {
  if (fpsOption === 30) return 30;
  if (fpsOption === 60) {
    // If source cannot provide more than 35 fps, don't fake 60 fps
    return sourceFps > 0 && sourceFps <= 35 ? Math.round(sourceFps) : 60;
  }
  // 'auto': use actual source fps (or 60 if available/high refresh)
  if (sourceFps >= 50) return 60;
  if (sourceFps > 0) return Math.round(sourceFps);
  return 30;
}

/**
 * Calculate dynamic bitrate for high-detail screen recording.
 */
export function calculateRecordingSettings(input: QualityCalculationInput): CalculatedRecordingSettings {
  const { width: targetWidth, height: targetHeight } = determineEffectiveResolution(
    input.sourceWidth,
    input.sourceHeight,
    input.resolutionOption
  );

  const targetFps = determineEffectiveFps(input.sourceFps, input.fpsOption);
  const totalPixels = targetWidth * targetHeight;
  const profile = PROFILE_BASE_BITRATES[input.qualityProfile] || PROFILE_BASE_BITRATES.high;

  // 1. Calculate baseline bitrate based on pixel density
  let baseBitrate: number;
  if (totalPixels <= PIXELS_1080P) {
    // Scale smoothly from 720p to 1080p
    const ratio = Math.max(0.4, totalPixels / PIXELS_1080P);
    baseBitrate = profile.p1080 * ratio;
  } else if (totalPixels <= PIXELS_1440P) {
    const fraction = (totalPixels - PIXELS_1080P) / (PIXELS_1440P - PIXELS_1080P);
    baseBitrate = profile.p1080 + fraction * (profile.p1440 - profile.p1080);
  } else if (totalPixels <= PIXELS_4K) {
    const fraction = (totalPixels - PIXELS_1440P) / (PIXELS_4K - PIXELS_1440P);
    baseBitrate = profile.p1440 + fraction * (profile.p4k - profile.p1440);
  } else {
    // Beyond 4K
    const ratio = Math.min(1.3, totalPixels / PIXELS_4K);
    baseBitrate = profile.p4k * ratio;
  }

  // 2. FPS-aware multiplier
  const fpsMultiplier =
    targetFps >= 55 ? 1.25 :
    targetFps >= 45 ? 1.15 :
    targetFps >= 25 ? 1.0 :
    0.85;

  const rawVideoBps = Math.round(baseBitrate * fpsMultiplier);
  const clampedVideoBps = Math.max(profile.min, Math.min(profile.max, rawVideoBps));

  // 3. Low quality condition check (width < 1280 or height < 720)
  const lowQualityWarning = input.sourceWidth > 0 && (input.sourceWidth < 1280 || input.sourceHeight < 720);

  return {
    targetWidth,
    targetHeight,
    targetFps,
    videoBitsPerSecond: clampedVideoBps,
    audioBitsPerSecond: profile.audio,
    lowQualityWarning
  };
}
