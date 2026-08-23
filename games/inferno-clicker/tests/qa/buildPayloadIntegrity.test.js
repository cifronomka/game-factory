// @ts-check

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyBuildPayload } from '../../scripts/lib.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'inferno-build-integrity-'));
  await mkdir(join(root, 'assets'), { recursive: true });
  const files = new Map([
    ['assets/flame.bin', Buffer.from([0, 1, 2, 3])],
    ['game.js', Buffer.from('window.game = true;\n')],
  ]);
  for (const [path, bytes] of files) await writeFile(join(root, ...path.split('/')), bytes);
  const manifest = {
    version: '1.0.0',
    unpackedBytes: 0,
    files: [...files].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: digest(bytes) })),
  };
  let serialized = '';
  for (let iteration = 0; iteration < 8; iteration += 1) {
    serialized = `${JSON.stringify(manifest, null, 2)}\n`;
    const unpackedBytes = [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0) + Buffer.byteLength(serialized);
    if (manifest.unpackedBytes === unpackedBytes) break;
    manifest.unpackedBytes = unpackedBytes;
  }
  serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(join(root, 'build-manifest.json'), serialized);
  return { root, manifest };
}

test('build payload verifier binds every served byte to the manifest', async () => {
  const { root, manifest } = await fixture();
  try {
    const result = await verifyBuildPayload(root, manifest);
    assert.equal(result.fileCount, 2);
    assert.equal(result.unpackedBytes, manifest.unpackedBytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('build payload verifier rejects a substituted file under an unchanged manifest', async () => {
  const { root, manifest } = await fixture();
  try {
    await writeFile(join(root, 'game.js'), 'window.game = lies;\n');
    await assert.rejects(() => verifyBuildPayload(root, manifest), /integrity mismatch for game\.js/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('build payload verifier rejects unmanifested files', async () => {
  const { root, manifest } = await fixture();
  try {
    await writeFile(join(root, 'unexpected.txt'), 'not in the manifest');
    await assert.rejects(() => verifyBuildPayload(root, manifest), /unexpected: unexpected\.txt/u);
    assert.equal(JSON.parse(await readFile(join(root, 'build-manifest.json'), 'utf8')).version, '1.0.0');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
