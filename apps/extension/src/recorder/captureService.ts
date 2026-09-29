import type { RecordingConfig, CaptureSource } from '@screenrecorder/protocol';
import { createCaptureError, classifyCaptureError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface CaptureResult {
  stream: MediaStream;
  source: CaptureSource;
  hasSystemAudio: boolean;
  isTabCapture: boolean;
}

/**
 * Capture single tab using chrome.tabCapture.getMediaStreamId.
 * Does NOT use getDisplayMedia.
 */
export async function captureTab(
  config: RecordingConfig,
  consumerTabId?: number
): Promise<CaptureResult> {
  logger.log('CAPTURE_REQUEST', {
    source: 'tab',
    targetTabId: config.targetTabId,
    includeSystemAudio: config.includeSystemAudio
  });

  if (!config.targetTabId) {
    throw createCaptureError(
      'INVALID_TARGET_TAB',
      'No active web tab identified for tab capture. Please select a valid web page and try again.'
    );
  }

  // Obtain consumer tab ID if not provided
  let effectiveConsumerTabId = consumerTabId;
  if (!effectiveConsumerTabId && typeof chrome !== 'undefined' && chrome.tabs?.getCurrent) {
    try {
      const currentTab = await chrome.tabs.getCurrent();
      effectiveConsumerTabId = currentTab?.id;
    } catch {
      // Ignore if not in tab context
    }
  }

  // Obtain stream ID via tabCapture API
  const streamId = await new Promise<string>((resolve, reject) => {
    const requestDetails: chrome.tabCapture.GetMediaStreamOptions = {
      targetTabId: config.targetTabId
    };
    if (effectiveConsumerTabId) {
      requestDetails.consumerTabId = effectiveConsumerTabId;
    }

    if (chrome.tabCapture?.getMediaStreamId) {
      chrome.tabCapture.getMediaStreamId(requestDetails, (id) => {
        if (chrome.runtime.lastError) {
          reject(createCaptureError(
            'CAPTURE_FAILED',
            `Tab capture error: ${chrome.runtime.lastError.message}`,
            chrome.runtime.lastError.message
          ));
        } else if (!id) {
          reject(createCaptureError('USER_CANCELLED', 'Tab capture was cancelled or unavailable.'));
        } else {
          resolve(id);
        }
      });
    } else {
      // Fallback: request background service worker to obtain stream ID
      chrome.runtime.sendMessage(
        {
          type: 'GET_TAB_STREAM_ID',
          targetTabId: config.targetTabId!,
          consumerTabId: effectiveConsumerTabId!
        },
        (res) => {
          if (chrome.runtime.lastError) {
            reject(createCaptureError(
              'CAPTURE_FAILED',
              `Tab capture message failed: ${chrome.runtime.lastError.message}`
            ));
          } else if (res && res.streamId) {
            resolve(res.streamId);
          } else {
            reject(createCaptureError('CAPTURE_FAILED', res?.error || 'Tab capture stream ID unavailable.'));
          }
        }
      );
    }
  });

  logger.log('CAPTURE_RESPONSE', {
    source: 'tab',
    streamIdPresent: Boolean(streamId),
    streamIdLength: streamId.length
  });

  const targetIdealFps = config.fps === 30 ? 30 : 60;
  const shouldRequestAudio = config.includeSystemAudio !== false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
          maxFrameRate: targetIdealFps
        }
      } as unknown as MediaTrackConstraints,
      audio: shouldRequestAudio
        ? ({
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: streamId
            }
          } as unknown as MediaTrackConstraints)
        : false
    });

    const audioTracks = stream.getAudioTracks();
    return {
      stream,
      source: 'tab',
      hasSystemAudio: audioTracks.length > 0,
      isTabCapture: true
    };
  } catch (err) {
    logger.error('FAILURE', err, {
      stage: 'CAPTURE_RESPONSE',
      source: 'tab',
      audioRequested: shouldRequestAudio
    });
    throw classifyCaptureError(err, 'tab');
  }
}

/**
 * Capture application window using chrome.desktopCapture.chooseDesktopMedia(['window']).
 */
