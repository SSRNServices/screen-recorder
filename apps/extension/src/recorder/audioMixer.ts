import type { RecordingConfig } from '@screenrecorder/protocol';
import { logger } from '../utils/logger.js';

export interface AudioPipelineResult {
  finalAudioTrack: MediaStreamTrack | null;
  micStream: MediaStream | null;
  audioContext: AudioContext | null;
  audioWarning?: string;
}

/**
 * Configure and mix audio tracks according to user options.
 * Handles microphone capture with graceful failure (mic failure never kills video).
 * Handles tab capture local audio passthrough so user still hears the tab.
 * Uses Web Audio API MediaStreamDestination to output exactly one mixed audio track.
 */
export async function setupAudioPipeline(
  displayStream: MediaStream,
  config: RecordingConfig,
  isTabCapture = false
): Promise<AudioPipelineResult> {
  logger.log('AUDIO_SETUP', {
    includeMic: config.includeMic,
    includeSystemAudio: config.includeSystemAudio,
    isTabCapture,
    displayAudioTrackCount: displayStream.getAudioTracks().length
  });

  const displayAudioTracks = displayStream.getAudioTracks();
  const hasDisplayAudio = displayAudioTracks.length > 0;
  let micStream: MediaStream | null = null;
  let audioWarning: string | undefined;

  // 1. Acquire microphone if requested
  if (config.includeMic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      logger.log('AUDIO_SETUP', { micAcquired: true });
    } catch (micErr) {
      logger.warn('AUDIO_SETUP: Microphone capture failed, continuing without mic', {
        error: String(micErr)
      });
      audioWarning = 'Microphone unavailable — recording without microphone audio.';
      micStream = null;
    }
  }

  const micAudioTracks = micStream ? micStream.getAudioTracks() : [];
  const hasMicAudio = micAudioTracks.length > 0;

  // Case A: Both display/system audio AND mic audio exist -> Mix them!
  if (hasDisplayAudio && hasMicAudio) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }

    const systemSource = audioCtx.createMediaStreamSource(new MediaStream([displayAudioTracks[0]]));
    const micSource = audioCtx.createMediaStreamSource(new MediaStream([micAudioTracks[0]]));
    const destination = audioCtx.createMediaStreamDestination();

    systemSource.connect(destination);
    micSource.connect(destination);

    // If tab capture, preserve local playback so user hears the tab
    if (isTabCapture) {
      try {
        systemSource.connect(audioCtx.destination);
      } catch (e) {
        logger.warn('AUDIO_SETUP: Failed to route tab audio to speakers', { error: String(e) });
      }
    }

    const mixedTrack = destination.stream.getAudioTracks()[0] || null;
    return {
      finalAudioTrack: mixedTrack,
      micStream,
      audioContext: audioCtx,
      audioWarning
    };
  }

  // Case B: Only display/system audio exists
  if (hasDisplayAudio) {
    if (isTabCapture) {
      // Tab capture mutes tab unless routed to AudioContext destination
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }

      const systemSource = audioCtx.createMediaStreamSource(new MediaStream([displayAudioTracks[0]]));
      const destination = audioCtx.createMediaStreamDestination();

      systemSource.connect(destination);
      try {
        systemSource.connect(audioCtx.destination);
      } catch (e) {
        logger.warn('AUDIO_SETUP: Failed to route tab audio to speakers', { error: String(e) });
      }

      const routedTrack = destination.stream.getAudioTracks()[0] || displayAudioTracks[0];
      return {
        finalAudioTrack: routedTrack,
        micStream: null,
        audioContext: audioCtx,
        audioWarning
      };
    }

    return {
      finalAudioTrack: displayAudioTracks[0],
      micStream: null,
      audioContext: null,
      audioWarning
    };
  }

  // Case C: Only microphone audio exists
  if (hasMicAudio) {
    return {
      finalAudioTrack: micAudioTracks[0],
      micStream,
      audioContext: null,
      audioWarning
    };
  }

  // Case D: Video only
  return {
    finalAudioTrack: null,
    micStream: null,
    audioContext: null,
    audioWarning
  };
}
