# ScreenRecorder

A production-quality browser screen recording system with a native FFmpeg processing engine.

## Overview

ScreenRecorder combines a modern Chromium browser extension (Manifest V3, React, TypeScript) with a local desktop native messaging service and bundled FFmpeg processing engine.

- **Offline & Local-First**: No cloud accounts, no subscriptions, no telemetry. Recordings remain 100% on your local disk.
- **Robust MV3 Architecture**: Recording sessions continue uninterrupted even when the extension popup is closed or unfocused.
- **Dynamic Format Detection**: Automatically picks optimal VP9/VP8/H.264 WebM configurations.
- **Audio Mixing**: Seamlessly mixes system audio and microphone streams using Web Audio API.

## Monorepo Layout

```text
├── apps/
│   ├── extension/        # Chromium Manifest V3 browser extension (React, Vite, TS)
│   └── native-host/      # Local Node.js / TypeScript Native Messaging service
├── packages/
│   └── protocol/         # Shared communication schemas, events, and state machine
├── ffmpeg/               # Bundling notes and license documentation
├── docs/                 # Architecture, development, native messaging & troubleshooting guides
└── scripts/              # Build and development automation scripts
```

## Quick Start (Phase 1)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests & Validation
```bash
npm run typecheck
npm test
```

### 3. Build Extension
```bash
npm run build:extension
```

### 4. Load in Chrome or Edge
1. Navigate to `chrome://extensions/` or `edge://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `apps/extension/dist`.
4. Open the extension popup, choose capture source, and click **Start Recording**.
