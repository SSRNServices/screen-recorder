import type { RecordingConfig } from '@screenrecorder/protocol';

export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
  source: 'screen',
  includeMic: false,
  includeSystemAudio: true,
  quality: 'high',
  fps: 'auto',
  resolution: 'source'
};

const SETTINGS_STORAGE_KEY = 'screenrecorder_settings';

export async function loadSavedSettings(): Promise<RecordingConfig> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return { ...DEFAULT_RECORDING_CONFIG };
  }

  try {
    const data = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    if (data[SETTINGS_STORAGE_KEY]) {
      return {
        ...DEFAULT_RECORDING_CONFIG,
        ...(data[SETTINGS_STORAGE_KEY] as Partial<RecordingConfig>)
      };
    }
  } catch (err) {
    console.warn('[SettingsService] Failed to load settings from storage:', err);
  }

  return { ...DEFAULT_RECORDING_CONFIG };
}

export async function saveSettings(config: Partial<RecordingConfig>): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return;
  }

  try {
    const current = await loadSavedSettings();
    const updated = { ...current, ...config };
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: updated });
  } catch (err) {
    console.warn('[SettingsService] Failed to save settings to storage:', err);
  }
}
