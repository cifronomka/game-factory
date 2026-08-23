// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  RUNTIME_VISUAL_FINGERPRINT_ALGORITHM,
  runtimeSheetPerceptualHashes,
} from '../../scripts/runtime-visual-fingerprint.mjs';

async function sheet({ alteredPixel = false, structuralChange = false } = {}) {
  const dpr = 1;
  const stageWidth = 96;
  const labelHeight = 28;
  const stageHeight = 160;
  const width = stageWidth * 7;
  const height = labelHeight + stageHeight;
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const stage = Math.floor(x / stageWidth);
      pixels[offset] = (x + stage * 23) % 256;
      pixels[offset + 1] = (y * 2 + stage * 19) % 256;
      pixels[offset + 2] = (x + y + stage * 31) % 256;
    }
  }
  if (alteredPixel) pixels[((labelHeight + 60) * width + stageWidth * 3 + 40) * channels] += 1;
  if (structuralChange) {
    for (let y = labelHeight + 35; y < labelHeight + 125; y += 1) {
      for (let x = stageWidth * 5 + 18; x < stageWidth * 5 + 78; x += 1) {
        const offset = (y * width + x) * channels;
        pixels[offset] = 255;
        pixels[offset + 1] = 255;
        pixels[offset + 2] = 255;
      }
    }
  }
  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

test('runtime visual fingerprint ignores one-channel one-LSB compositor noise', async () => {
  const [baseline, noisy] = await Promise.all([sheet(), sheet({ alteredPixel: true })]);
  assert.equal(RUNTIME_VISUAL_FINGERPRINT_ALGORITHM, 'stage-dhash-horizontal-16x16-lanczos3-grayscale-v1');
  assert.deepEqual(await runtimeSheetPerceptualHashes(noisy, 1), await runtimeSheetPerceptualHashes(baseline, 1));
});

test('runtime visual fingerprint detects a visible stage-local structural change', async () => {
  const [baseline, changed] = await Promise.all([sheet(), sheet({ structuralChange: true })]);
  const baselineHashes = await runtimeSheetPerceptualHashes(baseline, 1);
  const changedHashes = await runtimeSheetPerceptualHashes(changed, 1);
  assert.notDeepEqual(changedHashes, baselineHashes);
  assert.notEqual(changedHashes[5], baselineHashes[5]);
});
