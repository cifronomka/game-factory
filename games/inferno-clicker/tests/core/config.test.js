// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_SCORE,
  SEAL_HEAT_CAP,
  STAGES,
  configForStage,
  progressForStage,
  stageForHeat,
} from '../../src/core/config.js';
import { createDefaultRecords, sanitizeRecords } from '../../src/core/engine.js';

test('seven-stage config has the committed thresholds, decay, multipliers and bonuses', () => {
  assert.equal(SEAL_HEAT_CAP, 559);
  assert.deepEqual(STAGES.map((entry) => entry.lowerHeat), [0, 80, 220, 380, 560, 730, 900]);
  assert.deepEqual(STAGES.map((entry) => entry.decayPerSecond), [0.5, 2, 4, 6.5, 9, 13, 18]);
  assert.deepEqual(STAGES.map((entry) => entry.multiplier), [1, 1.25, 1.5, 2, 2.5, 3.25, 5]);
  assert.deepEqual(STAGES.map((entry) => entry.firstEntryBonus), [0, 500, 1_500, 3_000, 6_000, 10_000, 20_000]);
  assert.equal(stageForHeat(79.999).stage, 1);
  assert.equal(stageForHeat(80).stage, 2);
  assert.equal(stageForHeat(1_000).stage, 7);
  assert.equal(configForStage(5).lowerHeat, 560);
  assert.equal(progressForStage(150, 2), 0.5);
});

test('record input is sanitized to persistence-safe bounds', () => {
  assert.deepEqual(createDefaultRecords(), {
    schemaVersion: 1,
    bestScore: 0,
    highestStageReached: 1,
    longestInfernoHoldMs: 0,
    maxMultiplier: 1,
    runsPlayed: 0,
  });
  assert.deepEqual(sanitizeRecords({
    bestScore: MAX_SCORE + 100,
    highestStageReached: /** @type {7} */ (7),
    longestInfernoHoldMs: -1,
    maxMultiplier: 99,
    runsPlayed: 2.9,
  }), {
    schemaVersion: 1,
    bestScore: MAX_SCORE,
    highestStageReached: 7,
    longestInfernoHoldMs: 0,
    maxMultiplier: 5,
    runsPlayed: 2,
  });
});
