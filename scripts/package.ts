import fs from 'fs';
import path from 'path';

console.log('[ScreenRecorder Package Script] Packaging extension bundle...');

const distDir = path.join(process.cwd(), 'apps', 'extension', 'dist');
if (!fs.existsSync(distDir)) {
  console.error('[ScreenRecorder Package Script] apps/extension/dist not found. Run build first.');
  process.exit(1);
}

console.log('[ScreenRecorder Package Script] Ready at:', distDir);
