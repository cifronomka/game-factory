import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { gameRoot, projectPath, walk } from './lib.mjs';

const assetRoot = join(gameRoot, 'assets');
const files = await walk(assetRoot, (path) => !path.endsWith('.gitkeep'));
const forbidden = files.filter((path) => /\.(?:psd|kra|blend|wav|map)$/i.test(path));
const total = (await Promise.all(files.map(async (path) => (await stat(path)).size))).reduce((sum, size) => sum + size, 0);
if (forbidden.length) throw new Error(`Forbidden runtime assets: ${forbidden.map(projectPath).join(', ')}`);
if (total > 15 * 1024 * 1024) throw new Error(`Asset budget exceeded: ${total}`);
for (const path of files.filter((file) => file.endsWith('.json'))) JSON.parse(await readFile(path, 'utf8'));

const manifest = JSON.parse(await readFile(join(assetRoot, 'assets-manifest.json'), 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) throw new Error('Invalid asset manifest schema');
const ids = new Set();
let artBytes = 0;
let criticalArtBytes = 0;
let decodedBytes = 0;
let audioBytes = 0;

function readBitmapDimensions(bytes, relativePath) {
  if (bytes.subarray(1, 4).toString() === 'PNG') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP') {
    throw new Error(`Only audited PNG/WebP bitmaps are allowed: ${relativePath}`);
  }
  const chunk = bytes.subarray(12, 16).toString();
  if (chunk === 'VP8X') {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { width, height };
  }
  if (chunk === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  throw new Error(`Unsupported WebP chunk ${chunk}: ${relativePath}`);
}

for (const entry of manifest.assets) {
  if (!entry.id || ids.has(entry.id)) throw new Error(`Duplicate or empty asset id: ${entry.id}`);
  ids.add(entry.id);
  const relativePath = String(entry.path ?? '');
  if (!relativePath.startsWith('assets/') || relativePath.includes('..')) throw new Error(`Unsafe asset path: ${relativePath}`);
  const path = join(gameRoot, relativePath);
  const bytes = await readFile(path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== entry.sha256) throw new Error(`Hash mismatch: ${relativePath}`);
  if (bytes.length !== entry.bytes) throw new Error(`Byte size mismatch: ${relativePath}`);
  const { width, height } = readBitmapDimensions(bytes, relativePath);
  if (width !== entry.width || height !== entry.height) throw new Error(`Dimension mismatch: ${relativePath}`);
  if (Math.max(width, height) > 2048) throw new Error(`Texture side limit exceeded: ${relativePath}`);
  if (!manifest.provenance || !manifest.reviewOwner) throw new Error(`Missing manifest provenance/reviewer: ${relativePath}`);
  artBytes += bytes.length;
  if (entry.critical === true) criticalArtBytes += bytes.length;
  decodedBytes += width * height * 4;
}
const audioAssets = Array.isArray(manifest.audioAssets) ? manifest.audioAssets : [];
for (const entry of audioAssets) {
  if (!entry.id || ids.has(entry.id)) throw new Error(`Duplicate or empty asset id: ${entry.id}`);
  ids.add(entry.id);
  const relativePath = String(entry.path ?? '');
  if (!relativePath.startsWith('assets/audio/') || relativePath.includes('..')) throw new Error(`Unsafe audio path: ${relativePath}`);
  const path = join(gameRoot, relativePath);
  const bytes = await readFile(path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== entry.sha256) throw new Error(`Hash mismatch: ${relativePath}`);
  if (bytes.length !== entry.bytes) throw new Error(`Byte size mismatch: ${relativePath}`);
  const extension = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
  const mp3Magic = bytes.subarray(0, 3).toString() === 'ID3'
    || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  const validMagic = extension === '.ogg'
    ? bytes.subarray(0, 4).toString() === 'OggS'
    : extension === '.flac'
      ? bytes.subarray(0, 4).toString() === 'fLaC'
      : extension === '.mp3' && mp3Magic;
  if (!validMagic) throw new Error(`Unsupported or mislabeled production audio: ${relativePath}`);
  if (!entry.license || !entry.credit || !(entry.durationSeconds > 0)) throw new Error(`Incomplete audio provenance: ${relativePath}`);
  audioBytes += bytes.length;
}
if (criticalArtBytes > 1.5 * 1024 * 1024) throw new Error(`Critical art hard cap exceeded: ${criticalArtBytes}`);
if (artBytes > 9.8 * 1024 * 1024) throw new Error(`Total art hard cap exceeded: ${artBytes}`);
if (decodedBytes > 64 * 1024 * 1024) throw new Error(`Decoded texture hard cap exceeded: ${decodedBytes}`);
if (audioBytes > 2 * 1024 * 1024) throw new Error(`Production audio hard cap exceeded: ${audioBytes}`);
console.log(`assets audit PASS (${manifest.assets.length} bitmap assets, ${criticalArtBytes} critical / ${artBytes} total art bytes, ${decodedBytes} decoded bytes; ${audioAssets.length} audio assets, ${audioBytes} audio bytes)`);
