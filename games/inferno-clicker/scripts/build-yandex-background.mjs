import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { gameRoot } from './lib.mjs';

const source = join(gameRoot, 'visual-references/yandex-release-09/bg-fire-chamber-yandex-v3-source.png');
const png = join(gameRoot, 'assets/backgrounds/bg-fire-chamber-yandex-v3.png');
const webp = join(gameRoot, 'assets/backgrounds/bg-fire-chamber-yandex-v3.webp');
const metadata = await sharp(source, { failOn: 'error' }).metadata();
if (metadata.width !== 940 || metadata.height !== 1672 || metadata.format !== 'png') {
  throw new Error(`Cycle 09 background source must be exact 940x1672 PNG, got ${metadata.width}x${metadata.height} ${metadata.format}.`);
}
await mkdir(dirname(png), { recursive: true });
await Promise.all([
  sharp(source, { failOn: 'error' }).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(png),
  sharp(source, { failOn: 'error' }).webp({ quality: 90, alphaQuality: 100, smartSubsample: true, effort: 6 }).toFile(webp),
]);
console.log('Cycle 09 Yandex background v3 PASS (940x1672, PNG/WebP)');
