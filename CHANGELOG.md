# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-09-28

### Added
* **Chromium Extension Core**: Manifest V3 extension supporting browser tab, application window, and entire display capture.
* **Decoupled Architecture**: Persistent recording session document (`recorder.html`) allowing users to close the extension popup without interrupting recording sessions.
* **Audio Architecture**: Combined microphone and system audio support with Web Audio API mixer (`AudioContext`).
* **High-Quality Recording Engine**:
  * Native display resolution inspection (`videoTrack.getSettings()`) with anti-upscaling protection.
  * Dynamic bitrate calculation based on pixel density and frame rate multipliers (Standard: ~18 Mbps, High: ~25 Mbps, Ultra: ~35 Mbps at 1080p).
  * Robust VP9/VP8/H.264 dynamic codec detection with audio-aware candidate fallback.
* **Design System & UI**:
  * Unified dark mode palette with design tokens, accessible focus states (`:focus-visible`), and reduced-motion support.
  * Segmented capture source selector with SVG icon set.
  * Quality settings selector for profiles, target frame rates (Auto, 30, 60 FPS), and resolution ceilings (Source, 1080p, 1440p, 2160p).
  * Real-time timer display with live technical stream chips (`width × height`, `FPS`, `codec`, `bitrate`).
  * Completed recording summary card displaying duration, file size, codec, and download action.
  * Collapsible technical error diagnostic view with structured error codes.
  * Settings & Privacy drawer detailing local-first zero-telemetry architecture.
* **Shared Protocol**: Monorepo package (`@screenrecorder/protocol`) defining strict state machine transitions, event models, and native messaging schemas.
* **Test Suite**: 17 unit tests verifying state transitions, timer accuracy, bitrate formulas, anti-upscaling rules, and schema validators.
* **Packaging & Scripts**: Monorepo scripts for typechecking, building, and bundling.

### Security
* Enforced least-privilege extension permissions (only `storage` and `downloads`).
* Designed native host protocol around structured JSON validation and argument arrays (`spawn`), preventing command injection.
