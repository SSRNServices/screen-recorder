import type { ExtensionMessage, RecordingStatusSnapshot } from '@screenrecorder/protocol';

console.log('[ScreenRecorder Service Worker] Initializing...');

// Update action badge based on state
function updateBadge(state: string): void {
  if (typeof chrome === 'undefined' || !chrome.action) return;

  if (state === 'RECORDING') {
    chrome.action.setBadgeText({ text: 'REC' });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
  } else if (state === 'PAUSED') {
    chrome.action.setBadgeText({ text: 'PAUSE' });
    chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Listen for messages from popup or recorder tabs
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'RECORDING_STATUS_UPDATE') {
    updateBadge(message.snapshot.state);
    chrome.storage.session.set({ recording_snapshot: message.snapshot }).catch((err) => {
      console.warn('[Service Worker] Failed to store snapshot:', err);
    });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'GET_RECORDING_STATUS') {
    chrome.storage.session.get('recording_snapshot').then((data) => {
      sendResponse(data.recording_snapshot || null);
    }).catch((err) => {
      console.error('[Service Worker] Error retrieving snapshot:', err);
      sendResponse(null);
    });
    return true; // async sendResponse
  }

  return false;
});

// Restore badge on service worker startup
chrome.storage.session.get('recording_snapshot').then((data) => {
  if (data.recording_snapshot) {
    const snapshot = data.recording_snapshot as RecordingStatusSnapshot;
    updateBadge(snapshot.state);
  }
}).catch((err) => {
  console.warn('[Service Worker] Startup session read error:', err);
});