export async function captureWindow(config: RecordingConfig): Promise<CaptureResult> {
  logger.log('CAPTURE_REQUEST', {
    source: 'window',
    includeSystemAudio: config.includeSystemAudio
  });

  if (typeof chrome === 'undefined' || !chrome.desktopCapture?.chooseDesktopMedia) {
    throw createCaptureError('CAPTURE_FAILED', 'Desktop capture API is not available in this browser.');
  }

  const sources: ('screen' | 'window' | 'tab' | 'audio')[] = ['window'];
  if (config.includeSystemAudio) {
    sources.push('audio');
  }

  const { streamId, canRequestAudioTrack } = await new Promise<{
    streamId: string;
    canRequestAudioTrack: boolean;
  }>((resolve, reject) => {
    chrome.desktopCapture.chooseDesktopMedia(sources, (id, options) => {
      if (chrome.runtime.lastError) {
        reject(createCaptureError(
          'CAPTURE_FAILED',
          `Window picker error: ${chrome.runtime.lastError.message}`,
          chrome.runtime.lastError.message
        ));
      } else if (!id || id.trim() === '') {
        // User clicked cancel or closed picker
        reject(createCaptureError('USER_CANCELLED', 'Recording cancelled. No capture source was selected.'));
      } else {
        resolve({
          streamId: id,
          canRequestAudioTrack: Boolean(options?.canRequestAudioTrack)
        });
      }
    });
  });

  logger.log('CAPTURE_RESPONSE', {
    source: 'window',
    streamIdPresent: Boolean(streamId),
    streamIdLength: streamId.length,
    canRequestAudioTrack
  });

  const targetIdealFps = config.fps === 30 ? 30 : 60;
  // Strictly enforce: never request desktop audio if canRequestAudioTrack is false!
  const shouldRequestAudio = Boolean(config.includeSystemAudio && canRequestAudioTrack);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: 'desktop', // Must be "desktop", NEVER "window"
          chromeMediaSourceId: streamId,
          maxFrameRate: targetIdealFps
        }
      } as unknown as MediaTrackConstraints,
      audio: shouldRequestAudio
        ? ({
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: streamId
            }
          } as unknown as MediaTrackConstraints)
        : false
    });

    const audioTracks = stream.getAudioTracks();
    return {
      stream,
      source: 'window',
      hasSystemAudio: audioTracks.length > 0,
      isTabCapture: false
    };
  } catch (err) {
    logger.error('FAILURE', err, {
      stage: 'CAPTURE_RESPONSE',
      source: 'window',
      audioRequested: shouldRequestAudio,
      canRequestAudioTrack
    });
    throw classifyCaptureError(err, 'window');
  }
}

/**
 * Capture entire screen/monitor using chrome.desktopCapture.chooseDesktopMedia(['screen', ...]).
 */
export async function captureScreen(config: RecordingConfig): Promise<CaptureResult> {
  logger.log('CAPTURE_REQUEST', {
    source: 'screen',
    includeSystemAudio: config.includeSystemAudio
  });

  if (typeof chrome === 'undefined' || !chrome.desktopCapture?.chooseDesktopMedia) {
    throw createCaptureError('CAPTURE_FAILED', 'Desktop capture API is not available in this browser.');
  }

  const sources: ('screen' | 'window' | 'tab' | 'audio')[] = ['screen', 'window', 'tab'];
  if (config.includeSystemAudio) {
    sources.push('audio');
  }

  const { streamId, canRequestAudioTrack } = await new Promise<{
    streamId: string;
    canRequestAudioTrack: boolean;
  }>((resolve, reject) => {
    chrome.desktopCapture.chooseDesktopMedia(sources, (id, options) => {
      if (chrome.runtime.lastError) {
        reject(createCaptureError(
          'CAPTURE_FAILED',
          `Screen picker error: ${chrome.runtime.lastError.message}`,
          chrome.runtime.lastError.message
        ));
      } else if (!id || id.trim() === '') {
        // User clicked cancel or closed picker
        reject(createCaptureError('USER_CANCELLED', 'Recording cancelled. No capture source was selected.'));
      } else {
        resolve({
          streamId: id,
          canRequestAudioTrack: Boolean(options?.canRequestAudioTrack)
        });
      }
    });
  });

  logger.log('CAPTURE_RESPONSE', {
    source: 'screen',
    streamIdPresent: Boolean(streamId),
    streamIdLength: streamId.length,
    canRequestAudioTrack
  });

  const targetIdealFps = config.fps === 30 ? 30 : 60;
  // Strictly enforce: never request desktop audio if canRequestAudioTrack is false!
  const shouldRequestAudio = Boolean(config.includeSystemAudio && canRequestAudioTrack);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: 'desktop', // Must be "desktop"
          chromeMediaSourceId: streamId,
          maxFrameRate: targetIdealFps
        }
      } as unknown as MediaTrackConstraints,
      audio: shouldRequestAudio
        ? ({
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: streamId
            }
          } as unknown as MediaTrackConstraints)
        : false
    });

    const audioTracks = stream.getAudioTracks();
    return {
      stream,
      source: 'screen',
      hasSystemAudio: audioTracks.length > 0,
      isTabCapture: false
    };
  } catch (err) {
    logger.error('FAILURE', err, {
      stage: 'CAPTURE_RESPONSE',
      source: 'screen',
      audioRequested: shouldRequestAudio,
      canRequestAudioTrack
    });
    throw classifyCaptureError(err, 'screen');
  }
}

/**
 * Main authoritative capture router.
 * Dispatches to independent, specialized capture implementations.
 */
export async function captureMedia(
  config: RecordingConfig,
  consumerTabId?: number
): Promise<CaptureResult> {
  switch (config.source) {
    case 'tab':
      return await captureTab(config, consumerTabId);
    case 'window':
      return await captureWindow(config);
    case 'screen':
      return await captureScreen(config);
    default:
      throw createCaptureError(
        'INVALID_SOURCE',
        `Unsupported recording source: ${config.source}`
      );
  }
}
