// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REWARDED_DURATION_MS,
  REWARDED_SESSION_COOLDOWN_MS,
  GameEngine,
  canOfferRewarded,
  createInitialState,
} from '../../src/core/index.js';

function eligibleState() {
  const state = createInitialState();
  state.phase = 'PLAYING';
  state.stage = 4;
  state.runHighestStage = 4;
  state.reachedStageTwo = true;
  state.grantedStageBonuses = [2, 3, 4];
  state.heat = 450;
  state.activeRunTimeMs = 45_000;
  state.simulationTimeMs = 45_000;
  return state;
}

test('reward offer uses current-run eligibility and an explicit confirm sheet', () => {
  const allTimeOnly = createInitialState({
    schemaVersion: 1,
    bestScore: 1_000,
    highestStageReached: 7,
    longestInfernoHoldMs: 1_000,
    maxMultiplier: 10,
    runsPlayed: 2,
  });
  allTimeOnly.phase = 'PLAYING';
  allTimeOnly.activeRunTimeMs = 45_000;
  assert.equal(canOfferRewarded(allTimeOnly), false);

  const engine = new GameEngine(eligibleState());
  assert.equal(engine.openRewardSheet(), true);
  assert.equal(engine.state.phase, 'PAUSED');
  assert.equal(engine.state.rewardSheetOpen, true);
  engine.pause('visibility');
  assert.equal(engine.beginRewarded('blocked'), false);
  engine.resume('visibility');
  assert.equal(engine.beginRewarded('reward-1'), true);
  assert.equal(engine.state.phase, 'AD_BREAK');
});

test('cancelling reward sheet removes only menu pause and consumes no reward state', () => {
  const engine = new GameEngine(eligibleState());
  assert.equal(engine.cancelRewardSheet(), false);
  assert.equal(engine.openRewardSheet(), true);
  engine.pause('visibility');
  assert.equal(engine.cancelRewardSheet(), true);
  assert.equal(engine.state.rewardSheetOpen, false);
  assert.equal(engine.state.phase, 'PAUSED');
  assert.deepEqual(engine.state.pauseReasons, ['visibility']);
  assert.equal(engine.state.rewardedUsedThisRun, false);
  assert.equal(engine.state.sessionRewardCooldownMs, 0);
  assert.equal(engine.state.boost, null);
  assert.equal(engine.cancelRewardSheet(), false);
  engine.resume('visibility');
  assert.equal(engine.state.phase, 'PLAYING');
});

test('confirmed reward waits for valid resume, lasts 20 active seconds, and is idempotent', () => {
  const engine = new GameEngine(eligibleState());
  engine.openRewardSheet();
  engine.beginRewarded('reward-1');
  engine.pause('visibility');
  assert.equal(engine.resolveRewarded('reward-1', 'rewarded'), true);
  assert.equal(engine.state.phase, 'PAUSED');
  assert.equal(engine.state.boost, null);
  assert.equal(engine.state.queuedBoost, true);
  assert.equal(engine.resolveRewarded('reward-1', 'rewarded'), false);

  engine.advanceFrame(10_000);
  engine.resume('visibility');
  assert.equal(engine.state.boost?.msLeft, REWARDED_DURATION_MS);
  assert.equal(engine.state.sessionRewardCooldownMs, REWARDED_SESSION_COOLDOWN_MS);
  engine.advanceSteps(399);
  assert.equal(engine.state.boost?.msLeft, 50);
  engine.advanceSteps(1);
  assert.equal(engine.state.boost, null);
  assert.equal(engine.state.rewardedUsedThisRun, true);
});

test('rewarded heat is doubled but assisted heat is excluded from direct tap score', () => {
  const state = eligibleState();
  state.boost = { msLeft: REWARDED_DURATION_MS };
  state.rewardedUsedThisRun = true;
  const engine = new GameEngine(state);
  const beforeHeat = engine.state.heat;
  engine.queueTap(45_000);
  engine.advanceSteps(1);
  assert.equal(engine.state.tapPower, 6);
  assert.ok(Math.abs(engine.state.heat - (beforeHeat + 6 - 0.325)) < 1e-9);
  assert.equal(engine.state.scoreAcc, 60);
});

for (const outcome of /** @type {const} */ (['closed', 'unavailable', 'error'])) {
  test(`${outcome} callback grants no reward and consumes neither run use nor cooldown`, () => {
    const engine = new GameEngine(eligibleState());
    engine.openRewardSheet();
    engine.beginRewarded(`reward-${outcome}`);
    assert.equal(engine.resolveRewarded(`reward-${outcome}`, outcome), true);
    assert.equal(engine.state.phase, 'PLAYING');
    assert.equal(engine.state.boost, null);
    assert.equal(engine.state.rewardedUsedThisRun, false);
    assert.equal(engine.state.sessionRewardCooldownMs, 0);
  });
}

test('optional boost requires stage 4, is single-use per run, and never controls progression permission', () => {
  const engine = new GameEngine(eligibleState());
  assert.equal(engine.openRewardSheet(), true);
  assert.equal(engine.beginRewarded('optional-boost'), true);
  assert.equal(engine.resolveRewarded('optional-boost', 'rewarded'), true);
  assert.equal(canOfferRewarded(engine.state), false);
  assert.equal(engine.resolveRewarded('optional-boost', 'rewarded'), false);
  assert.equal(engine.drainEvents().filter((event) => event.type === 'boostStarted').length, 1);

  engine.pause('menu');
  assert.equal(engine.abandonRun(), true);
  const records = engine.recordSnapshot();
  assert.equal(engine.restart(), true);
  assert.equal(engine.state.rewardedUsedThisRun, false);
  assert.equal(createInitialState(records).rewardedUsedThisRun, false);
});

test('stage 5 crossing never requires rewarded state', () => {
  const state = eligibleState();
  state.heat = 558;
  state.scoreAcc = 0;
  state.score = 0;
  const engine = new GameEngine(state);
  engine.queueTap(45_000, 'direct-stage-five');
  engine.advanceSteps(1);
  assert.equal(engine.state.stage, 5);
  assert.equal(engine.state.runHighestStage, 5);
  assert.equal(engine.state.rewardedUsedThisRun, false);
  assert.deepEqual(engine.state.grantedStageBonuses, [2, 3, 4, 5]);
});
