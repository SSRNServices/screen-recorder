# Development Guide

This guide describes how to build, test, and load **ScreenRecorder** locally.

## Prerequisites

- **Node.js**: v18.0.0+ (Tested on v24.x)
- **Package Manager**: `npm` (or `pnpm`)
- **Browser**: Google Chrome, Microsoft Edge, or Brave

## Workspace Setup

Clone the repository and install dependencies from the monorepo root:

```bash
npm install
```

## Running Extension in Development

To start the Vite development server with hot reloading:

```bash
npm run dev
```

## Building Extension

To build the extension for production:

```bash
npm run build
```

This compiles:
- `apps/extension/dist/manifest.json`
- `apps/extension/dist/popup.html`
- `apps/extension/dist/recorder.html`
- `apps/extension/dist/background.js`
- `apps/extension/dist/icons/*`

## Loading into Chromium (Chrome / Edge / Brave)

1. Open your browser and navigate to:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
2. Enable **Developer mode** (toggle located in the upper-right corner).
3. Click **Load unpacked**.
4. Select the directory:
   ```text
   <repo-root>/apps/extension/dist
   ```
5. Pin the **ScreenRecorder** extension to your toolbar.

## Running Tests & Typechecks

Run the test suite across all monorepo packages:

```bash
npm test
```

Run TypeScript strict type checking:

```bash
npm run typecheck
```
