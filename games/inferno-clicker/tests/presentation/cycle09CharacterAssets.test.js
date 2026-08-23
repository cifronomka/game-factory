// @ts-check

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { gameRoot } from '../../scripts/lib.mjs';
import { frameMetrics } from '../../scripts/build-cycle06-character-assets.mjs';
import { cleanCycle09Frame, cycle09Specs } from '../../scripts/build-cycle09-character-assets.mjs';

const root = resolve(gameRoot);
const sha = (value) => createHash('sha256').update(value).digest('hex');

/** @param {Buffer} rgba */
function alphaChannel(rgba) {
  const alpha = Buffer.alloc(rgba.length / 4);
  for (let source = 3, target = 0; source < rgba.length; source += 4, target += 1) alpha[target] = rgba[source];
  return alpha;
}

/** @param {Buffer} atlas @param {number} atlasWidth @param {{x:number,y:number,w:number,h:number}} frame */
function extractRawFrame(atlas, atlasWidth, frame) {
  const output = Buffer.alloc(frame.w * frame.h * 4);
  for (let y = 0; y < frame.h; y += 1) {
    const start = ((frame.y + y) * atlasWidth + frame.x) * 4;
    atlas.copy(output, y * frame.w * 4, start, start + frame.w * 4);
  }
  return output;
}

test('Cycle 09 cleanup deletes detached matte tiles and defringes the retained edge', () => {
  const width = 8;
  const height = 6;
  const input = Buffer.alloc(width * height * 4);
  const pixel = (x, y, [r, g, b, a]) => {
    const offset = (y * width + x) * 4;
    input[offset] = r;
    input[offset + 1] = g;
    input[offset + 2] = b;
    input[offset + 3] = a;
  };
  pixel(2, 2, [184, 61, 18, 255]);
  pixel(3, 2, [224, 224, 224, 128]);
  pixel(6, 4, [190, 190, 190, 128]);
  pixel(7, 4, [190, 190, 190, 96]);

  const cleaned = cleanCycle09Frame(input, width, height);
  const retained = (2 * width + 3) * 4;
  const detached = (4 * width + 6) * 4;
  assert.equal(cleaned.data[retained + 3], 128);
  assert.deepEqual([...cleaned.data.subarray(retained, retained + 3)], [184, 61, 18]);
  assert.deepEqual([...cleaned.data.subarray(detached, detached + 8)], [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(cleaned.removedDetachedPartialAlphaPixelCount, 2);
  assert.equal(frameMetrics(cleaned.data, width, height).detachedPartialAlphaPixelCount, 0);
});

test('Cycle 09 publishes 64 strict frames as new v7/v8 WebP and exact PNG fallbacks', async () => {
  assert.equal(cycle09Specs.length, 8);
  assert.deepEqual(cycle09Specs.map((spec) => `${spec.family}:${spec.clip}:${spec.version}`), [
    'ash-servant:idle:v7',
    'ash-servant:inhale:v7',
    'ash-servant:blow:v7',
    'ash-servant:recovery:v7',
    'demoness:idle:v8',
    'demoness:cast:v8',
    'demoness:hold:v8',
    'demoness:recovery:v8',
  ]);

  let auditedFrames = 0;
  let removedDemonessPixels = 0;
  let encodedBytes = 0;
  for (const spec of cycle09Specs) {
    const webpPath = resolve(root, spec.output);
    const pngPath = resolve(root, spec.pngOutput);
    const metadataPath = webpPath.replace(/\.webp$/i, '.json');
    const [webpBytes, pngBytes, metadataBytes, sourceBytes] = await Promise.all([
      readFile(webpPath),
      readFile(pngPath),
      readFile(metadataPath),
      readFile(resolve(root, metadataSource(spec.source))),
    ]);
    encodedBytes += webpBytes.length + pngBytes.length;
    const metadata = JSON.parse(metadataBytes.toString('utf8'));
    assert.equal(metadata.schemaVersion, 2);
    assert.equal(metadata.cycle, '09');
    assert.equal(metadata.sourceSheet, metadataSource(spec.source));
    assert.equal(metadata.sourceSheetSha256, sha(sourceBytes));
    assert.equal(metadata.atlasSha256, sha(webpBytes));
    assert.equal(metadata.pngFallbackSha256, sha(pngBytes));
    assert.equal(metadata.encoding.sha256, sha(webpBytes));
    assert.equal(metadata.fallbackEncoding.sha256, sha(pngBytes));
    assert.equal(metadata.strictAlphaAudit.detachedPartialAlphaPixelsMax, 0);
    assert.equal(metadata.alphaCleanup.strategy, 'opaque-adjacent-partial-alpha-contraction');
    if (spec.family === 'demoness') removedDemonessPixels += metadata.alphaCleanup.removedDetachedPartialAlphaPixelCount;

    const [webp, png] = await Promise.all([
      sharp(webpBytes, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(pngBytes, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    assert.deepEqual([webp.info.width, webp.info.height, webp.info.channels], [metadata.atlasWidth, metadata.atlasHeight, 4]);
    assert.deepEqual([png.info.width, png.info.height, png.info.channels], [metadata.atlasWidth, metadata.atlasHeight, 4]);
    assert.deepEqual(alphaChannel(webp.data), alphaChannel(png.data));

    const frames = metadata.clips[spec.clip].frames;
    assert.equal(frames.length, 8);
    for (const frame of frames) {
      auditedFrames += 1;
      const webpFrame = extractRawFrame(webp.data, webp.info.width, frame);
      const pngFrame = extractRawFrame(png.data, png.info.width, frame);
      const webpMetrics = frameMetrics(webpFrame, frame.w, frame.h);
      const pngMetrics = frameMetrics(pngFrame, frame.w, frame.h);
      assert.equal(sha(alphaChannel(webpFrame)), frame.alphaSha256);
      assert.equal(sha(alphaChannel(pngFrame)), frame.alphaSha256);
      assert.equal(frame.detachedPartialAlphaPixelCount, 0);
      assert.equal(webpMetrics.detachedPartialAlphaPixelCount, 0);
      assert.equal(pngMetrics.detachedPartialAlphaPixelCount, 0);
      assert.equal(webpMetrics.edgeAlphaPixels, 0);
      assert.equal(pngMetrics.edgeAlphaPixels, 0);
      assert.ok(webpMetrics.transparentGutterPixels >= 4);
      assert.ok(pngMetrics.transparentGutterPixels >= 4);
      assert.ok(webpMetrics.matteRatio <= 0.01);
      assert.ok(pngMetrics.matteRatio <= 0.01);
      assert.ok(webpMetrics.internalNeutralResidueRatio <= 0.005);
      assert.ok(pngMetrics.internalNeutralResidueRatio <= 0.005);
      assert.equal(frame.encodedAlphaExact, true);
      assert.equal(frame.pngEncodedAlphaExact, true);
    }
  }
  assert.equal(auditedFrames, 64);
  assert.equal(removedDemonessPixels, 164_413);
  assert.ok(encodedBytes < 32 * 1024 * 1024, `Cycle 09 dual-format atlases use ${encodedBytes} bytes`);
  await Promise.all([
    access(resolve(root, 'assets/characters/ash-servant/ash-servant-idle-v6.webp')),
    access(resolve(root, 'assets/characters/demoness/demoness-idle-v7.webp')),
  ]);
});

/** @param {string} source */
function metadataSource(source) {
  return `visual-references/cycle-08-sources/${source}`;
}
