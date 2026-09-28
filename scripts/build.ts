import { execSync } from 'child_process';

console.log('[ScreenRecorder Build Script] Starting monorepo build...');

try {
  execSync('npm run build:extension', { stdio: 'inherit' });
  console.log('[ScreenRecorder Build Script] Build completed successfully.');
} catch (err) {
  console.error('[ScreenRecorder Build Script] Build failed:', err);
  process.exit(1);
}
