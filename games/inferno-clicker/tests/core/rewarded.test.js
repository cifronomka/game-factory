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
  state.stage = 3;
  state.runHighestStage = 3;
  state.reachedStageTwo = true;
  state.grantedStageBonuses = [2, 3];
  state.heat = 300;
  state.activeRunTimeMs = 10_000;
  state.simulationTimeMs = 10_000;
  return state;
}

test('reward unlocks at the first safe state after reaching stage 3 with no elapsed-time gate', () => {
  const allTimeOnly = createInitialState({
    schemaVersion: 1,
    bestScore: 1_000,
    highestStageReached: 7,
    longestInfernoHoldMs: 1_000,
    maxMultiplier: 5,
    runsPlayed: 2,
  });
  allTimeOnly.phase = 'PLAYING';
  assert.equal(canOfferRewarded(allTimeOnly), false);

  const stageTwo = eligibleState();
  stageTwo.stage = 2;
  stageTwo.runHighestStage = 2;
  assert.equal(canOfferRewarded(stageTwo), false);

  const firstSafeStageThree = eligibleState();
  firstSafeStageThree.activeRunTimeMs = 1;
  assert.equal(canOfferRewarded(firstSafeStageThree), true);

  firstSafeStageThree.encounters = [{ kind: 'servant', phase: 'telegraph', msLeft: 500 }];
  assert.equal(canOfferRewarded(firstSafeStageThree), false);
});

test('reward offer uses an explicit confirm sheet and refuses competing pause reasons', () => {
  const engine = new GameEngine(eligibleState());
  assert.equal(engine.openRewardSheet(), true);
  assert.equal(engine.state.phase, 'PAUSED');
  assert.equal(engine.state.rewardSheetOpen, true);
  engine.pause('visibility');
  assert.equal(engine.beginRewarded('blocked'), false);
  engine.resume('visibility');
  assert.equal(engine.beginRewarded('reward-1'), true);
  assert.equal(engine.state.phase, 'AD_BREAK');
  assert.equal(engine.beginRewarded('competing-request'), false);
});

test('cancelling reward sheet removes only menu pause and consumes no cooldown', () => {
  const engine = new GameEngine(eligibleState());
  assert.equal(engine.cancelRewardSheet(), false);
  assert.equal(engine.openRewardSheet(), true);
  engine.pause('visibility');
  assert.equal(engine.cancelRewardSheet(), true);
  assert.equal(engine.state.rewardSheetOpen, false);
  assert.equal(engine.state.phase, 'PAUSED');
  assert.deepEqual(engine.state.pauseReasons, ['visibility']);
  assert.equal(engine.state.sessionRewardCooldownMs, 0);
  assert.equal(engine.state.boost, null);
  assert.equal(engine.cancelRewardSheet(), false);
  engine.resume('visibility');
  assert.equal(engine.state.phase, 'PLAYING');
});

test('confirmed reward waits for valid resume and both 60s boost and 90s cooldown use active gameplay time', () => {
  const engine = new GameEngine(eligibleState());
  engine.openRewardSheet();
  engine.beginRewarded('reward-1');
  engine.pause('visibility');
  assert.equal(engine.grantRewarded('reward-1'), true);
  assert.equal(engine.grantRewarded('reward-1'), false);
  assert.equal(engine.state.phase, 'AD_BREAK');
  assert.equal(engine.state.boost, null);
  assert.equal(engine.resolveRewarded('reward-1', 'rewarded'), true);
  assert.equal(engine.state.phase, 'PAUSED');
  assert.equal(engine.state.boost, null);
  assert.equal(engine.state.queuedBoost, true);
  assert.equal(engine.state.sessionRewardCooldownMs, REWARDED_SESSION_COOLDOWN_MS);
  assert.equal(engine.resolveRewarded('reward-1', 'rewarded'), false);

  engine.advanceFrame(10_000);
  assert.equal(engine.state.sessionRewardCooldownMs, REWARDED_SESSION_COOLDOWN_MS);
  engine.resume('visibility');
  assert.equal(engine.state.boost?.msLeft, REWARDED_DURATION_MS);
  engine.advanceSteps(1_199);
  assert.equal(engine.state.boost?.msLeft, 50);
  assert.equal(engine.state.sessionRewardCooldownMs, 30_050);
  engine.advanceSteps(1);
  assert.equal(engine.state.boost, null);
  assert.equal(engine.state.sessionRewardCooldownMs, 30_000);
});

