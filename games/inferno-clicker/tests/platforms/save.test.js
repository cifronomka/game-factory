// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeInfernoSaves, parseInfernoSave } from '../../src/platforms/types/save.js';
import { makeSave } from './helpers.js';

test('save parser returns only persisted fields and rejects a future schema', () => {
  const parsed = parseInfernoSave({ ...makeSave({ bestScore: 42 }), heat: 900, runHighestStage: 7 });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.bestScore, 42);
    assert.equal('heat' in parsed.value, false);
    assert.equal('runHighestStage' in parsed.value, false);
  }
  const future = parseInfernoSave({ ...makeSave(), schemaVersion: 2 });
  assert.equal(future.ok, false);
});

test('schema-0 save migrates without restoring active-run data', () => {
  const parsed = parseInfernoSave({
    schemaVersion: 0,
    bestScore: 9,
    highestStageReached: 3,
    longestInfernoHoldMs: 10,
    maxMultiplier: 2,
    runsPlayed: 4,
    muted: true,
    reducedMotion: false,
    settingsUpdatedAt: 20,
    dailyRitualDate: '2026-08-18',
    dailyRitualRewardClaimed: true,
    updatedAt: 20,
    heat: 999,
    tutorialFlags: { resonance: true, tap: true },
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.settings.muted, true);
    assert.equal(parsed.value.dailyRitual.rewardClaimed, true);
    assert.equal('heat' in parsed.value, false);
    assert.deepEqual(parsed.value.tutorialFlags, { tap: true });
  }
});

test('save merge uses record maxima, newest settings, and same-day reward OR', () => {
  const local = makeSave({
    bestScore: 100,
    highestStageReached: 4,
    runsPlayed: 8,
    tutorialFlags: { tap: true },
    settings: { muted: false, reducedMotion: false, updatedAt: 10 },
    dailyRitual: { date: '2026-08-18', rewardClaimed: true },
    updatedAt: 10,
  });
  const cloud = makeSave({
    bestScore: 90,
    highestStageReached: 6,
    runsPlayed: 5,
    tutorialFlags: { completed: true },
    maxMultiplier: 10,
    settings: { muted: true, reducedMotion: true, updatedAt: 20 },
    dailyRitual: { date: '2026-08-18', rewardClaimed: false },
    updatedAt: 20,
  });
  const merged = mergeInfernoSaves(local, cloud);
  assert.equal(merged.bestScore, 100);
  assert.equal(merged.highestStageReached, 6);
  assert.equal(merged.runsPlayed, 8);
  assert.deepEqual(merged.tutorialFlags, { tap: true, completed: true });
  assert.equal(merged.maxMultiplier, 5);
  assert.equal(merged.settings.muted, true);
  assert.equal(merged.dailyRitual.rewardClaimed, true);
});
