// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultRecords } from '../../src/core/index.js';
import { deriveGoals, firstIncompleteGoal, GOAL_DEFINITIONS } from '../../src/app/goals.js';

test('derives eight goals in the fixed release order from V1 records only', () => {
  const records = createDefaultRecords();
  const before = structuredClone(records);
  const goals = deriveGoals(records);
  assert.deepEqual(records, before);
  assert.equal(records.schemaVersion, 1);
  assert.equal(goals.length, 8);
  assert.deepEqual(goals.map((goal) => goal.id), [
    'stage-3', 'stage-5', 'stage-7', 'runs-3', 'runs-10', 'inferno-30s', 'inferno-60s', 'score-250000',
  ]);
  assert.deepEqual(goals.map((goal) => goal.id), GOAL_DEFINITIONS.map((goal) => goal.id));
  assert.equal(firstIncompleteGoal(goals)?.id, 'stage-3');
});

test('goal completion and first incomplete goal follow record thresholds deterministically', () => {
  const goals = deriveGoals({
    schemaVersion: 1,
    bestScore: 249_999,
    highestStageReached: 7,
    longestInfernoHoldMs: 60_000,
    maxMultiplier: 5,
    runsPlayed: 10,
  });
  assert.deepEqual(goals.map((goal) => goal.completed), [true, true, true, true, true, true, true, false]);
  assert.equal(firstIncompleteGoal(goals)?.id, 'score-250000');
  assert.equal(goals.at(-1)?.progress, 249_999 / 250_000);

  const complete = deriveGoals({
    schemaVersion: 1,
    bestScore: 250_000,
    highestStageReached: 7,
    longestInfernoHoldMs: 60_000,
    maxMultiplier: 5,
    runsPlayed: 10,
  });
  assert.equal(firstIncompleteGoal(complete), null);
  assert.ok(complete.every((goal) => goal.completed && goal.progress === 1));
});

test('goal progress is bounded for malformed and over-target record metrics', () => {
  const goals = deriveGoals(/** @type {any} */ ({
    schemaVersion: 1,
    bestScore: Number.POSITIVE_INFINITY,
    highestStageReached: -5,
    longestInfernoHoldMs: 999_999,
    maxMultiplier: 1,
    runsPlayed: Number.NaN,
  }));
  assert.equal(goals[0]?.current, 0);
  assert.equal(goals[3]?.current, 0);
  assert.equal(goals[5]?.progress, 1);
  assert.equal(goals[6]?.progress, 1);
  assert.equal(goals[7]?.progress, 0);
});
