/**
 * Generate a timestamped recording filename:
 * ScreenRecorder-YYYY-MM-DD-HH-mm-ss.webm
 */
export function generateRecordingFilename(date: Date = new Date(), extension = 'webm'): string {
  const pad = (n: number) => n.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  const cleanExt = extension.replace(/^\./, '');
  return `ScreenRecorder-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.${cleanExt}`;
}
