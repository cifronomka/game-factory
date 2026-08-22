// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../../', import.meta.url);
async function bytes(path) { return readFile(new URL(path, root)); }
function sha(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

for (const spec of [
  ...['idle', 'inhale', 'blow', 'recovery'].map((clip) => ({ id: `CH-ASH-SERVANT-${clip.toUpperCase()}-C08`, version: 'v6', metadata: `assets/characters/ash-servant/ash-servant-${clip}-v6.json`, dimensions: [1024, 640, 256, 320], gutter: 6, centroid: clip === 'recovery' ? 22 : 16, minimumComponent: 0.999 })),
  ...['idle', 'cast', 'hold', 'recovery'].map((clip) => ({ id: `CH-DEMONESS-${clip.toUpperCase()}-C08`, version: 'v7', metadata: `assets/characters/demoness/demoness-${clip}-v7.json`, dimensions: [2048, 1664, 512, 832], gutter: 6, centroid: 28, minimumComponent: 0.999 })),
]) {
  test(`${spec.id} ${spec.version} cells preserve clean alpha, root, anatomy and manifest hashes`, async () => {
    const [manifestBuffer, metadataBuffer] = await Promise.all([bytes('assets/assets-manifest.json'), bytes(spec.metadata)]);
    const manifest = JSON.parse(manifestBuffer.toString());
    const metadata = JSON.parse(metadataBuffer.toString());
    const entry = manifest.assets.find((item) => item.id === spec.id);
    assert.ok(entry, `${spec.id} is missing from the asset manifest`);
    const atlasBuffer = await bytes(entry.path);
    const decodedAtlas = await sharp(atlasBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(entry.sha256, sha(atlasBuffer));
    assert.equal(entry.metadataSha256, sha(metadataBuffer));
    assert.equal(metadata.cycle, '08');
    assert.deepEqual([entry.width, entry.height], spec.dimensions.slice(0, 2));
    assert.deepEqual([metadata.atlasWidth, metadata.atlasHeight, metadata.frameWidth, metadata.frameHeight], spec.dimensions);
    assert.equal(metadata.transparentGutterPixels, spec.gutter);
    const sourceInfo = await sharp(await bytes(metadata.sourceSheet)).metadata();
    assert.ok(sourceInfo.width % 4 === 0 && sourceInfo.height % 2 === 0, `${spec.id} source must be an exact 4x2 sheet`);
    const sourceFrame = [sourceInfo.width / 4, sourceInfo.height / 2];
    const measuredSourceToAtlasUpscale = Math.max(spec.dimensions[2] / sourceFrame[0], spec.dimensions[3] / sourceFrame[1]);
    assert.ok(measuredSourceToAtlasUpscale <= 1, `${spec.id} source artwork is upscaled ${measuredSourceToAtlasUpscale.toFixed(4)}x into its atlas cell`);
    for (const [clipName, clip] of Object.entries(metadata.clips)) {
      const roots = clip.frames.map((frame) => frame.rootY);
      const centroids = clip.frames.map((frame) => frame.centroidX);
      const anatomicalScales = clip.frames.map((frame) => frame.anatomicalScale);
      assert.ok(Math.max(...roots) - Math.min(...roots) <= 2, `${clipName} root drift`);
      assert.ok(Math.max(...centroids) - Math.min(...centroids) <= spec.centroid, `${clipName} centroid travel`);
      assert.ok(Math.max(...anatomicalScales) - Math.min(...anatomicalScales) <= 0.02, `${clipName} anatomical scale drift`);
      for (const frame of clip.frames) {
        const decodedAlpha = Buffer.alloc(frame.w * frame.h);
        for (let y = 0; y < frame.h; y += 1) {
          for (let x = 0; x < frame.w; x += 1) decodedAlpha[y * frame.w + x] = decodedAtlas.data[((frame.y + y) * decodedAtlas.info.width + frame.x + x) * 4 + 3];
        }
        assert.equal(frame.w, spec.dimensions[2]);
        assert.equal(frame.h, spec.dimensions[3]);
        assert.equal(frame.encodedAlphaExact, true, `${clipName} frame must use lossless encoded alpha`);
        assert.equal(frame.encodedAlphaSha256, frame.alphaSha256, `${clipName} frame encoded-alpha metadata drifted`);
        assert.equal(sha(decodedAlpha), frame.alphaSha256, `${clipName} frame WebP alpha differs from the approved source mask`);
        assert.equal(frame.edgeAlphaPixels, 0);
        assert.ok(frame.largestComponentRatio >= spec.minimumComponent);
        assert.ok(Number.isFinite(frame.matteRatio) && frame.matteRatio <= 0.01, `${clipName} frame has a white alpha fringe`);
        assert.ok(Number.isFinite(frame.internalNeutralResidueRatio) && frame.internalNeutralResidueRatio <= 0.005, `${clipName} frame has neutral-white residue inside the silhouette apertures`);
        assert.deepEqual([frame.sourceFrameWidth, frame.sourceFrameHeight], sourceFrame);
        assert.ok(Number.isFinite(frame.sourceToAtlasUpscale) && Math.abs(frame.sourceToAtlasUpscale - measuredSourceToAtlasUpscale) < 0.00001, `${clipName} frame source-upscale metadata is stale`);
        assert.ok(frame.sourceToAtlasUpscale <= 1, `${clipName} frame exceeds the native-source upscale limit`);
        if (spec.id.startsWith('CH-ASH-SERVANT')) assert.equal(frame.detachedPartialAlphaPixelCount, 0, `${clipName} frame retains detached block contour pixels`);
        assert.match(frame.sha256, /^[a-f0-9]{64}$/);
        assert.ok(frame.provenance.length > 20);
        if (spec.id.startsWith('CH-ASH-SERVANT')) assert.equal(frame.sockets.mouth.length, 2);
        if (spec.id.startsWith('CH-DEMONESS') && ['cast', 'hold'].includes(clipName)) {
          assert.equal(frame.sockets.leftHand.length, 2);
          assert.equal(frame.sockets.rightHand.length, 2);
        }
      }
      assert.equal(new Set(clip.frames.map((frame) => frame.sha256)).size, clip.frames.length);
    }
  });
}

test('Servant blow-to-recovery boundary preserves the final forward pose before settling', async () => {
  const [blow, recovery] = await Promise.all([
    bytes('assets/characters/ash-servant/ash-servant-blow-v6.json').then((value) => JSON.parse(value.toString())),
    bytes('assets/characters/ash-servant/ash-servant-recovery-v6.json').then((value) => JSON.parse(value.toString())),
  ]);
  const before = blow.clips.blow.frames.at(-1);
  const after = recovery.clips.recovery.frames[0];
  assert.ok(Math.abs(before.rootY - after.rootY) <= 2);
  assert.ok(Math.abs(before.centroidX - after.centroidX) <= 12);
  assert.ok(Math.abs(before.alphaBBox[2] - after.alphaBBox[2]) <= 12, 'extended hand silhouette remains continuous at the clip boundary');
});

test('Cycle 08 Demoness visible silhouette stays at least 1.25x taller than the Servant in every authored frame', async () => {
  const readMetadata = (path) => bytes(path).then((value) => JSON.parse(value.toString()));
  const [servantAtlases, demonessAtlases] = await Promise.all([
    Promise.all(['idle', 'inhale', 'blow', 'recovery'].map((clip) => readMetadata(`assets/characters/ash-servant/ash-servant-${clip}-v6.json`))),
    Promise.all(['idle', 'cast', 'hold', 'recovery'].map((clip) => readMetadata(`assets/characters/demoness/demoness-${clip}-v7.json`))),
  ]);
  const displayedHeights = (atlases, placementHeight) => atlases.flatMap((metadata) => Object.values(metadata.clips).flatMap((clip) => clip.frames.map((frame) => {
    assert.ok(Array.isArray(frame.alphaBBox) && frame.alphaBBox.length === 4, 'alphaBBox is required for silhouette dominance');
    return (frame.alphaBBox[3] - frame.alphaBBox[1]) / metadata.frameHeight * placementHeight;
  })));
  const tallestServant = Math.max(...displayedHeights(servantAtlases, 590));
  const shortestDemoness = Math.min(...displayedHeights(demonessAtlases, 840));
  assert.ok(shortestDemoness >= tallestServant * 1.25, `shortest Demoness ${shortestDemoness.toFixed(2)}px must be >= 1.25x tallest Servant ${tallestServant.toFixed(2)}px`);
});

test('Cycle 08 source manifest proves 32 native Demoness redraws instead of a resized C07 atlas', async () => {
  const sourceManifest = JSON.parse((await bytes('visual-references/cycle-08-sources/source-manifest.json')).toString());
  assert.equal(sourceManifest.cycle, '08');
  assert.equal(sourceManifest.generationMode, 'built-in OpenAI ImageGen');
  assert.equal(sourceManifest.demonessFrames.length, 32);
  assert.equal(sourceManifest.nativeSourceGate.oldRasterUpscaleUsed, false);
  assert.equal(sourceManifest.nativeSourceGate.maxSourceToAtlasUpscale, 1);
  assert.ok(sourceManifest.nativeSourceGate.demonessMinimumRawWidth >= 512);
  assert.ok(sourceManifest.nativeSourceGate.demonessMinimumRawHeight >= 832);
  assert.equal(new Set(sourceManifest.demonessFrames.map((entry) => entry.sha256)).size, 32);
  for (const entry of [sourceManifest.identityMaster, ...sourceManifest.demonessFrames, ...sourceManifest.assembledSheets]) {
    const buffer = await bytes(entry.path);
    const metadata = await sharp(buffer).metadata();
    assert.equal(sha(buffer), entry.sha256, `${entry.path} source hash drifted`);
    assert.deepEqual([metadata.width, metadata.height, metadata.channels, Boolean(metadata.hasAlpha)], [entry.width, entry.height, entry.channels, entry.hasAlpha]);
  }
});

test('Inferno host main and sentinel expose independently renderable clean authored states', async () => {
  const manifest = JSON.parse((await bytes('assets/assets-manifest.json')).toString());
  for (const part of ['main', 'sentinel']) {
    const metadataBuffer = await bytes(`assets/characters/character-inferno-host-${part}-v4.json`);
    const metadata = JSON.parse(metadataBuffer.toString());
    const entry = manifest.assets.find((item) => item.id === `CH-INFERNO-HOST-${part.toUpperCase()}-C06`);
    assert.equal(entry.metadataSha256, sha(metadataBuffer));
    assert.equal(metadata.clips.ambient.frames.length, 5);
    assert.equal(new Set(metadata.clips.ambient.frames.map((frame) => frame.sha256)).size, 5);
    const roots = metadata.clips.ambient.frames.map((frame) => frame.rootY);
    const centroids = metadata.clips.ambient.frames.map((frame) => frame.centroidX);
    const widths = metadata.clips.ambient.frames.map((frame) => frame.alphaBBox[2] - frame.alphaBBox[0]);
    assert.ok(Math.max(...roots) - Math.min(...roots) <= 1, `${part} root is unstable`);
    assert.ok(Math.max(...centroids) - Math.min(...centroids) <= 4, `${part} identity centroid jumps`);
    assert.ok(Math.max(...widths) - Math.min(...widths) <= 22, `${part} silhouette changes identity`);
    for (const frame of metadata.clips.ambient.frames) {
      assert.match(frame.sha256, /^[a-f0-9]{64}$/);
      assert.equal(frame.edgeAlphaPixels, 0);
      assert.ok(frame.provenance.includes('authored frame'));
    }
  }
});
