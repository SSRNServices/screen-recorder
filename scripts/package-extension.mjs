import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'apps', 'extension', 'dist');
const releaseDir = path.join(rootDir, 'release');

if (!fs.existsSync(distDir)) {
  console.error('[Error] apps/extension/dist not found. Run build first.');
  process.exit(1);
}

const rootPackage = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = rootPackage.version;
const zipName = `ScreenRecorder-extension-v${version}.zip`;

if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

const zipPath = path.join(releaseDir, zipName);
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

console.log(`[Package] Creating release zip: ${zipName}...`);

// Use tar with -a (auto-compress based on extension) or zip
try {
  if (process.platform === 'win32') {
    // Windows 10+ bsdtar
    execSync(`tar -a -c -f "${zipPath}" *`, { cwd: distDir, stdio: 'inherit' });
  } else {
    // Linux / macOS
    execSync(`zip -r "${zipPath}" ./*`, { cwd: distDir, stdio: 'inherit' });
  }
} catch (err) {
  console.error('[Error] Failed to create extension zip:', err);
  process.exit(1);
}

console.log(`[PASS] Extension bundle created: ${zipPath}`);

// Generate SHA256 checksum
const fileBuffer = fs.readFileSync(zipPath);
const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
const checksumLine = `${hash}  ${zipName}\n`;
const checksumPath = path.join(releaseDir, 'SHA256SUMS.txt');

fs.writeFileSync(checksumPath, checksumLine, 'utf8');
console.log(`[PASS] SHA-256: ${hash}`);
console.log(`[PASS] Checksums written to: ${checksumPath}`);
