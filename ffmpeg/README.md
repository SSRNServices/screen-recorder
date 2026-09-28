# FFmpeg Binaries & Licensing Documentation

This directory contains configuration, scripts, and documentation for bundling and interfacing with FFmpeg in **ScreenRecorder**.

## Licensing Considerations

FFmpeg is licensed under the **LGPL version 2.1 or later** (or **GPL version 2 or later** if configured with `--enable-gpl`).

When distributing ScreenRecorder:
1. **LGPL Build (Recommended)**:
   - Built without GPL-only codecs (e.g. `--enable-libx264` makes it GPL; using OpenH264 or native encoders keeps it LGPL compliant).
   - If using GPL builds (e.g. `libx264`), the redistribution requirements of GPL v2/v3 must be adhered to (including providing access to source code and build scripts).
2. **Dynamic Linking / Process Boundary**:
   - ScreenRecorder invokes FFmpeg as an independent subprocess using Node's `child_process.spawn`.
   - No FFmpeg C headers or libraries are linked into the native-host process directly.
3. **Replaceable Binary**:
   - The user or administrator may replace `ffmpeg.exe` and `ffprobe.exe` located in the application directory at any time.

## Recommended Windows Builds

- **Gyan.dev Essentials Build**: [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/)
- **BtbN FFmpeg-Builds**: [https://github.com/BtbN/FFmpeg-Builds/releases](https://github.com/BtbN/FFmpeg-Builds/releases)

Target Architecture: Windows x86_64 (Windows 10 / 11 64-bit).
