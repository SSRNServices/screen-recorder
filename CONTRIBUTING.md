# Contributing to ScreenRecorder

Thank you for your interest in contributing to **ScreenRecorder**! This project is an open-source, local-first screen capture application built with TypeScript, React, Chromium Manifest V3, and an upcoming native FFmpeg processing engine.

---

## Code of Conduct

All contributors and maintainers are expected to uphold a professional, welcoming, and inclusive community environment. Be respectful, constructive, and collaborative.

---

## Development Workflow

### 1. Prerequisites

* **Node.js**: v18.0.0+ (Tested on Node.js v24.x)
* **Package Manager**: `npm` (npm workspaces) or `pnpm`
* **Browser**: Google Chrome, Microsoft Edge, or Chromium-based browser
* **Git**: v2.30+

### 2. Fork and Setup

1. Fork the repository on GitHub: `https://github.com/SSRNServices/web-recorder`.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/web-recorder.git
   cd web-recorder
   ```
3. Install dependencies across the monorepo workspaces:
   ```bash
   npm install
   ```

### 3. Branch Strategy

The repository intentionally maintains a single long-lived branch:

* **Primary Branch**: `main` is the only permanent branch in the repository.
* **Temporary Topic Branches**: When contributing via Pull Request, use a temporary topic branch on your fork:
  * `feat/<feature-name>` for new features (e.g. `feat/audio-ducking`)
  * `fix/<bug-name>` for bug fixes (e.g. `fix/aspect-ratio-clamping`)
  * `docs/<topic>` for documentation improvements
  * `refactor/<module>` for non-breaking refactoring
* **Immediate Deletion on Merge**: Once reviewed and merged into `main`, the temporary topic branch is deleted.
* **No Automated Bot Branches**: Automated dependency-update bots (such as Dependabot) are disabled. All dependency updates are reviewed, audited, and applied manually:
  ```bash
  npm outdated
  npm audit --audit-level=high
  ```
* **Release Versioning**: Official releases are marked using semantic Git tags (`v*.*.*`), never permanent release branches.

### 4. Code Standards & Static Analysis

Before submitting changes, ensure all packages pass strict TypeScript compilation, linting, and unit tests:

```bash
# Type check all workspaces
npm run typecheck

# Run static analysis
npm run lint

# Execute unit test suites
npm test

# Build production bundle
npm run build

# Validate artifact integrity and manifest schema
npm run validate:artifacts

# Test complete packaging bundle
npm run package
```

#### Guidelines:
* **TypeScript Strict Mode**: Avoid using `any`. Write explicit interfaces and strict types for state, protocol messages, and configurations.
* **Separation of Concerns**: Keep UI components isolated from process orchestration and command generation.
* **Zero Arbitrary Commands**: Never introduce shell string concatenation (`exec`) or command-line injection surfaces. Use argument arrays (`spawn`).
* **Privacy & Least Privilege**: Do not introduce analytics, telemetry, remote cloud calls, or unnecessary extension permissions.

---

## Submitting Pull Requests

1. Commit your changes with clear, descriptive commit messages adhering to the [Conventional Commits](https://www.conventionalcommits.org/) specification:
   ```bash
   git commit -m "feat(extension): add custom shortcut for pause/resume"
   ```
2. Push your topic branch to your GitHub fork:
   ```bash
   git push origin feat/<feature-name>
   ```
3. Open a Pull Request targeting the `main` branch.
4. Fill out the Pull Request template completely, including:
   * Summary of changes
   * Test methodology
   * Screenshots / video comparisons for UI changes
   * Security considerations
5. Ensure all automated CI checks pass.

Thank you for helping make ScreenRecorder a better, privacy-first screen recording tool!
