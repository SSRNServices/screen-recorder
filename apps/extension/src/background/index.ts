import type { ExtensionMessage, RecordingStatusSnapshot } from '@screenrecorder/protocol';
import { logger } from '../utils/logger.js';

logger.log('START', { component: 'ServiceWorker' });

// Enable session storage access in all extension contexts (popup, recorder tab)
if (typeof chrome !== 'undefined' && chrome.storage?.session?.setAccessLevel) {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch((err) => {
    logger.warn('Failed to set session storage access level', { error: String(err) });
  });
}

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
      logger.warn('Failed to store snapshot in session', { error: String(err) });
    });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'GET_RECORDING_STATUS') {
    chrome.storage.session.get('recording_snapshot').then((data) => {
      sendResponse(data.recording_snapshot || null);
    }).catch((err) => {
      logger.error('FAILURE', err, { stage: 'START', note: 'Error retrieving snapshot' });
      sendResponse(null);
    });
    return true; // async sendResponse
  }

  if (message.type === 'GET_TAB_STREAM_ID') {
    if (chrome.tabCapture?.getMediaStreamId) {
      chrome.tabCapture.getMediaStreamId(
        { targetTabId: message.targetTabId, consumerTabId: message.consumerTabId },
        (streamId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ streamId: null, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ streamId, error: null });
          }
        }
      );
    } else {
      sendResponse({ streamId: null, error: 'tabCapture API unavailable in service worker' });
    }
    return true; // async sendResponse
  }

  // Forward recording lifecycle commands from popup to active recorder tab
  if (
    message.type === 'STOP_RECORDING' ||
    message.type === 'PAUSE_RECORDING' ||
    message.type === 'RESUME_RECORDING' ||
    message.type === 'RESET_RECORDING'
  ) {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ url: chrome.runtime.getURL('recorder.html*') }).then((tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, message).catch(() => {});
          }
        }
        sendResponse({ ok: true });
      }).catch(() => {
        sendResponse({ ok: false });
      });
      return true; // async sendResponse
    }
  }

  sendResponse({ ok: true });
  return false;
});

// Restore badge on service worker startup
chrome.storage.session.get('recording_snapshot').then((data) => {
  if (data.recording_snapshot) {
    const snapshot = data.recording_snapshot as RecordingStatusSnapshot;
    updateBadge(snapshot.state);
  }
}).catch((err) => {
  logger.warn('Startup session read error', { error: String(err) });
});
