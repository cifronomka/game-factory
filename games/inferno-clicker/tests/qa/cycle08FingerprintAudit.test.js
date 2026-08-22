// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCycle08Fingerprints,
  cycle08FingerprintGroups,
} from '../../scripts/cycle08-fingerprint-audit.mjs';

const REQUIRED_FROZEN_PRESENTATION_PATHS = Object.freeze([
  'src/presentation/scene/layerOrder.js',
  'src/presentation/scene/optionalBitmap.js',
  'src/presentation/scene/spriteAnimator.js',
  'src/presentation/types.js',
  'src/styles.css',
]);

test('Cycle 08 shell fingerprint covers frozen presentation runtime without character placement', () => {
  const shell = cycle08FingerprintGroups.shell;
  assert.ok(Object.isFrozen(cycle08FingerprintGroups));
  assert.ok(Object.isFrozen(shell));
  for (const path of REQUIRED_FROZEN_PRESENTATION_PATHS) {
    assert.ok(shell.includes(path), `missing frozen presentation path: ${path}`);
  }
  assert.ok(!shell.includes('styles.css'), 'repository-root styles.css does not exist and must not substitute src/styles.css');
  assert.ok(!shell.includes('src/presentation/scene/characterScene.js'), 'Cycle 08 intentionally permits character placement changes');
});

test('Cycle 08 frozen fingerprint audit passes for the legitimate current candidate', async () => {
  const report = await auditCycle08Fingerprints();
  assert.equal(report.status, 'PASS');
  assert.equal(report.groups.shell.status, 'PASS');
  assert.equal(report.groups.shell.baselineSha256, report.groups.shell.candidateSha256);
  assert.ok(report.groups.shell.files >= REQUIRED_FROZEN_PRESENTATION_PATHS.length);
});
