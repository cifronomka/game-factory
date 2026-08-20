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
  assert.equal(view.rewardedAvailable, false);
  assert.equal('rhythm' in view, false);
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
      kind: 'servant', sourceLabel: 'Пепельный слуга', effectLabel: 'Пепельный выдох',
      decayFactor: 1.8, decayIncreasePercent: 80, remainingMs: 1_250,
    },
    {
      kind: 'demoness', sourceLabel: 'Демонесса угасания', effectLabel: 'Холодное угасание',
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
