import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDuration } from './formatTime.js';
import { generateRecordingFilename } from './generateFilename.js';
import { RecordingTimer } from '../recorder/timer.js';

describe('formatDuration', () => {
  it('formats 0 ms as 00:00:00', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  it('formats seconds correctly', () => {
    expect(formatDuration(5000)).toBe('00:00:05');
    expect(formatDuration(45000)).toBe('00:00:45');
  });

  it('formats minutes and hours', () => {
    expect(formatDuration(65000)).toBe('00:01:05');
    expect(formatDuration(3665000)).toBe('01:01:05');
  });

  it('handles negative or invalid inputs gracefully', () => {
    expect(formatDuration(-100)).toBe('00:00:00');
    expect(formatDuration(NaN)).toBe('00:00:00');
  });
});

describe('generateRecordingFilename', () => {
  it('generates filename matching ScreenRecorder-YYYY-MM-DD-HH-mm-ss.webm', () => {
    const fixedDate = new Date(2026, 8, 28, 14, 30, 45); // Month is 0-indexed: 8 = September
    const filename = generateRecordingFilename(fixedDate, 'webm');
    expect(filename).toBe('ScreenRecorder-2026-09-28-14-30-45.webm');
  });
});

describe('RecordingTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks elapsed time accurately without drifting', () => {
    const timer = new RecordingTimer();
    const startEpoch = 1000000;
    vi.setSystemTime(startEpoch);

    timer.start(startEpoch);
    expect(timer.getElapsedMs()).toBe(0);

    vi.setSystemTime(startEpoch + 5000);
    expect(timer.getElapsedMs()).toBe(5000);

    // Pause at 5s
    timer.pause(startEpoch + 5000);

    // Advance time by 3s while paused
    vi.setSystemTime(startEpoch + 8000);
    expect(timer.getElapsedMs()).toBe(5000); // Must remain 5s

    // Resume at 8s
    timer.resume(startEpoch + 8000);

    // Advance time by 2s
    vi.setSystemTime(startEpoch + 10000);
    expect(timer.getElapsedMs()).toBe(7000); // 5s + 2s

    const finalTime = timer.stop();
    expect(finalTime).toBe(7000);
  });
});

describe('validateTargetTab', () => {
  it('validates standard https web tab successfully', async () => {
    const { validateTargetTab } = await import('../services/messageClient.js');
    const result = validateTargetTab({
      id: 101,
      url: 'https://example.com/dashboard'
    } as unknown as chrome.tabs.Tab);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.tabId).toBe(101);
      expect(result.url).toBe('https://example.com/dashboard');
    }
  });

  it('rejects undefined or missing tab', async () => {
    const { validateTargetTab } = await import('../services/messageClient.js');
    const result = validateTargetTab(undefined);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('No active tab found');
    }
  });

  it('rejects tab with missing or invalid URL', async () => {
    const { validateTargetTab } = await import('../services/messageClient.js');
    const result = validateTargetTab({ id: 102, url: '' } as unknown as chrome.tabs.Tab);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('URL is not available');
    }
  });

  it('rejects restricted chrome:// pages with clear error', async () => {
    const { validateTargetTab } = await import('../services/messageClient.js');
    const result = validateTargetTab({ id: 103, url: 'chrome://extensions/' } as unknown as chrome.tabs.Tab);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('restricted browser pages (chrome://)');
    }
  });

  it('rejects restricted chrome-extension:// pages with clear error', async () => {
    const { validateTargetTab } = await import('../services/messageClient.js');
    const result = validateTargetTab({ id: 104, url: 'chrome-extension://abcdef/popup.html' } as unknown as chrome.tabs.Tab);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('restricted browser pages (chrome-extension://)');
    }
  });

  it('rejects about:blank pages', async () => {
    const { validateTargetTab } = await import('../services/messageClient.js');
    const result = validateTargetTab({ id: 105, url: 'about:blank' } as unknown as chrome.tabs.Tab);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('restricted browser pages (about:)');
    }
  });
});

