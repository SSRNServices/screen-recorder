# Troubleshooting Guide

## Browser Extension Issues

### 1. "Screen capture permission was denied"
- **Cause**: User clicked "Cancel" on the system/browser capture dialog or browser permissions were restricted.
- **Resolution**: Click "Start Recording" again and select the target window/tab. Ensure screen recording permissions are allowed in system privacy settings if on macOS or Windows enterprise policy.

### 2. Audio Not Captured
- **Cause**: The capture source did not include audio or the system audio toggle was unchecked in Chrome's picker.
- **Resolution**: When recording a browser tab or entire screen, ensure the "Share tab audio" / "Share system audio" checkbox is checked at the bottom of the native browser picker dialog.

### 3. Recording Stops Prematurely
- **Cause**: User clicked the native browser floating bar "Stop sharing".
- **Behavior**: This is expected behavior; the extension intercepts the track termination, finalizes all buffered chunks, and prompts you to save the `.webm` file.

### 4. Popup Closes During Recording
- **Behavior**: This is normal Chromium behavior when clicking outside popup windows. The recording process is hosted in the background recorder tab and continues uninterrupted. Re-opening the popup will display the current recording status and elapsed time.
