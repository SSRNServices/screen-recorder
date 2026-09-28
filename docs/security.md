# Security Architecture & Threat Model

This document outlines the security principles, isolation boundaries, and threat mitigation strategies implemented in **ScreenRecorder**.

---

## 1. Principles

1. **Local-First Isolation**: No screen, camera, audio, or metadata stream is ever transmitted over external network connections.
2. **Least Privilege**: The extension requests only the minimum permissions necessary (`storage` and `downloads`).
3. **Defense in Depth**: The native messaging host treats the browser extension as a client boundary, validating all incoming JSON schemas and arguments before dispatching commands.

---

## 2. Browser Extension Security

### Manifest V3 Constraints
* ScreenRecorder complies strictly with Manifest V3.
* **No Remote Code Execution**: Content Security Policy (`script-src 'self'`) prevents loading remote scripts or using `eval()`.
* **No Broad Host Permissions**: The extension does not request `<all_urls>` or invasive web request interception.
* **Ephemeral Workers & Storage**: Session state uses `chrome.storage.session`, isolating live session data from persistent storage where appropriate.

### Memory & Media Safety
* `MediaStreamTrack` objects are explicitly stopped upon recording termination to ensure hardware devices (microphone, display capture) are released immediately.
* Temporary Blob URLs are scoped to the extension origin and revoked on session reset.

---

## 3. Native Host Security (Phase 2+)

The native host bridges the extension with the local FFmpeg binary. This boundary is secured against common native messaging vulnerabilities:

### Prohibition of Shell Execution
* **Rule**: Arbitrary command strings must NEVER be executed.
* Insecure: `child_process.exec("ffmpeg -i " + userInput)` — **PROHIBITED**.
* Enforced: `child_process.spawn(ffmpegPath, validatedArgsArray)` — **ENFORCED**.

### Request Validation
* Every incoming message over `stdin` is parsed against a strict schema.
* Requests containing unrecognized fields, invalid types, or unexpected properties are rejected immediately with structured error codes (`INVALID_REQUEST`).

### Path Traversal & Filesystem Hardening
* Input files must exist and be verified as standard media files.
* Output directories are verified against an approved whitelist (e.g. `%USERPROFILE%\Videos\ScreenRecorder` or designated application directories).
* Relative path traversal sequences (e.g., `../../Windows/System32`) are rejected.
* Destination files are written with atomic temporary names to prevent partial overwrite attacks.
