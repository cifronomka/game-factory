// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const captureDir = new URL('../../reports/screenshots/corrective/', import.meta.url);

test('corrective browser matrix is valid when generated release evidence is present', async () => {
  let entries;
  try {
    entries = await readdir(captureDir);
  } catch (error) {
    if (/** @type {{code?:string}} */ (error).code === 'ENOENT') return;
    throw error;
  }
  const manifest = JSON.parse(await readFile(new URL('manifest.json', captureDir), 'utf8'));
  const files = entries.filter((file) => file.endsWith('.png')).sort();
  assert.equal(manifest.captureCount, 17);
  assert.equal(manifest.captures.length, 17);
  assert.equal(files.length, 17);
  assert.deepEqual(files, manifest.captures.map((capture) => capture.file).sort());
  assert.equal(new Set(manifest.captures.map((capture) => capture.viewport)).size, 5);
  assert.match(manifest.buildId, /^0\.1\.0\+(?:[a-f0-9]{12}|working\.[a-f0-9]{12})$/);
  for (const capture of manifest.captures) {
    assert.ok(Math.abs(capture.actualHeat - capture.targetHeat) <= 5, `${capture.file} heat drift`);
    const bytes = await readFile(new URL(capture.file, captureDir));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    const [width, height] = capture.viewport.split('x').map(Number);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
  }
});