test('successful rewards repeat after the session cooldown instead of using a per-run gate', () => {
  const state = eligibleState();
  state.stage = 2;
  state.heat = 200;
  const engine = new GameEngine(state);
  assert.equal(engine.openRewardSheet(), true);
  assert.equal(engine.beginRewarded('reward-1'), true);
  assert.equal(engine.resolveRewarded('reward-1', 'rewarded'), true);
  engine.advanceSteps(REWARDED_SESSION_COOLDOWN_MS / 50);
  assert.equal(engine.state.sessionRewardCooldownMs, 0);
  assert.equal(engine.state.boost, null);
  assert.equal(canOfferRewarded(engine.state), true);

  assert.equal(engine.openRewardSheet(), true);
  assert.equal(engine.beginRewarded('reward-2'), true);
  assert.equal(engine.resolveRewarded('reward-2', 'rewarded'), true);
  assert.equal(engine.state.boost?.msLeft, REWARDED_DURATION_MS);
  assert.equal(engine.state.sessionRewardCooldownMs, REWARDED_SESSION_COOLDOWN_MS);
  assert.equal(engine.drainEvents().filter((event) => event.type === 'boostStarted').length, 2);
});

test('reward cooldown survives results and restart and remains frozen until active gameplay resumes', () => {
  const engine = new GameEngine(eligibleState());
  engine.openRewardSheet();
  engine.beginRewarded('carry-cooldown');
  engine.resolveRewarded('carry-cooldown', 'rewarded');
  engine.advanceSteps(200);
  assert.equal(engine.state.sessionRewardCooldownMs, 80_000);
  engine.pause('menu');
  assert.equal(engine.abandonRun(), true);
  assert.equal(engine.restart(), true);
  assert.equal(engine.state.sessionRewardCooldownMs, 80_000);
  engine.advanceSteps(100);
  assert.equal(engine.state.phase, 'READY');
  assert.equal(engine.state.sessionRewardCooldownMs, 80_000);
  engine.queueTap(engine.state.simulationTimeMs, 'start-next-run');
  engine.advanceSteps(1);
  assert.equal(engine.state.sessionRewardCooldownMs, 79_950);
});

test('rewarded heat is doubled but assisted heat is excluded from direct tap score', () => {
  const state = eligibleState();
  state.boost = { msLeft: REWARDED_DURATION_MS };
  const engine = new GameEngine(state);
  const beforeHeat = engine.state.heat;
  engine.queueTap(10_000);
  engine.advanceSteps(1);
  assert.equal(engine.state.tapPower, 6);
  assert.ok(Math.abs(engine.state.heat - (beforeHeat + 6 - 0.2)) < 1e-9);
  assert.equal(engine.state.scoreAcc, 45);
});

for (const outcome of /** @type {const} */ (['closed', 'unavailable', 'error'])) {
  test(`${outcome} callback grants no reward, starts no cooldown, and permits retry`, () => {
    const engine = new GameEngine(eligibleState());
    engine.openRewardSheet();
    engine.beginRewarded(`reward-${outcome}`);
    assert.equal(engine.resolveRewarded(`reward-${outcome}`, outcome), true);
    assert.equal(engine.state.phase, 'PLAYING');
    assert.equal(engine.state.boost, null);
    assert.equal(engine.state.sessionRewardCooldownMs, 0);
    assert.equal(canOfferRewarded(engine.state), true);
  });
}

test('stage 5 crossing never requires rewarded state', () => {
  const state = eligibleState();
  state.stage = 4;
  state.runHighestStage = 4;
  state.heat = 558;
  state.grantedStageBonuses = [2, 3, 4];
  state.scoreAcc = 0;
  state.score = 0;
  const engine = new GameEngine(state);
  engine.queueTap(10_000, 'direct-stage-five');
  engine.advanceSteps(1);
  assert.equal(engine.state.stage, 5);
  assert.equal(engine.state.runHighestStage, 5);
  assert.deepEqual(engine.state.grantedStageBonuses, [2, 3, 4, 5]);
});
