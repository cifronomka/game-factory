import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { gameRoot } from './lib.mjs';

const INPUTS = Object.freeze([
  'assets/characters/character-inferno-host-main-v4.webp',
  'assets/characters/character-inferno-host-sentinel-v4.webp',
  'assets/flame/atlases/core-low-v2.webp',
  'assets/flame/atlases/outer-low-v4.webp',
  'assets/flame/atlases/core-mid-v2.webp',
  'assets/flame/atlases/outer-mid-v4.webp',
  'assets/flame/atlases/core-high-v2.webp',
  'assets/flame/atlases/outer-high-v4.webp',
  'assets/flame/transitions/stage-flare-v3.webp',
]);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = [];
for (const input of INPUTS) {
  const source = await readFile(join(gameRoot, input));
  const output = input.replace(/\.webp$/u, '.png');
  const decoded = await sharp(source, { failOn: 'error' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < decoded.data.length; offset += 4) {
    if (decoded.data[offset + 3] !== 0) continue;
    decoded.data[offset] = 0;
    decoded.data[offset + 1] = 0;
    decoded.data[offset + 2] = 0;
  }
  const png = await sharp(decoded.data, { raw: {
    width: decoded.info.width,
    height: decoded.info.height,
    channels: 4,
  } })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
  await writeFile(join(gameRoot, output), png);
  const metadata = await sharp(png).metadata();
  manifest.push({
    source: input,
    sourceSha256: sha256(source),
    output,
    outputSha256: sha256(png),
    bytes: png.length,
    width: metadata.width,
    height: metadata.height,
  });
}

await writeFile(join(gameRoot, 'assets/yandex-compatibility-manifest-v1.json'), `${JSON.stringify({
  schemaVersion: 1,
  generatedBy: 'scripts/build-yandex-compatibility-assets.mjs',
  policy: 'Load WebP or PNG, never both, according to a synchronous browser capability probe.',
  files: manifest,
}, null, 2)}\n`);

console.log(`Yandex compatibility assets PASS (${manifest.length} PNG fallbacks)`);
