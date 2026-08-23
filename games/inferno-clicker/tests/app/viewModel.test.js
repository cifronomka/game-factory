// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../../src/core/index.js';
import { toPresentationEvent, toPresentationViewModel } from '../../src/app/viewModel.js';

const settings = { muted: false, reducedMotion: false, quality: 'high' };
const capabilities = { rewardedAds: false };

test('maps a safe initial presentation snapshot', () => {
  const view = toPresentationViewModel(createInitialState(), settings, capabilities);
  assert.equal(view.stage, 1);
  assert.equal(view.paused, false);
  assert.deepEqual(view.rewardOffer, {
    placementId: 'heat-power-2x-60s',
    labelKey: 'hud.rewardOffer',
    confirmTitleKey: 'reward.title',
    confirmBodyKey: 'reward.body',
    supported: false,
    unlocked: false,
    visible: false,
    available: false,
    durationMs: 60_000,
    cooldownRemainingMs: 0,
  });
  assert.equal(view.goals.length, 8);
  assert.equal(view.nextGoal?.id, 'stage-3');
  assert.equal('rewardedProvider' in view, false);
  assert.equal('rhythm' in view, false);
});

test('maps supported stage-3 rewarded availability without exposing the provider', () => {
  const state = createInitialState();
  state.phase = 'PLAYING';
  state.stage = 3;
  state.runHighestStage = 3;
  state.heat = 300;
  const view = toPresentationViewModel(state, settings, { rewardedAds: true, rewardedProvider: 'yandex' });
  assert.equal(view.rewardOffer.supported, true);
  assert.equal(view.rewardOffer.unlocked, true);
  assert.equal(view.rewardOffer.visible, true);
  assert.equal(view.rewardOffer.available, true);
  assert.equal('rewardedProvider' in view, false);
});

test('hides the rewarded placard for the entire cooldown', () => {
  const state = createInitialState();
  state.phase = 'PLAYING';
  state.stage = 3;
  state.runHighestStage = 3;
  state.heat = 300;
  state.sessionRewardCooldownMs = 30_000;
  const view = toPresentationViewModel(state, settings, { rewardedAds: true });
  assert.equal(view.rewardOffer.visible, false);
  assert.equal(view.rewardOffer.available, false);
  assert.equal(view.rewardOffer.cooldownRemainingMs, 30_000);
});

test('maps goals and next goal from persisted V1 records', () => {
  const state = createInitialState({
    schemaVersion: 1,
    bestScore: 249_999,
    highestStageReached: 7,
    longestInfernoHoldMs: 60_000,
    maxMultiplier: 5,
    runsPlayed: 10,
  });
  const view = toPresentationViewModel(state, settings, capabilities);
  assert.equal(view.goals.length, 8);
  assert.equal(view.nextGoal?.id, 'score-250000');
});

test('maps live score, stage, and current Inferno hold into goals before finishRun', () => {
  const state = createInitialState({
    schemaVersion: 1,
    bestScore: 10,
    highestStageReached: 1,
    longestInfernoHoldMs: 10,
    maxMultiplier: 1,
    runsPlayed: 2,
  });
  const recordsBefore = structuredClone(state.records);
  state.bestScore = 249_999;
  state.score = 250_000;
  state.runHighestStage = 2;
  state.stage = 3;
  state.runLongestInfernoHoldMs = 29_999;
  state.currentInfernoHoldMs = 30_000;
  state.maxMultiplier = 5;

  const view = toPresentationViewModel(state, settings, capabilities);

  assert.deepEqual(state.records, recordsBefore);
  assert.equal(state.records.schemaVersion, 1);
  assert.equal(view.goals.length, 8);
  assert.deepEqual(view.goals.map((goal) => [goal.id, goal.current, goal.completed]), [
    ['stage-3', 3, true],
    ['stage-5', 3, false],
    ['stage-7', 3, false],
    ['runs-3', 2, false],
    ['runs-10', 2, false],
    ['inferno-30s', 30_000, true],
    ['inferno-60s', 30_000, false],
    ['score-250000', 250_000, true],
  ]);
  assert.equal(view.nextGoal?.id, 'stage-5');
});

test('maps accumulated run maxima into goals when instantaneous values have fallen', () => {
  const state = createInitialState({
    schemaVersion: 1,
    bestScore: 10,
    highestStageReached: 1,
    longestInfernoHoldMs: 10,
    maxMultiplier: 1,
    runsPlayed: 2,
  });
  state.bestScore = 250_000;
  state.score = 20;
  state.runHighestStage = 7;
  state.stage = 2;
  state.runLongestInfernoHoldMs = 60_000;
  state.currentInfernoHoldMs = 0;
  state.maxMultiplier = 5;

  const view = toPresentationViewModel(state, settings, capabilities);

  assert.equal(view.goals.length, 8);
  assert.deepEqual(view.goals.map((goal) => goal.completed), [
    true, true, true, false, false, true, true, true,
  ]);
  assert.equal(view.nextGoal?.id, 'runs-3');
});

test('maps encounter effect to active presentation phase with bounded progress', () => {
  const state = createInitialState();
  state.encounters = [{ kind: 'servant', phase: 'effect', msLeft: 1_250 }];
  const view = toPresentationViewModel(state, settings, capabilities);
  assert.equal(view.encounters[0]?.phase, 'active');
  assert.equal(view.encounters[0]?.progress, 0.5);
});

test('maps concurrent enemy effects to separate sourced debuff rows', () => {
  const state = createInitialState();
  state.encounters = [
    { kind: 'servant', phase: 'effect', msLeft: 1_250 },
    { kind: 'demoness', phase: 'effect', msLeft: 3_200 },
    { kind: 'heat-window', phase: 'effect', msLeft: 800 },
  ];
  state.decayFactor = 2.5;
  const view = toPresentationViewModel(state, settings, capabilities);
  assert.equal(view.encounters.length, 3);
  assert.deepEqual(view.debuffs, [
    {
      kind: 'servant', sourceKey: 'debuff.servant.source', effectKey: 'debuff.servant.effect',
      decayFactor: 1.8, decayIncreasePercent: 80, remainingMs: 1_250,
    },
    {
      kind: 'demoness', sourceKey: 'debuff.warden.source', effectKey: 'debuff.warden.effect',
      decayFactor: 1.5, decayIncreasePercent: 50, remainingMs: 3_200,
    },
  ]);
  assert.equal(view.combinedDecayFactor, 2.5);
});

test('maps domain feedback without leaking gameplay rules to presentation', () => {
  assert.deepEqual(toPresentationEvent({ type: 'tapAccepted', atMs: 0, data: { tapPower: 3 } }), {
    type: 'tap-accepted', critical: false,
  });
  assert.deepEqual(toPresentationEvent({ type: 'tapAccepted', atMs: 0, data: { tapPower: 6, heatWindowFactor: 2 } }), {
    type: 'tap-accepted', critical: true,
  });
  assert.equal(toPresentationEvent({ type: 'recordsChanged', atMs: 0 }), null);
  assert.equal(toPresentationEvent({ type: 'tapRejected', atMs: 0, data: { reason: 'input-overflow' } }), null);
});
