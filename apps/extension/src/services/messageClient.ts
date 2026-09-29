import type {
  ExtensionMessage,
  RecordingConfig,
  RecordingStatusSnapshot
} from '@screenrecorder/protocol';
import { logger } from '../utils/logger.js';

export async function getRecordingStatus(): Promise<RecordingStatusSnapshot | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    return null;
  }

  try {
    // Check session storage first
    if (chrome.storage?.session) {
      const data = await chrome.storage.session.get('recording_snapshot');
      if (data?.recording_snapshot) {
        return data.recording_snapshot as RecordingStatusSnapshot;
      }
    }
  } catch (err) {
    logger.warn('Error reading storage in getRecordingStatus', { error: String(err) });
  }

  // Fallback to querying runtime with timeout
  try {
    const response = await new Promise<RecordingStatusSnapshot | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 1500);
      chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' } as ExtensionMessage, (res) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve((res as RecordingStatusSnapshot) || null);
        }
      });
    });
    return response;
  } catch {
    return null;
  }
}

/**
 * Validate that targetTab is a real, accessible tab suitable for tab capture.
 */
export function validateTargetTab(tab: chrome.tabs.Tab | undefined): { valid: true; tabId: number; url: string } | { valid: false; error: string } {
  if (!tab) {
    return { valid: false, error: 'No active tab found to capture.' };
  }
  if (typeof tab.id !== 'number') {
    return { valid: false, error: 'Active tab has no valid identifier.' };
  }
  if (!tab.url || typeof tab.url !== 'string' || tab.url.trim() === '') {
    return { valid: false, error: 'Active tab URL is not available. Please allow page to finish loading.' };
  }

  const urlLower = tab.url.toLowerCase();
  const restrictedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'devtools://',
    'view-source:',
    'opera://',
    'brave://'
  ];

  for (const prefix of restrictedPrefixes) {
    if (urlLower.startsWith(prefix)) {
      return {
        valid: false,
        error: `Cannot record restricted browser pages (${prefix}). Please navigate to a standard web page and try again.`
      };
    }
  }

  try {
    const parsed = new URL(tab.url);
    if (!parsed.protocol.startsWith('http')) {
      return {
        valid: false,
        error: `Cannot record pages with protocol "${parsed.protocol}". Please navigate to a standard web page and try again.`
      };
    }
  } catch {
    return { valid: false, error: 'Target tab URL is not a valid URL.' };
  }

  return { valid: true, tabId: tab.id, url: tab.url };
}

/**
 * Wait until recorder tab is loaded and responds to PING handshake.
 */
async function waitForRecorderTabReady(tabId: number, timeoutMs = 6000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await new Promise<{ ready?: boolean } | null>((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: 'PING' } as ExtensionMessage, (res) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(res);
          }
        });
      });
      if (response && response.ready) {
        return true;
      }
    } catch {
      // Tab not ready yet, continue polling
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

export async function startRecording(config: RecordingConfig): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    throw new Error('Chrome tabs API is not available.');
  }

  const recordingConfig: RecordingConfig = { ...config };

  // 1. If Tab capture, validate the active tab before opening or focusing recorder
  if (recordingConfig.source === 'tab') {
    let activeTab: chrome.tabs.Tab | undefined;
    try {
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      activeTab = activeTabs[0];
    } catch (err) {
      logger.warn('Error querying active tab for tab capture', { error: String(err) });
    }

    const validation = validateTargetTab(activeTab);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    recordingConfig.targetTabId = validation.tabId;
    recordingConfig.targetTabUrl = validation.url;
  }

  // 2. Locate or create the dedicated recorder tab
  let recorderTab: chrome.tabs.Tab;
  const existingTabs = await chrome.tabs.query({
    url: chrome.runtime.getURL('recorder.html*')
  });

  if (existingTabs.length > 0 && typeof existingTabs[0].id === 'number') {
    recorderTab = existingTabs[0];
    await chrome.tabs.update(recorderTab.id!, { active: true });
  } else {
    recorderTab = await chrome.tabs.create({
      url: chrome.runtime.getURL('recorder.html'),
      active: true
    });
  }

  if (!recorderTab.id) {
    throw new Error('Failed to create or focus recorder tab.');
  }

  // 3. Establish communication handshake with recorder tab
  const isReady = await waitForRecorderTabReady(recorderTab.id);
  if (!isReady) {
    throw new Error('Recorder tab failed to initialize ready state within timeout.');
  }

  // 4. Send START_RECORDING message directly to recorder tab
  // (NO streamId in URL query string, NO race conditions, direct IPC)
  await new Promise<void>((resolve, reject) => {
    chrome.tabs.sendMessage(
      recorderTab.id!,
      {
        type: 'START_RECORDING',
        config: recordingConfig
      } as ExtensionMessage,
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.ok === false) {
          reject(new Error(response.error || 'Failed to start recording in recorder session.'));
        } else {
          resolve();
        }
      }
    );
  });
}

export async function sendCommand(message: ExtensionMessage): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    return;
  }

  // Send to runtime first
  try {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 2000);
      chrome.runtime.sendMessage(message, () => {
        clearTimeout(timer);
        resolve();
      });
    });
  } catch (err) {
    logger.warn('Failed to send command to runtime, attempting direct tabs dispatch', { error: String(err) });
  }

  // Also dispatch directly to any open recorder tabs
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    try {
      const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('recorder.html*') });
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        }
      }
    } catch {
      // Ignore
    }
  }
}
