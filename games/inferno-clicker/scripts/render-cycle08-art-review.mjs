// @ts-check

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputRoot = join(root, 'reports', 'corrective-cycle-08', 'working-art-review');
const backgrounds = Object.freeze(['#050505', '#350b0b', '#777777']);

function svgOverlay(width, height, label, sockets = {}) {
  const circles = Object.entries(sockets).map(([name, point], index) => {
    if (!Array.isArray(point) || point.length !== 2) return '';
    const color = index === 0 ? '#ff3dff' : '#28ffff';
    return `<circle cx="${point[0] * width}" cy="${point[1] * height}" r="8" fill="none" stroke="${color}" stroke-width="3"/><text x="${point[0] * width + 10}" y="${point[1] * height - 10}" fill="${color}" font-size="16">${name}</text>`;
  }).join('');
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="150" height="30" rx="4" fill="#000" fill-opacity=".7"/><text x="12" y="26" fill="#fff" font-family="sans-serif" font-size="18">${label}</text>${circles}</svg>`);
}

async function renderedFrame(family, clip, version, frameIndex, width, height, background, markSockets) {
  const atlasPath = join(root, 'assets', 'characters', family, `${family}-${clip}-${version}.webp`);
  const metadata = JSON.parse(await readFile(atlasPath.replace(/\.webp$/, '.json'), 'utf8'));
  const frame = metadata.clips[clip].frames[frameIndex];
  const image = await sharp(atlasPath)
    .extract({ left: frame.x, top: frame.y, width: frame.w, height: frame.h })
    .resize(width, height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const composites = [{ input: image }];
  if (markSockets) composites.push({ input: svgOverlay(width, height, `${clip} ${frameIndex}`, frame.sockets) });
  return sharp({ create: { width, height, channels: 4, background } }).composite(composites).png().toBuffer();
}

async function contactSheet(family, clip, version, width, height, markSockets = false) {
  const frames = await Promise.all(Array.from({ length: 8 }, (_, index) => renderedFrame(family, clip, version, index, width, height, '#240909', markSockets)));
  await sharp({ create: { width: width * 4, height: height * 2, channels: 4, background: '#240909' } })
    .composite(frames.map((input, index) => ({ input, left: index % 4 * width, top: Math.floor(index / 4) * height })))
    .png({ compressionLevel: 9 })
    .toFile(join(outputRoot, `${family}-${clip}-contact.png`));
}

async function backgroundTriptych(family, clip, version, frameIndex, width, height) {
  const frames = await Promise.all(backgrounds.map((background) => renderedFrame(family, clip, version, frameIndex, width, height, background, false)));
  await sharp({ create: { width: width * backgrounds.length, height, channels: 4, background: '#000' } })
    .composite(frames.map((input, index) => ({ input, left: index * width, top: 0 })))
    .png({ compressionLevel: 9 })
    .toFile(join(outputRoot, `${family}-${clip}-${frameIndex}-backgrounds.png`));
}

await mkdir(outputRoot, { recursive: true });
for (const clip of ['idle', 'cast', 'hold', 'recovery']) await contactSheet('demoness', clip, 'v7', 504, 840, ['cast', 'hold'].includes(clip));
for (const clip of ['idle', 'inhale', 'blow', 'recovery']) await contactSheet('ash-servant', clip, 'v6', 540, 590, false);
for (const [family, clip, version, frameIndex, width, height] of [
  ['demoness', 'idle', 'v7', 0, 504, 840],
  ['demoness', 'cast', 'v7', 4, 504, 840],
  ['demoness', 'hold', 'v7', 0, 504, 840],
  ['demoness', 'recovery', 'v7', 7, 504, 840],
  ['ash-servant', 'idle', 'v6', 0, 540, 590],
  ['ash-servant', 'blow', 'v6', 0, 540, 590],
]) await backgroundTriptych(family, clip, version, frameIndex, width, height);
await writeFile(join(outputRoot, 'README.txt'), `Cycle 08 working asset review

This directory is a working-tree review aid, not final exact-build release evidence.
It contains all-frame contact sheets plus representative composites on black,
dark-red and neutral-gray backgrounds at runtime draw size.

The automated gates separately require exact approved-mask to decoded-WebP alpha
SHA-256 parity for all 64 affected frames and zero detached Servant contour tiles.
Human-Eye review remains mandatory and can veto a passing numeric scan.

Final browser/evidence results are recorded only after a clean immutable build and
independent regression QA.
`);
console.log(`Cycle 08 art review rendered to ${outputRoot}`);
