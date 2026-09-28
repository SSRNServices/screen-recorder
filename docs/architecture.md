# Architecture Overview

**ScreenRecorder** is designed as a hybrid system separating browser media capture from high-performance desktop media processing.

## High-Level Topology

```text
┌─────────────────────────────────────────────────────────────┐
│                      Chromium Browser                       │
│                                                             │
│   ┌─────────────────────────┐   ┌────────────────────────┐  │
│   │       Popup UI          │   │      Recorder Tab      │  │
│   │   (React + Controls)    │   │  (Persistent Host)     │  │
│   └───────────┬─────────────┘   └───────────┬────────────┘  │
│               │                             │               │
│               ▼                             ▼               │
│   ┌──────────────────────────────────────────────────────┐  │
│   │                 RecordingController                  │  │
│   │   • State Machine (IDLE -> RECORDING -> COMPLETED)   │  │
│   │   • navigator.mediaDevices.getDisplayMedia           │  │
│   │   • Web Audio API (Mic + System Audio Mixer)         │  │
│   │   • MediaRecorder (Dynamic MIME WebM chunks)         │  │
│   └──────────────────────────┬───────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │               Background Service Worker              │  │
│   │   • Badge status manager (REC / PAUSE)               │  │
│   │   • chrome.storage.session coordinator               │  │
│   │   • Native messaging bridge                          │  │
│   └──────────────────────────┬───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               │ Native Messaging stdio (Phase 2+)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Local Native Host                        │
│                                                             │
│   • Request Validator & Security Guard                      │
│   • FFmpeg Argument Builder & Subprocess Manager            │
│   • Machine-readable progress parser                        │
│   • Atomic temporary file manager                           │
│                                                             │
│   Output: MP4 / Transcoded Media Assets                     │
└─────────────────────────────────────────────────────────────┘
```

## Manifest V3 Lifecycle Design

In Manifest V3, background service workers are ephemeral and cannot access the DOM or `navigator.mediaDevices`. Furthermore, extension popup windows are automatically terminated by the browser as soon as the user focuses another window.

To guarantee uninterrupted recordings of any length:
1. When the user initiates a recording, the extension coordinates a persistent recorder execution context (`recorder.html`).
2. The `RecordingController` manages stream acquisition, Web Audio mixing, dynamic MIME type detection, and chunk buffering.
3. The popup and background service worker communicate seamlessly via `chrome.runtime` and `chrome.storage.session`.
4. If the popup closes, recording continues without interruption. Reopening the popup at any time restores the exact elapsed duration and control buttons.
5. If the user clicks Chrome's floating "Stop sharing" bar, the video track's `onended` handler cleanly finalizes the recording and initiates the download.
