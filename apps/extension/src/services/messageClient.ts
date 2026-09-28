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
    const data = await chrome.storage.session.get('recording_snapshot');
    if (data.recording_snapshot) {
      return data.recording_snapshot as RecordingStatusSnapshot;
    }
  } catch (err) {
    console.warn('[MessageClient] Error reading storage:', err);
  }

  // Fallback to querying runtime
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_RECORDING_STATUS'
    } as ExtensionMessage);
    return response as RecordingStatusSnapshot | null;
  } catch {
    return null;
  }
}

export async function startRecording(config: RecordingConfig): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    return;
  }

  // Check if a recorder tab is already open
  const tabs = await chrome.tabs.query({
    url: chrome.runtime.getURL('recorder.html*')
  });

  const queryParams = new URLSearchParams({
    autostart: '1',
    source: config.source,
    mic: String(config.includeMic),
    audio: String(config.includeSystemAudio),
    quality: config.quality || 'high',
    fps: String(config.fps || 'auto'),
    resolution: config.resolution || 'source'
  });

  const recorderUrl = chrome.runtime.getURL(`recorder.html?${queryParams.toString()}`);

  if (tabs.length > 0 && tabs[0].id) {
    // Focus existing tab and send start message
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
    await chrome.runtime.sendMessage(message);
  } catch (err) {
    console.warn('[MessageClient] Failed to send command to runtime:', err);
  }
}
