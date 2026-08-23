// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultSave, parseInfernoSave } from '../../src/platforms/index.js';
import { buildSave, recordsFromSave } from '../../src/app/save.js';

test('app save persists records and settings but no active run state', () => {
  const previous = createDefaultSave(1);
  const records = { schemaVersion: 1, bestScore: 900, highestStageReached: 5, longestInfernoHoldMs: 1234, maxMultiplier: 5, runsPlayed: 3 };
  const save = buildSave(records, previous, { muted: true, reducedMotion: true, updatedAt: 17 }, 2);
  assert.equal(parseInfernoSave(save).ok, true);
  assert.deepEqual(recordsFromSave(save), records);
  assert.equal('heat' in save, false);
  assert.equal('stage' in save, false);
  assert.equal(save.settings.muted, true);
  assert.equal(save.settings.updatedAt, 17, 'record-only saves must not make unchanged settings newer');
});

test('a later record-only save preserves the settings revision timestamp', () => {
  const previous = createDefaultSave(100);
  previous.settings = { muted: true, reducedMotion: false, updatedAt: 250 };
  const save = buildSave(
    { schemaVersion: 1, bestScore: 1_000, highestStageReached: 3, longestInfernoHoldMs: 0, maxMultiplier: 3, runsPlayed: 1 },
    previous,
    { ...previous.settings },
    10_000,
  );
  assert.deepEqual(save.settings, previous.settings);
  assert.equal(save.updatedAt, 10_000);
});
