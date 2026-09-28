import type {
  ExtensionMessage,
  RecordingConfig,
  RecordingStatusSnapshot
} from '@screenrecorder/protocol';

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
    console.warn('[MessageClient] Error reading storage:', err);
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

export async function startRecording(config: RecordingConfig): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    throw new Error('Chrome tabs API is not available.');
  }

  // 1. Identify the current active tab (user context)
  let activeTab: chrome.tabs.Tab | undefined;
  try {
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = activeTabs[0];
  } catch (err) {
    console.warn('[MessageClient] Error querying active tab:', err);
  }

  // 2. Locate or create the dedicated recorder tab
  let recorderTab: chrome.tabs.Tab;
  const existingTabs = await chrome.tabs.query({
    url: chrome.runtime.getURL('recorder.html*')
  });

  if (existingTabs.length > 0 && existingTabs[0].id) {
    recorderTab = existingTabs[0];
  } else {
    // Create recorder tab in background so current active tab stays active
    recorderTab = await chrome.tabs.create({
      url: chrome.runtime.getURL('recorder.html'),
      active: false
    });
  }

  let streamId: string | undefined;
  let captureMethod: 'desktop' | 'tab' = 'desktop';
  let canRequestAudioTrack = false;
  let targetTabId: number | undefined;
  let targetTabUrl: string | undefined;

  // 3. Acquire capture stream based on specific selected source
  if (config.source === 'tab') {
    // Validate target tab strictly
    const validation = validateTargetTab(activeTab);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    targetTabId = validation.tabId;
    targetTabUrl = validation.url;

    if (chrome.tabCapture?.getMediaStreamId) {
      streamId = await new Promise<string>((resolve, reject) => {
        chrome.tabCapture.getMediaStreamId(
          { targetTabId: validation.tabId, consumerTabId: recorderTab.id },
          (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!id) {
              reject(new Error('Tab capture was cancelled or unavailable.'));
            } else {
              resolve(id);
            }
          }
        );
      });
      captureMethod = 'tab';
      canRequestAudioTrack = true;
    } else {
      throw new Error('Tab capture API is not available.');
    }
  } else {
    // Screen or Window capture
    if (!chrome.desktopCapture?.chooseDesktopMedia) {
      throw new Error('Desktop capture API is not available.');
    }

    const sources = config.source === 'window' ? ['window'] : ['screen'];
    if (config.includeSystemAudio) {
      sources.push('audio');
    }
    const cancelMsg = config.source === 'window' ? 'Window capture was cancelled.' : 'Screen capture was cancelled.';

    const result = await new Promise<{ streamId: string; canRequestAudioTrack: boolean }>((resolve, reject) => {
      // NOTE: Do not pass targetTab here. When targetTab is omitted, the stream capability is granted
      // to the calling extension. Passing an extension tab without a finalized HTTP URL causes Chromium
      // to fail with "targetTab.url is not a valid URL".
      chrome.desktopCapture.chooseDesktopMedia(sources, (id, options) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!id) {
          reject(new Error(cancelMsg));
        } else {
          resolve({
            streamId: id,
            canRequestAudioTrack: Boolean(options?.canRequestAudioTrack)
          });
        }
      });
    });

    streamId = result.streamId;
    captureMethod = 'desktop';
    canRequestAudioTrack = result.canRequestAudioTrack;
  }

  if (!streamId) {
    const defaultCancel = config.source === 'window'
      ? 'Window capture was cancelled.'
      : config.source === 'tab'
        ? 'Tab capture was cancelled.'
        : 'Screen capture was cancelled.';
    throw new Error(defaultCancel);
  }

  // 4. Update recorder tab with explicit capture parameters
  const queryParams = new URLSearchParams({
    autostart: '1',
    source: config.source,
    mic: String(config.includeMic),
    audio: String(config.includeSystemAudio),
    quality: config.quality || 'high',
    fps: String(config.fps || 'auto'),
    resolution: config.resolution || 'source',
    captureMethod,
    canAudio: String(canRequestAudioTrack),
    streamId
  });

  if (targetTabId) {
    queryParams.set('targetTabId', String(targetTabId));
  }
  if (targetTabUrl) {
    queryParams.set('targetTabUrl', encodeURIComponent(targetTabUrl));
  }

  const recorderUrl = chrome.runtime.getURL(`recorder.html?${queryParams.toString()}`);
  await chrome.tabs.update(recorderTab.id!, { active: true, url: recorderUrl });
}

export async function sendCommand(message: ExtensionMessage): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    return;
  }

  try {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 2000);
      chrome.runtime.sendMessage(message, () => {
        clearTimeout(timer);
        resolve();
      });
    });
  } catch (err) {
    console.warn('[MessageClient] Failed to send command to runtime:', err);
  }
}
