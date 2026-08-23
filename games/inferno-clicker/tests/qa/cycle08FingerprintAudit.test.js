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
const CYCLE08_ROLLBACK_COMMIT = 'c7a9ea4f3b85f4d17cf65549d6fead1d67e2dd8b';

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

test('Cycle 08 frozen fingerprint audit still passes for the immutable 0.1.1 rollback commit', async () => {
  const report = await auditCycle08Fingerprints({ candidateCommit: CYCLE08_ROLLBACK_COMMIT });
  assert.equal(report.status, 'PASS');
  assert.equal(report.groups.shell.status, 'PASS');
  assert.equal(report.groups.shell.baselineSha256, report.groups.shell.candidateSha256);
  assert.equal(report.candidateCommit, CYCLE08_ROLLBACK_COMMIT);
  assert.ok(report.groups.shell.files >= REQUIRED_FROZEN_PRESENTATION_PATHS.length);
});
