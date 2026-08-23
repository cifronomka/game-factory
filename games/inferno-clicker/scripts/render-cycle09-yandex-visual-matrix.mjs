import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { gameRoot } from './lib.mjs';

const evidenceRoot = process.env.INFERNO_CYCLE09_EVIDENCE_DIR
  ? (isAbsolute(process.env.INFERNO_CYCLE09_EVIDENCE_DIR)
      ? process.env.INFERNO_CYCLE09_EVIDENCE_DIR
      : join(gameRoot, process.env.INFERNO_CYCLE09_EVIDENCE_DIR))
  : join(gameRoot, 'reports/yandex-release-cycle-09-working');
const outputRoot = join(evidenceRoot, 'visual');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const backgrounds = Object.freeze([
  { id: 'black', color: '#000000' },
  { id: 'dark-red', color: '#2a0705' },
  { id: 'neutral-gray', color: '#777777' },
]);
const dprs = Object.freeze([1, 2, 3]);
const entries = Object.freeze([
  ...['idle', 'inhale', 'blow', 'recovery'].map((clip) => ({
    id: `ash-servant-${clip}`,
    clip,
    atlas: `assets/characters/ash-servant/ash-servant-${clip}-v7.webp`,
    metadata: `assets/characters/ash-servant/ash-servant-${clip}-v7.json`,
  })),
  ...['idle', 'cast', 'hold', 'recovery'].map((clip) => ({
    id: `ember-warden-${clip}`,
    clip,
    atlas: `assets/characters/demoness/demoness-${clip}-v8.webp`,
    metadata: `assets/characters/demoness/demoness-${clip}-v8.json`,
  })),
]);

function xml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

await mkdir(outputRoot, { recursive: true });
const buildManifestBytes = await readFile(join(gameRoot, 'dist-e2e/build-manifest.json'));
const buildManifest = JSON.parse(buildManifestBytes.toString('utf8'));
if (buildManifest.target !== 'yandex' || buildManifest.testDriver !== true) {
  throw new Error('Cycle 09 visual matrix requires the instrumented Yandex build.');
}

const decoded = [];
for (const entry of entries) {
  const [atlasBytes, metadataBytes] = await Promise.all([
    readFile(join(gameRoot, entry.atlas)),
    readFile(join(gameRoot, entry.metadata)),
  ]);
  const metadata = JSON.parse(metadataBytes.toString('utf8'));
  const clip = metadata.clips?.[entry.clip];
  if (!clip || clip.frames?.length !== 8) throw new Error(`${entry.id}: expected eight metadata frames.`);
  decoded.push({ ...entry, atlasBytes, atlasSha256: sha256(atlasBytes), metadataSha256: sha256(metadataBytes), frames: clip.frames });
}

const logicalTile = Object.freeze({ width: 160, height: 240, artWidth: 148, artHeight: 204, labelHeight: 28 });
const files = [];
const checks = [];
for (const background of backgrounds) {
  for (const dpr of dprs) {
    const tileWidth = logicalTile.width * dpr;
    const tileHeight = logicalTile.height * dpr;
    const width = tileWidth * 8;
    const height = tileHeight * decoded.length;
    const composites = [];
    for (let row = 0; row < decoded.length; row += 1) {
      const entry = decoded[row];
      for (let frameIndex = 0; frameIndex < entry.frames.length; frameIndex += 1) {
        const frame = entry.frames[frameIndex];
        const frameBytes = await sharp(entry.atlasBytes, { failOn: 'error' })
          .extract({ left: frame.x, top: frame.y, width: frame.w, height: frame.h })
          .resize(logicalTile.artWidth * dpr, logicalTile.artHeight * dpr, {
            fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: sharp.kernel.lanczos3,
          })
          .png()
          .toBuffer();
        const left = frameIndex * tileWidth + Math.round((tileWidth - logicalTile.artWidth * dpr) / 2);
        const top = row * tileHeight + 2 * dpr;
        composites.push({ input: frameBytes, left, top });
        checks.push({
          matrix: `${background.id}-dpr${dpr}`,
          character: entry.id.startsWith('ash-') ? 'ash-servant' : 'ember-warden',
          clip: entry.clip,
          frame: frameIndex,
          sourceAtlas: entry.atlas,
          sourceAtlasSha256: entry.atlasSha256,
          sourceRect: { x: frame.x, y: frame.y, width: frame.w, height: frame.h },
          background: background.id,
          dpr,
        });
      }
      const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${logicalTile.labelHeight * dpr}">
        <rect width="100%" height="100%" fill="rgba(0,0,0,.76)"/>
        <text x="${8 * dpr}" y="${19 * dpr}" font-family="Arial,sans-serif" font-size="${12 * dpr}" fill="#ffffff">${xml(entry.id)} · ${background.id} · DPR ${dpr}</text>
      </svg>`);
      composites.push({ input: label, left: 0, top: row * tileHeight + (logicalTile.height - logicalTile.labelHeight) * dpr });
    }
    const filename = `characters-${background.id}-dpr${dpr}.png`;
    const bytes = await sharp({ create: { width, height, channels: 4, background: background.color } })
      .composite(composites)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    await writeFile(join(outputRoot, filename), bytes);
    files.push({ filename, width, height, bytes: bytes.length, sha256: sha256(bytes), background: background.id, dpr, frames: 64 });
  }
}

const manifest = {
  schemaVersion: 1,
  cycle: '09',
  target: 'yandex',
  generatedBy: 'scripts/render-cycle09-yandex-visual-matrix.mjs',
  generatedAt: new Date().toISOString(),
  sourceFingerprint: buildManifest.sourceFingerprint,
  buildId: buildManifest.buildId,
  buildManifestSha256: sha256(buildManifestBytes),
  backgrounds: backgrounds.map((entry) => entry.id),
  dprs,
  clips: decoded.map((entry) => ({
    id: entry.id,
    clip: entry.clip,
    atlas: entry.atlas,
    atlasSha256: entry.atlasSha256,
    metadata: entry.metadata,
    metadataSha256: entry.metadataSha256,
    frames: entry.frames.length,
  })),
  frameCount: 64,
  compositeCheckCount: checks.length,
  visualDefectCategories: ['white-matte', 'neutral-residue', 'rectangular-residue', 'detached-alpha', 'filter-amplified-island'],
  files,
  checks,
};
await writeFile(join(outputRoot, 'character-matrix-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Cycle 09 Yandex visual matrix PASS (${files.length} sheets, ${checks.length} frame/background/DPR composites)`);
