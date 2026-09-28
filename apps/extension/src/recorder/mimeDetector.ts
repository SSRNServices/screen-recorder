/**
 * Detect the optimal supported MediaRecorder MIME type dynamically.
 */
export interface SupportedCodecResult {
  mimeType: string;
  codec: string;
}

export const CANDIDATE_CODECS_AUDIO: Array<{ mimeType: string; codec: string }> = [
  { mimeType: 'video/webm;codecs=vp9,opus', codec: 'VP9' },
  { mimeType: 'video/webm;codecs=vp8,opus', codec: 'VP8' },
  { mimeType: 'video/webm;codecs=h264,opus', codec: 'H.264' },
  { mimeType: 'video/webm;codecs=av01,opus', codec: 'AV1' },
  { mimeType: 'video/webm;codecs=vp9', codec: 'VP9' },
  { mimeType: 'video/webm;codecs=vp8', codec: 'VP8' },
  { mimeType: 'video/webm', codec: 'WebM' }
];

export const CANDIDATE_CODECS_VIDEO_ONLY: Array<{ mimeType: string; codec: string }> = [
  { mimeType: 'video/webm;codecs=vp9', codec: 'VP9' },
  { mimeType: 'video/webm;codecs=vp8', codec: 'VP8' },
  { mimeType: 'video/webm;codecs=h264', codec: 'H.264' },
  { mimeType: 'video/webm;codecs=av01', codec: 'AV1' },
  { mimeType: 'video/webm', codec: 'WebM' }
];

export function getBestSupportedMimeType(preferred?: string, hasAudio = true): SupportedCodecResult {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', codec: 'WebM' };
  }

  if (preferred && MediaRecorder.isTypeSupported(preferred)) {
    return {
      mimeType: preferred,
      codec: parseCodecFromMime(preferred)
    };
  }

  const candidates = hasAudio ? CANDIDATE_CODECS_AUDIO : CANDIDATE_CODECS_VIDEO_ONLY;

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      console.info(`[mimeDetector] Selected optimal codec (hasAudio=${hasAudio}): ${candidate.codec} (${candidate.mimeType})`);
      return candidate;
    }
  }

  return { mimeType: '', codec: 'Unknown' };
}

export function parseCodecFromMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('vp9')) return 'VP9';
  if (lower.includes('vp8')) return 'VP8';
  if (lower.includes('h264') || lower.includes('avc1')) return 'H.264';
  if (lower.includes('av01') || lower.includes('av1')) return 'AV1';
  return 'WebM';
}

export function getAllSupportedMimeTypes(): string[] {
  if (typeof MediaRecorder === 'undefined') {
    return [];
  }
  return CANDIDATE_CODECS_AUDIO
    .filter((c) => MediaRecorder.isTypeSupported(c.mimeType))
    .map((c) => c.mimeType);
}

// Backward compatibility alias
export function getSupportedMimeType(preferred?: string, hasAudio = true): string {
  return getBestSupportedMimeType(preferred, hasAudio).mimeType;
}
