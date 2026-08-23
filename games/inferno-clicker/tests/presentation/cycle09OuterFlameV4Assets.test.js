import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const families = ['low', 'mid', 'high'];
const edgeAlphaCaps = { 1: 72, 2: 160, 3: 224 };
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

function distanceToTransparent(pixels, width, height, x, y) {
  for (let radius = 1; radius <= 4; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return radius;
        if (pixels[(nextY * width + nextX) * 4 + 3] === 0) return radius;
      }
    }
  }
  return 5;
}

function colorStats(r, g, b) {
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  return { maximum, saturation: maximum === 0 ? 0 : (maximum - minimum) / maximum };
}

function sourceMatteColor(r, g, b) {
  const { maximum, saturation } = colorStats(r, g, b);
  if (maximum < 8) return false;
  return saturation < 0.5 || (g >= r * 0.55 && g >= b * 1.08 && b <= r * 0.72);
}

function componentCount(pixels, width, height) {
  const seen = new Uint8Array(width * height);
  let components = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (seen[pixel] || pixels[pixel * 4 + 3] === 0) continue;
    components += 1;
    const stack = [pixel];
    seen[pixel] = 1;
    while (stack.length > 0) {
      const current = stack.pop();
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
  }
  return components;
}

function independentAudit(pixels, width, height) {
  const result = {
    internalLowChromaMattePixelCount: 0,
    internalOliveMattePixelCount: 0,
    neutralEdgePixelCount: 0,
    coolEdgePixelCount: 0,
    stickerEdgePixelCount: 0,
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      if (alpha === 0) continue;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const depth = distanceToTransparent(pixels, width, height, x, y);
      const { maximum, saturation } = colorStats(r, g, b);
      if (alpha >= 32 && depth >= 2 && maximum >= 8) {
        if (saturation < 0.5) result.internalLowChromaMattePixelCount += 1;
        if (g >= r * 0.55 && g >= b * 1.08 && b <= r * 0.72) result.internalOliveMattePixelCount += 1;
      }
      if ((depth === 1 && alpha > edgeAlphaCaps[1])
        || (depth === 2 && alpha > edgeAlphaCaps[2])
        || (depth === 3 && alpha > edgeAlphaCaps[3])) result.stickerEdgePixelCount += 1;
      if (depth !== 1) continue;
      if (saturation < 0.32 && maximum < 245) result.neutralEdgePixelCount += 1;
      if (maximum < 248 && (g > r * 1.03 || b > r * 0.9)) result.coolEdgePixelCount += 1;
    }
  }
  return result;
}

test('Cycle 09 outer flame v4 preserves 30-frame contracts and has exact visible PNG/WebP parity', async () => {
  let totalFrames = 0;
  for (const family of families) {
    const base = new URL(`../../assets/flame/atlases/outer-${family}-`, import.meta.url).href;
    const [sourceMetadata, metadata, png, webp] = await Promise.all([
      readFile(new URL(`${base}v3.json`), 'utf8').then(JSON.parse),
      readFile(new URL(`${base}v4.json`), 'utf8').then(JSON.parse),
      readFile(new URL(`${base}v4.png`)),
      readFile(new URL(`${base}v4.webp`)),
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
      `${family}: v4 changed frame layout/timing/pivot`,
    );
    const normalizedPng = normalizedTransparentRgb(decodedPng.data);
    const normalizedWebp = normalizedTransparentRgb(decodedWebp.data);
    assert.deepEqual(normalizedPng, normalizedWebp, `${family}: PNG/WebP visible RGBA mismatch`);
    assert.equal(metadata.visualCleanup.pngWebpVisibleDecodedRgbaParity, true);
    totalFrames += metadata.frames.length;
    for (const frame of metadata.frames) {
      const pixels = extractFrame(normalizedWebp, decodedWebp.info.width, frame);
      assert.equal(componentCount(pixels, frame.w, frame.h), 1, `${family}: detached component remains`);
      assert.equal(sha256(pixels), frame.sha256, `${family}: frame hash mismatch`);
      assert.deepEqual(independentAudit(pixels, frame.w, frame.h), {
        internalLowChromaMattePixelCount: 0,
        internalOliveMattePixelCount: 0,
        neutralEdgePixelCount: 0,
        coolEdgePixelCount: 0,
        stickerEdgePixelCount: 0,
      }, `${family}: independent matte/edge audit failed`);
    }
  }
  assert.equal(totalFrames, 30);
});

test('Cycle 09 outer flame v4 suppresses every detected v3 matte pixel below the visible-matte gate', async () => {
  let detectedSourceMattePixelCount = 0;
  let suppressedSourceMattePixelCount = 0;
  for (const family of families) {
    const base = new URL(`../../assets/flame/atlases/outer-${family}-`, import.meta.url).href;
    const [sourceBytes, outputBytes] = await Promise.all([
      readFile(new URL(`${base}v3.webp`)),
      readFile(new URL(`${base}v4.webp`)),
    ]);
    const [source, output] = await Promise.all([
      sharp(sourceBytes).ensureAlpha().raw().toBuffer(),
      sharp(outputBytes).ensureAlpha().raw().toBuffer(),
    ]);
    for (let offset = 0; offset < source.length; offset += 4) {
      if (source[offset + 3] === 0 || !sourceMatteColor(source[offset], source[offset + 1], source[offset + 2])) continue;
      detectedSourceMattePixelCount += 1;
      if (output[offset + 3] <= 24) suppressedSourceMattePixelCount += 1;
    }
  }
  assert.equal(detectedSourceMattePixelCount, 514476);
  assert.equal(suppressedSourceMattePixelCount, detectedSourceMattePixelCount);
});
