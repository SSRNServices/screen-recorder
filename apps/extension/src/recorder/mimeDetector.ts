/**
 * Detect the optimal supported MediaRecorder MIME type dynamically.
 */
export const CANDIDATE_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=h264,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4'
];

export function getSupportedMimeType(preferred?: string): string {
  if (typeof MediaRecorder === 'undefined') {
    return 'video/webm';
  }

  if (preferred && MediaRecorder.isTypeSupported(preferred)) {
    return preferred;
  }

  for (const candidate of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return '';
}

export function getAllSupportedMimeTypes(): string[] {
  if (typeof MediaRecorder === 'undefined') {
    return [];
  }
  return CANDIDATE_MIME_TYPES.filter((type) => MediaRecorder.isTypeSupported(type));
}
