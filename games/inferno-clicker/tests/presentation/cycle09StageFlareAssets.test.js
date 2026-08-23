import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

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

function isBoundaryPixel(pixels, width, height, x, y) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return true;
      if (pixels[(nextY * width + nextX) * 4 + 3] === 0) return true;
    }
  }
  return false;
}

function residueMetrics(pixels, width, height) {
  let neutral = 0;
  let cool = 0;
  let problematic = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (pixels[offset + 3] === 0 || !isBoundaryPixel(pixels, width, height, x, y)) continue;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const maximum = Math.max(r, g, b);
      const minimum = Math.min(r, g, b);
      const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
      const isNeutral = saturation < 0.32 && maximum < 245;
      const isCool = maximum < 248 && (g > r * 1.03 || b > r * 0.9);
      if (isNeutral) neutral += 1;
      if (isCool) cool += 1;
      if (isNeutral || isCool) problematic += 1;
    }
  }
  return Object.freeze({ neutral, cool, problematic });
}

test('Cycle 09 stage flare v3 preserves the accepted eight-frame layout, timing, pivot and direction contract', async () => {
  const [sourceMetadata, metadata, png, webp] = await Promise.all([
    readFile(new URL('../../assets/flame/transitions/stage-flare-v2.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../assets/flame/transitions/stage-flare-v3.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../assets/flame/transitions/stage-flare-v3.png', import.meta.url)),
    readFile(new URL('../../assets/flame/transitions/stage-flare-v3.webp', import.meta.url)),
  ]);
  const [decodedPng, decodedWebp] = await Promise.all([
    sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  assert.deepEqual(
    {
      schemaVersion: metadata.schemaVersion,
      frameWidth: metadata.frameWidth,
      frameHeight: metadata.frameHeight,
      fps: metadata.fps,
      loop: metadata.loop,
      pivot: metadata.pivot,
      phaseOffsetFrames: metadata.phaseOffsetFrames ?? null,
      rectangles: metadata.frames.map(({ x, y, w, h, durationMs }) => ({ x, y, w, h, durationMs })),
    },
    {
      schemaVersion: sourceMetadata.schemaVersion,
      frameWidth: sourceMetadata.frameWidth,
      frameHeight: sourceMetadata.frameHeight,
      fps: sourceMetadata.fps,
      loop: sourceMetadata.loop,
      pivot: sourceMetadata.pivot,
      phaseOffsetFrames: sourceMetadata.phaseOffsetFrames ?? null,
      rectangles: sourceMetadata.frames.map(({ x, y, w, h, durationMs }) => ({ x, y, w, h, durationMs })),
    },
  );
  assert.deepEqual({
    atlasWidth: decodedPng.info.width,
    atlasHeight: decodedPng.info.height,
    frameWidth: metadata.frameWidth,
    frameHeight: metadata.frameHeight,
    frames: metadata.frames.length,
    columns: decodedPng.info.width / metadata.frameWidth,
    rows: decodedPng.info.height / metadata.frameHeight,
    fps: metadata.fps,
    loop: metadata.loop,
    pivot: metadata.pivot,
    phaseOffsetFrames: metadata.phaseOffsetFrames ?? null,
  }, {
    atlasWidth: 1024,
    atlasHeight: 1024,
    frameWidth: 256,
    frameHeight: 512,
    frames: 8,
    columns: 4,
    rows: 2,
    fps: 8,
    loop: false,
    pivot: [0.5, 0.965],
    phaseOffsetFrames: null,
  });
  assert.deepEqual(normalizedTransparentRgb(decodedPng.data), normalizedTransparentRgb(decodedWebp.data), 'visible decoded PNG/WebP RGBA differs');
  assert.equal(metadata.alphaCleanup.pngWebpDecodedRgbaParity, true);
});

test('Cycle 09 stage flare v3 removes every detached island and neutral/cool boundary patch on all review backgrounds', async () => {
  const [metadata, webp] = await Promise.all([
    readFile(new URL('../../assets/flame/transitions/stage-flare-v3.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../assets/flame/transitions/stage-flare-v3.webp', import.meta.url)),
  ]);
  const decoded = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const atlas = normalizedTransparentRgb(decoded.data);
  for (const [index, frame] of metadata.frames.entries()) {
    const pixels = extractFrame(atlas, decoded.info.width, frame);
    assert.deepEqual(componentSizes(pixels, frame.w, frame.h).length, 1, `frame ${index}: detached alpha remains`);
    assert.deepEqual(residueMetrics(pixels, frame.w, frame.h), { neutral: 0, cool: 0, problematic: 0 }, `frame ${index}: edge residue remains`);
    assert.equal(sha256(pixels), frame.sha256, `frame ${index}: decoded RGBA hash mismatch`);
  }
  assert.deepEqual(metadata.alphaCleanup.backgroundAudits, [
    { id: 'black', color: { r: 0, g: 0, b: 0, alpha: 1 }, boundaryPixelCount: 39478, detachedAlphaPixelCount: 0, neutralEdgePixelCount: 0, coolEdgePixelCount: 0 },
    { id: 'neutral-gray', color: { r: 92, g: 92, b: 92, alpha: 1 }, boundaryPixelCount: 39478, detachedAlphaPixelCount: 0, neutralEdgePixelCount: 0, coolEdgePixelCount: 0 },
    { id: 'dark-red', color: { r: 82, g: 8, b: 8, alpha: 1 }, boundaryPixelCount: 39478, detachedAlphaPixelCount: 0, neutralEdgePixelCount: 0, coolEdgePixelCount: 0 },
  ]);
});

test('Cycle 09 stage flare cleanup has fixed material source and deterministic output metrics', async () => {
  const [sourceWebp, sourceMetadata, png, webp, metadataBytes] = await Promise.all([
    readFile(new URL('../../assets/flame/transitions/stage-flare-v2.webp', import.meta.url)),
    readFile(new URL('../../assets/flame/transitions/stage-flare-v2.json', import.meta.url)),
    readFile(new URL('../../assets/flame/transitions/stage-flare-v3.png', import.meta.url)),
    readFile(new URL('../../assets/flame/transitions/stage-flare-v3.webp', import.meta.url)),
    readFile(new URL('../../assets/flame/transitions/stage-flare-v3.json', import.meta.url)),
  ]);
  const metadata = JSON.parse(metadataBytes);
  assert.equal(sha256(sourceWebp), '3b2b549ffca0ea40a8a4904e2af63e5e4eadfd2524599df305152d2e1a530ffe');
  assert.equal(sha256(sourceMetadata), 'f19a993c45000509eb58eaa7d883d3d2ed9aef2b6f52bdf6b75154a32931ce44');
  assert.equal(sha256(png), 'f3cdff549b03dddd20ce7ced4ebbee09d09ad9291451b3852fa5da0b16782be5');
  assert.equal(sha256(webp), 'b0891a2ec4143f3e81acf4d9956f0eace1bf6515200a0b5e5ff600cb2b6529a8');
  assert.deepEqual(metadata.alphaCleanup.sourceAudit, {
    componentCount: 1079,
    detachedAlphaPixelCount: 3427,
    neutralEdgePixelCount: 400,
    coolEdgePixelCount: 28,
    problematicEdgePixelCount: 428,
  });
  assert.deepEqual({
    activePixelCount: metadata.alphaCleanup.activePixelCount,
    boundaryPixelCount: metadata.alphaCleanup.boundaryPixelCount,
    removedLowAlphaPixelCount: metadata.alphaCleanup.removedLowAlphaPixelCount,
    removedDetachedAlphaPixelCount: metadata.alphaCleanup.removedDetachedAlphaPixelCount,
    recoloredNeutralOrCoolEdgePixelCount: metadata.alphaCleanup.recoloredNeutralOrCoolEdgePixelCount,
    removedUnrecoverableEdgePixelCount: metadata.alphaCleanup.removedUnrecoverableEdgePixelCount,
    detachedAlphaPixelCount: metadata.alphaCleanup.detachedAlphaPixelCount,
    neutralEdgePixelCount: metadata.alphaCleanup.neutralEdgePixelCount,
    coolEdgePixelCount: metadata.alphaCleanup.coolEdgePixelCount,
    problematicEdgePixelCount: metadata.alphaCleanup.problematicEdgePixelCount,
  }, {
    activePixelCount: 363959,
    boundaryPixelCount: 39478,
    removedLowAlphaPixelCount: 179243,
    removedDetachedAlphaPixelCount: 558,
    recoloredNeutralOrCoolEdgePixelCount: 0,
    removedUnrecoverableEdgePixelCount: 0,
    detachedAlphaPixelCount: 0,
    neutralEdgePixelCount: 0,
    coolEdgePixelCount: 0,
    problematicEdgePixelCount: 0,
  });
});
