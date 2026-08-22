// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { auditAnimationAssets } from '../../scripts/animation-assets-audit.mjs';

/** @param {string|Buffer} value */
function sha(value) { return createHash('sha256').update(value).digest('hex'); }

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'inferno-animation-assets-'));
  await mkdir(join(root, 'assets/meta'), { recursive: true });
  await writeFile(join(root, 'assets/PROVENANCE.md'), 'authored fixture\n');
  const assets = [];

  async function add(id, clipNames, frameCount = 8, loopNames = ['idle', 'ambient', 'loop']) {
    const clips = {};
    let cell = 0;
    for (const name of clipNames) {
      clips[name] = {
        fps: 10,
        loop: loopNames.includes(name),
        frames: Array.from({ length: frameCount }, (_, index) => ({
          x: (cell + index) * 10, y: 0, w: 10, h: 10,
          durationMs: 100, sha256: sha(`${id}/${name}/${index}`), provenance: 'fixture-author/export-v1', edgeAlphaPixels: 0, matteRatio: 0,
          rootY: 9, anatomicalScale: 1,
          sockets: id.startsWith('CH-ASH-SERVANT') ? { mouth: [0.5, 0.3] }
            : id.startsWith('CH-DEMONESS') ? { leftHand: [0.3, 0.4], rightHand: [0.7, 0.4] } : undefined,
        })),
      };
      cell += frameCount;
    }
    const metadata = { schemaVersion: 1, pivot: [0.5, 0.95], clips };
    const bytes = Buffer.from(`${JSON.stringify(metadata)}\n`);
    const metadataPath = `assets/meta/${id}.json`;
    await writeFile(join(root, metadataPath), bytes);
    assets.push({ id, path: `assets/${id}.webp`, metadata: metadataPath, metadataSha256: sha(bytes), kind: 'fixture-atlas', width: cell * 10, height: 10 });
  }

  for (const family of ['LOW', 'MID', 'HIGH']) for (const layer of ['CORE', 'OUTER']) await add(`FL-${family}-${layer}`, ['loop']);
  for (const clip of ['IDLE', 'INHALE', 'BLOW', 'RECOVERY']) await add(`CH-ASH-SERVANT-${clip}-C07`, [clip.toLowerCase()], 8);
  for (const clip of ['IDLE', 'CAST', 'HOLD', 'RECOVERY']) await add(`CH-DEMONESS-${clip}-C07`, [clip.toLowerCase()], 8);
  await add('CH-INFERNO-HOST-MAIN-C06', ['ambient'], 5);
  await add('CH-INFERNO-HOST-SENTINEL-C06', ['ambient'], 5);
  const manifest = { schemaVersion: 1, provenance: 'assets/PROVENANCE.md', assets };
  await writeFile(join(root, 'assets/assets-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, manifest };
}

test('animation asset hard gate accepts complete authored metadata', async () => {
  const { root } = await makeFixture();
  const report = await auditAnimationAssets({ root });
  assert.equal(report.status, 'PASS');
  assert.equal(report.animatedAssets.length, 16);
});

test('animation asset hard gate rejects missing per-frame authorship', async () => {
  const { root, manifest } = await makeFixture();
  const path = join(root, manifest.assets[0].metadata);
  const metadata = JSON.parse(await readFile(path, 'utf8'));
  delete metadata.clips.loop.frames[0].provenance;
  const bytes = Buffer.from(JSON.stringify(metadata));
  await writeFile(path, bytes);
  manifest.assets[0].metadataSha256 = sha(bytes);
  await writeFile(join(root, 'assets/assets-manifest.json'), JSON.stringify(manifest));
  await assert.rejects(() => auditAnimationAssets({ root }), /missing provenance/);
});

test('animation asset hard gate rejects corrupt metadata hashes', async () => {
  const { root, manifest } = await makeFixture();
  manifest.assets[0].metadataSha256 = '0'.repeat(64);
  await writeFile(join(root, 'assets/assets-manifest.json'), JSON.stringify(manifest));
  await assert.rejects(() => auditAnimationAssets({ root }), /metadata hash mismatch/);
});
