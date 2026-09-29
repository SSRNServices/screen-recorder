import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

console.log('[Artifact Verification] Validating build artifacts and extension manifest...');

// 1. Check Root Package.json
const rootPackagePath = path.join(rootDir, 'package.json');
if (!fs.existsSync(rootPackagePath)) {
  console.error('[Error] package.json not found in root.');
  process.exit(1);
}
const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
const expectedVersion = rootPackage.version;
console.log(`[Info] Expected version from root package.json: ${expectedVersion}`);

// 2. Check Extension Dist and Manifest
const extensionDistDir = path.join(rootDir, 'apps', 'extension', 'dist');
const manifestPath = path.join(extensionDistDir, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`[Error] Extension manifest not found at: ${manifestPath}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error('[Error] manifest.json is not valid JSON:', e);
  process.exit(1);
}

if (manifest.manifest_version !== 3) {
  console.error(`[Error] Expected manifest_version 3, got: ${manifest.manifest_version}`);
  process.exit(1);
}

if (manifest.version !== expectedVersion) {
  console.error(`[Error] Version mismatch! package.json is ${expectedVersion} but manifest.json is ${manifest.version}`);
  process.exit(1);
}

console.log(`[PASS] Manifest V3 valid (version: ${manifest.version}, name: "${manifest.name}")`);

// 3. Check Required Extension Files
const requiredExtensionFiles = [
  'popup.html',
  'recorder.html',
  'background.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

for (const relFile of requiredExtensionFiles) {
  const filePath = path.join(extensionDistDir, relFile);
  if (!fs.existsSync(filePath)) {
    console.error(`[Error] Missing required extension build file: ${relFile}`);
    process.exit(1);
  }
}
console.log(`[PASS] All ${requiredExtensionFiles.length} essential extension assets verified.`);

// Verify background.js is 100% self-contained (no external chunk imports)
const bgContent = fs.readFileSync(path.join(extensionDistDir, 'background.js'), 'utf8');
if (/import\s+.*\s+from\s+['"]\.\/assets\//i.test(bgContent) || /import\s*\(/.test(bgContent)) {
  console.error('[Error] background.js contains external chunk imports. Service worker must be self-contained to prevent fetch errors.');
  process.exit(1);
}
console.log('[PASS] background.js service worker is 100% self-contained (zero chunk imports).');

// Verify HTML files use relative assets and do not use modulepreload
for (const htmlFile of ['popup.html', 'recorder.html']) {
  const htmlContent = fs.readFileSync(path.join(extensionDistDir, htmlFile), 'utf8');
  if (htmlContent.includes('"/assets/') || htmlContent.includes("'/assets/")) {
    console.error(`[Error] ${htmlFile} contains absolute path /assets/. Must use relative base.`);
    process.exit(1);
  }
  if (htmlContent.includes('rel="modulepreload"')) {
    console.error(`[Error] ${htmlFile} contains modulepreload links. May trigger CORS/script-fetch errors in extension.`);
    process.exit(1);
  }
}
console.log('[PASS] HTML entry points use relative assets and clean module loading.');

// 4. Verify Protocol Build Output
const protocolDist = path.join(rootDir, 'packages', 'protocol', 'dist');
const protocolIndexJs = path.join(protocolDist, 'index.js');
const protocolIndexDts = path.join(protocolDist, 'index.d.ts');

if (!fs.existsSync(protocolIndexJs) || !fs.existsSync(protocolIndexDts)) {
  console.error('[Error] Protocol package dist files (index.js / index.d.ts) missing.');
  process.exit(1);
}
console.log('[PASS] @screenrecorder/protocol distribution output verified.');

// 5. Verify Native Host Build Output
const nativeHostDist = path.join(rootDir, 'apps', 'native-host', 'dist');
const nativeHostMainJs = path.join(nativeHostDist, 'main.js');

if (!fs.existsSync(nativeHostMainJs)) {
  console.error('[Error] Native Host package dist file (main.js) missing.');
  process.exit(1);
}
console.log('[PASS] @screenrecorder/native-host distribution output verified.');

console.log('[PASS] All build artifacts and manifests successfully validated!');
process.exit(0);
