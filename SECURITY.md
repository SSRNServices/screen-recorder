# Security Policy

The ScreenRecorder team takes the security and privacy of our users seriously. As a local-first application designed to capture screen and audio data directly on the user's workstation, our architecture enforces strict boundaries between browser capture contexts, local messaging, and host processes.

---

## Supported Versions

Only the latest release receive security updates and patches.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

---

## Security Architecture & Threat Model

1. **Local-First Isolation**:
   - ScreenRecorder does not transmit audio, video, or metadata over external networks.
   - All capture streams are contained within the browser's sandbox until downloaded locally.
2. **Minimal Permissions (Least Privilege)**:
   - ScreenRecorder avoids high-risk permissions such as `<all_urls>`, `webRequest`, `cookies`, or arbitrary content script injection.
   - Only `storage` and `downloads` permissions are requested.
3. **Native Messaging Security (Phase 2+)**:
   - The native host uses standard length-prefixed stdio communication.
   - The native host strictly validates structured JSON requests; arbitrary command strings and shell execution (`exec`, `cmd.exe`, `powershell.exe`) are rejected.
   - Process execution strictly uses `spawn(executablePath, validatedArgsArray)`.
   - Output paths are checked against path traversal (`..`) and restricted to designated user media directories.

---

## Reporting a Vulnerability

If you discover a potential security vulnerability in ScreenRecorder:

1. **Do NOT open a public GitHub issue** with sensitive exploit details or reproduction steps.
2. Report the vulnerability privately via **GitHub Security Advisories** on the repository:
   - Navigate to the **Security** tab of [SSRNServices/screen-recorder](https://github.com/SSRNServices/screen-recorder).
   - Click **Report a vulnerability**.
3. Alternatively, contact the maintainers directly via security email or designated private disclosure channel.

### What to Include in Your Report

* Description of the vulnerability and its potential impact.
* Step-by-step instructions or proof-of-concept (PoC) demonstrating how to reproduce the issue.
* Affected components (e.g. extension frontend, background service worker, protocol schema, or native host).
* Browser and OS versions tested.

### Disclosure Timeline

* **Initial Response**: We will acknowledge receipt of your report within 48 hours.
* **Assessment & Patching**: We will assess the severity and develop a fix within 7–14 days.
* **Public Release & Advisory**: We coordinate the public disclosure date with the reporter once the patch is published.
