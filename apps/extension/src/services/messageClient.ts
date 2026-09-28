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

export async function startRecording(config: RecordingConfig): Promise<void> {
  if (typeof chrome === 'undefined') {
    return;
  }

  let streamId: string | undefined = undefined;

  // If chrome.desktopCapture is available in this user-gesture context, request source selection
  if (chrome.desktopCapture?.chooseDesktopMedia) {
    const sources = ['screen', 'window', 'tab'];
    if (config.includeSystemAudio) {
      sources.push('audio');
    }

    streamId = await new Promise<string>((resolve, reject) => {
      try {
        chrome.desktopCapture.chooseDesktopMedia(sources, (id) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!id) {
            reject(new Error('Screen capture was cancelled.'));
          } else {
            resolve(id);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  if (!chrome.tabs) {
    throw new Error('Chrome tabs API is not available.');
  }

  // Check if a recorder tab is already open
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({
      url: chrome.runtime.getURL('recorder.html*')
    });
  } catch (err) {
    console.warn('[MessageClient] Error querying recorder tabs:', err);
  }

  const queryParams = new URLSearchParams({
    autostart: '1',
    source: config.source,
    mic: String(config.includeMic),
    audio: String(config.includeSystemAudio),
    quality: config.quality || 'high',
    fps: String(config.fps || 'auto'),
    resolution: config.resolution || 'source'
  });

  if (streamId) {
    queryParams.set('streamId', streamId);
  }

  const recorderUrl = chrome.runtime.getURL(`recorder.html?${queryParams.toString()}`);

  if (tabs.length > 0 && tabs[0].id) {
    // Focus existing tab and update URL with new parameters
    await chrome.tabs.update(tabs[0].id, { active: true, url: recorderUrl });
  } else {
    // Open dedicated recorder tab
    await chrome.tabs.create({
      url: recorderUrl,
      active: true
    });
  }
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
