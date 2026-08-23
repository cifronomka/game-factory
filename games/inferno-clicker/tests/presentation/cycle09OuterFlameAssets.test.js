import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const families = ['low', 'mid', 'high'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function normalizedTransparentRgb(pixels) {
  const normalized = Buffer.from(pixels);
  for (let offset = 0; offset < normalized.length; offset += 4) {
    if (normalized[offset + 3] !== 0) continue;
    normalized[offset] = 0;
    normalized[offset + 1] = 0;
    normalized[offset + 2] = 0;
  }
  return normalized;
}

function extractFrame(atlas, atlasWidth, frame) {
  const pixels = Buffer.alloc(frame.w * frame.h * 4);
  for (let y = 0; y < frame.h; y += 1) {
    const sourceStart = ((frame.y + y) * atlasWidth + frame.x) * 4;
    atlas.copy(pixels, y * frame.w * 4, sourceStart, sourceStart + frame.w * 4);
  }
  return pixels;
}

function componentSizes(pixels, width, height) {
  const seen = new Uint8Array(width * height);
  const sizes = [];
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (seen[pixel] || pixels[pixel * 4 + 3] === 0) continue;
    const stack = [pixel];
    let size = 0;
    seen[pixel] = 1;
    while (stack.length > 0) {
      const current = stack.pop();
      size += 1;
      const x = current % width;
      const y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (!seen[next] && pixels[next * 4 + 3] > 0) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
    }
    sizes.push(size);
  }
  return sizes.sort((left, right) => right - left);
}

test('Cycle 09 outer flame v3 preserves every authored frame contract and has exact visible PNG/WebP parity', async () => {
  for (const family of families) {
    const baseUrl = new URL(`../../assets/flame/atlases/outer-${family}-`, import.meta.url);
    const [sourceMetadata, metadata, png, webp] = await Promise.all([
      readFile(new URL(`${baseUrl.href}v2.json`), 'utf8').then(JSON.parse),
      readFile(new URL(`${baseUrl.href}v3.json`), 'utf8').then(JSON.parse),
      readFile(new URL(`${baseUrl.href}v3.png`)),
      readFile(new URL(`${baseUrl.href}v3.webp`)),
    ]);
    const [decodedPng, decodedWebp] = await Promise.all([
      sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    assert.deepEqual(
      {
        family: metadata.family,
        fps: metadata.fps,
        frameHeight: metadata.frameHeight,
        frameWidth: metadata.frameWidth,
        layer: metadata.layer,
        loop: metadata.loop,
        phaseOffsetFrames: metadata.phaseOffsetFrames,
        pivot: metadata.pivot,
        rectangles: metadata.frames.map(({ x, y, w, h, durationMs }) => ({ x, y, w, h, durationMs })),
      },
      {
        family: sourceMetadata.family,
        fps: sourceMetadata.fps,
        frameHeight: sourceMetadata.frameHeight,
        frameWidth: sourceMetadata.frameWidth,
        layer: sourceMetadata.layer,
        loop: sourceMetadata.loop,
        phaseOffsetFrames: sourceMetadata.phaseOffsetFrames,
        pivot: sourceMetadata.pivot,
        rectangles: sourceMetadata.frames.map(({ x, y, w, h, durationMs }) => ({ x, y, w, h, durationMs })),
      },
      `${family}: layout/timing/pivot changed`,
    );
    assert.equal(decodedPng.info.width, decodedWebp.info.width);
    assert.equal(decodedPng.info.height, decodedWebp.info.height);
    const normalizedPng = normalizedTransparentRgb(decodedPng.data);
    const normalizedWebp = normalizedTransparentRgb(decodedWebp.data);
    assert.deepEqual(normalizedPng, normalizedWebp, `${family}: visible decoded RGBA differs between PNG and WebP`);
    assert.equal(metadata.alphaCleanup.pngWebpDecodedRgbaParity, true);
    assert.equal(metadata.alphaCleanup.detachedAlphaPixelCount, 0);
    assert.equal(metadata.alphaCleanup.neutralEdgePixelCount, 0);
    assert.equal(metadata.alphaCleanup.coolEdgePixelCount, 0);
    for (const frame of metadata.frames) {
      const pixels = extractFrame(normalizedWebp, decodedWebp.info.width, frame);
      assert.deepEqual(componentSizes(pixels, frame.w, frame.h).length, 1, `${family}: detached alpha remains in frame ${frame.x},${frame.y}`);
      assert.equal(sha256(pixels), frame.sha256, `${family}: decoded frame hash mismatch`);
    }
  }
});

test('Cycle 09 outer flame cleanup is material and removes the known v2 residue classes', async () => {
  const metadata = await Promise.all(families.map((family) => readFile(
    new URL(`../../assets/flame/atlases/outer-${family}-v3.json`, import.meta.url),
    'utf8',
  ).then(JSON.parse)));
  assert.equal(metadata.reduce((sum, entry) => sum + entry.frames.length, 0), 30);
  assert.equal(metadata.reduce((sum, entry) => sum + entry.alphaCleanup.removedLowAlphaPixelCount, 0), 288604);
  assert.equal(metadata.reduce((sum, entry) => sum + entry.alphaCleanup.removedDetachedAlphaPixelCount, 0), 3479);
  assert.equal(metadata.reduce((sum, entry) => sum + entry.alphaCleanup.recoloredNeutralEdgePixelCount, 0), 6753);
});
