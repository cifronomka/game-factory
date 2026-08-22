// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
async function bytes(path) { return readFile(new URL(path, root)); }
function sha(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

for (const spec of [
  ...['idle', 'inhale', 'blow', 'recovery'].map((clip) => ({ id: `CH-ASH-SERVANT-${clip.toUpperCase()}-C07`, version: 'v5', metadata: `assets/characters/ash-servant/ash-servant-${clip}-v5.json`, dimensions: [1024, 640, 256, 320], gutter: 6, centroid: clip === 'recovery' ? 22 : 16, minimumComponent: 0.999 })),
  ...['idle', 'cast', 'hold', 'recovery'].map((clip) => ({ id: `CH-DEMONESS-${clip.toUpperCase()}-C07`, version: 'v6', metadata: `assets/characters/demoness/demoness-${clip}-v6.json`, dimensions: [1648, 1328, 412, 664], gutter: 6, centroid: 22, minimumComponent: 0.999 })),
]) {
  test(`${spec.id} ${spec.version} cells preserve root, gutter, anatomy and metadata hashes`, async () => {
    const [manifestBuffer, metadataBuffer] = await Promise.all([bytes('assets/assets-manifest.json'), bytes(spec.metadata)]);
    const manifest = JSON.parse(manifestBuffer.toString());
    const metadata = JSON.parse(metadataBuffer.toString());
    const entry = manifest.assets.find((item) => item.id === spec.id);
    assert.equal(entry.metadataSha256, sha(metadataBuffer));
    assert.deepEqual([metadata.atlasWidth, metadata.atlasHeight, metadata.frameWidth, metadata.frameHeight], spec.dimensions);
    assert.equal(metadata.transparentGutterPixels, spec.gutter);
    for (const [clipName, clip] of Object.entries(metadata.clips)) {
      const roots = clip.frames.map((frame) => frame.rootY);
      const centroids = clip.frames.map((frame) => frame.centroidX);
      const anatomicalScales = clip.frames.map((frame) => frame.anatomicalScale);
      assert.ok(Math.max(...roots) - Math.min(...roots) <= 2, `${clipName} root drift`);
      assert.ok(Math.max(...centroids) - Math.min(...centroids) <= spec.centroid, `${clipName} centroid travel`);
      assert.ok(Math.max(...anatomicalScales) - Math.min(...anatomicalScales) <= 0.02, `${clipName} anatomical scale drift`);
      for (const frame of clip.frames) {
        assert.equal(frame.w, spec.dimensions[2]);
        assert.equal(frame.h, spec.dimensions[3]);
        assert.equal(frame.edgeAlphaPixels, 0);
        assert.ok(frame.largestComponentRatio >= spec.minimumComponent);
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
    bytes('assets/characters/ash-servant/ash-servant-blow-v5.json').then((value) => JSON.parse(value.toString())),
    bytes('assets/characters/ash-servant/ash-servant-recovery-v5.json').then((value) => JSON.parse(value.toString())),
  ]);
  const before = blow.clips.blow.frames.at(-1);
  const after = recovery.clips.recovery.frames[0];
  assert.ok(Math.abs(before.rootY - after.rootY) <= 2);
  assert.ok(Math.abs(before.centroidX - after.centroidX) <= 12);
  assert.ok(Math.abs(before.alphaBBox[2] - after.alphaBBox[2]) <= 12, 'extended hand silhouette remains continuous at the clip boundary');
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
