// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
async function bytes(path) { return readFile(new URL(path, root)); }
function sha(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

for (const spec of [
  { id: 'CH-ASH-SERVANT', version: 'v3', metadata: 'assets/characters/ash-servant/ash-servant-states-v3.json', dimensions: [1536, 1120, 256, 280], gutter: 8, centroid: 12, minimumComponent: 0.999 },
  { id: 'CH-DEMONESS', version: 'v4', metadata: 'assets/characters/demoness/demoness-states-v4.json', dimensions: [1536, 1152, 192, 288], gutter: 4, centroid: 12, minimumComponent: 0.998 },
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
      assert.ok(Math.max(...roots) - Math.min(...roots) <= 2, `${clipName} root drift`);
      assert.ok(Math.max(...centroids) - Math.min(...centroids) <= spec.centroid, `${clipName} centroid travel`);
      for (const frame of clip.frames) {
        assert.equal(frame.w, spec.dimensions[2]);
        assert.equal(frame.h, spec.dimensions[3]);
        assert.equal(frame.edgeAlphaPixels, 0);
        assert.ok(frame.largestComponentRatio >= spec.minimumComponent);
        assert.match(frame.sha256, /^[a-f0-9]{64}$/);
        assert.ok(frame.provenance.length > 20);
      }
      assert.equal(new Set(clip.frames.map((frame) => frame.sha256)).size, clip.frames.length);
    }
  });
}

test('Inferno host metadata exposes five real non-overlapping spatial regions', async () => {
  const metadata = JSON.parse((await bytes('assets/characters/character-inferno-host-v3.json')).toString());
  assert.equal(metadata.semantic, 'independent-spatial-regions-not-sequential-frames');
  assert.equal(metadata.clips.ambient.frames.length, 5);
  assert.equal(new Set(metadata.clips.ambient.frames.map((frame) => frame.sha256)).size, 5);
  for (const frame of metadata.clips.ambient.frames) {
    assert.match(frame.sha256, /^[a-f0-9]{64}$/);
    assert.ok(frame.provenance.includes('spatial region'));
  }
});
