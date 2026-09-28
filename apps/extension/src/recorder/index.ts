import { RecordingController } from './RecordingController.js';
import { formatDuration } from '../utils/formatTime.js';
import type { RecordingConfig, RecordingStatusSnapshot, ExtensionMessage } from '@screenrecorder/protocol';

const controller = new RecordingController();

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const timerDisplay = document.getElementById('timer');
const actionButtons = document.getElementById('action-buttons');
const detailsSection = document.getElementById('details-section');

let timerInterval: number | null = null;

function renderUI(snapshot: RecordingStatusSnapshot) {
  if (!statusText || !statusDot || !timerDisplay || !actionButtons || !detailsSection) return;

  statusText.textContent = snapshot.state;
  statusDot.className = 'status-dot';

  if (snapshot.state === 'RECORDING') {
    statusDot.classList.add('recording');
  } else if (snapshot.state === 'PAUSED') {
    statusDot.classList.add('paused');
  }

  // Action buttons
  actionButtons.innerHTML = '';

  if (snapshot.state === 'IDLE') {
    const startBtn = document.createElement('button');
    startBtn.className = 'btn-primary';
    startBtn.textContent = 'Start Recording';
    startBtn.onclick = () => {
      controller.startRecording(snapshot.config);
    };
    actionButtons.appendChild(startBtn);
  } else if (snapshot.state === 'RECORDING') {
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'btn-warning';
    pauseBtn.textContent = 'Pause';
    pauseBtn.onclick = () => controller.pauseRecording();

    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn-danger';
    stopBtn.textContent = 'Stop Recording';
    stopBtn.onclick = () => controller.stopRecording();

    actionButtons.appendChild(pauseBtn);
    actionButtons.appendChild(stopBtn);
  } else if (snapshot.state === 'PAUSED') {
    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'btn-primary';
    resumeBtn.textContent = 'Resume';
    resumeBtn.onclick = () => controller.resumeRecording();

    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn-danger';
    stopBtn.textContent = 'Stop Recording';
    stopBtn.onclick = () => controller.stopRecording();

    actionButtons.appendChild(resumeBtn);
    actionButtons.appendChild(stopBtn);
  } else if (snapshot.state === 'STOPPING' || snapshot.state === 'PROCESSING') {
    const processingMsg = document.createElement('div');
    processingMsg.style.textAlign = 'center';
    processingMsg.style.width = '100%';
    processingMsg.style.color = 'var(--text-secondary)';
    processingMsg.textContent = 'Finalizing recording...';
    actionButtons.appendChild(processingMsg);
  } else if (snapshot.state === 'COMPLETED') {
    const recordAgainBtn = document.createElement('button');
    recordAgainBtn.className = 'btn-primary';
    recordAgainBtn.textContent = 'Record Again';
    recordAgainBtn.onclick = () => controller.reset();

    actionButtons.appendChild(recordAgainBtn);
  } else if (snapshot.state === 'ERROR') {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-secondary';
    retryBtn.textContent = 'Dismiss';
    retryBtn.onclick = () => controller.reset();

    actionButtons.appendChild(retryBtn);
  }

  // Details section
  detailsSection.innerHTML = '';
  if (snapshot.state === 'COMPLETED' && snapshot.lastRecording) {
    const completedBox = document.createElement('div');
    completedBox.className = 'completed-info';
    completedBox.innerHTML = `
      <h3>Recording Complete</h3>
      <p class="file-detail"><strong>File:</strong> ${snapshot.lastRecording.filename}</p>
      <p class="file-detail"><strong>Duration:</strong> ${formatDuration(snapshot.lastRecording.durationMs)}</p>
      <p class="file-detail"><strong>Size:</strong> ${(snapshot.lastRecording.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
      <div style="margin-top: 12px;">
        <a href="${snapshot.lastRecording.downloadUrl}" download="${snapshot.lastRecording.filename}" style="color: #60a5fa; text-decoration: underline; font-size: 0.9rem;">
          Download recording file
        </a>
      </div>
    `;
    detailsSection.appendChild(completedBox);
  } else if (snapshot.state === 'ERROR' && snapshot.error) {
    const errorBox = document.createElement('div');
    errorBox.className = 'error-alert';
    errorBox.textContent = snapshot.error.message || 'An error occurred.';
    detailsSection.appendChild(errorBox);
  }

  // Update timer display
  timerDisplay.textContent = formatDuration(controller.getSnapshot().elapsedMs);
}

// Subscribe to controller updates
controller.subscribe((snapshot) => {
  renderUI(snapshot);

  // Sync with background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({
      type: 'RECORDING_STATUS_UPDATE',
      snapshot
    } as ExtensionMessage).catch(() => {
      // Ignore background receipt errors if worker inactive
    });
  }

  if (snapshot.state === 'RECORDING') {
    if (!timerInterval) {
      timerInterval = window.setInterval(() => {
        if (timerDisplay) {
          timerDisplay.textContent = formatDuration(controller.getSnapshot().elapsedMs);
        }
      }, 250);
    }
  } else {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (timerDisplay) {
      timerDisplay.textContent = formatDuration(controller.getSnapshot().elapsedMs);
    }
  }
});

// Listen for external commands from popup
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'START_RECORDING':
        controller.startRecording(message.config);
        sendResponse({ ok: true });
        break;
      case 'STOP_RECORDING':
        controller.stopRecording();
        sendResponse({ ok: true });
        break;
      case 'PAUSE_RECORDING':
        controller.pauseRecording();
        sendResponse({ ok: true });
        break;
      case 'RESUME_RECORDING':
        controller.resumeRecording();
        sendResponse({ ok: true });
        break;
      case 'RESET_RECORDING':
        controller.reset();
        sendResponse({ ok: true });
        break;
      case 'GET_RECORDING_STATUS':
        sendResponse(controller.getSnapshot());
        break;
    }
    return false;
  });
}

// Handle auto-start from URL query parameters
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('autostart') === '1') {
  const initialConfig: RecordingConfig = {
    source: (urlParams.get('source') as RecordingConfig['source']) || 'screen',
    includeMic: urlParams.get('mic') === 'true',
    includeSystemAudio: urlParams.get('audio') !== 'false'
  };
  controller.startRecording(initialConfig);
}
