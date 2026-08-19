// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultSave, parseInfernoSave } from '../../src/platforms/index.js';
import { buildSave, recordsFromSave } from '../../src/app/save.js';

test('app save persists records and settings but no active run state', () => {
  const previous = createDefaultSave(1);
  const records = { schemaVersion: 1, bestScore: 900, highestStageReached: 5, longestInfernoHoldMs: 1234, maxMultiplier: 5, runsPlayed: 3 };
  const save = buildSave(records, previous, { muted: true, reducedMotion: true }, 2);
  assert.equal(parseInfernoSave(save).ok, true);
  assert.deepEqual(recordsFromSave(save), records);
  assert.equal('heat' in save, false);
  assert.equal('stage' in save, false);
  assert.equal(save.settings.muted, true);
});
