import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneVisualStateMapper } from '../../src/presentation/sceneVisualStateMapper.js';
import { SCENE_LAYER_ORDER } from '../../src/presentation/scene/layerOrder.js';

function model(overrides = {}) {
  return {
    stage: 1, stageProgress: 0, heat: 1, score: 0, bestScore: 0, multiplier: 1,
    infernoHoldMs: 0,
    encounters: [], debuffs: [], combinedDecayFactor: 1, boost: null, paused: false, muted: false, quality: 'high',
    reducedMotion: false, rewardedAvailable: true, rewardedSupported: true, rewardedProvider: 'test',
    showTapHint: false, ...overrides,
  };
}

test('maps increasing heat to continuously stronger flame and reveal', () => {
  const mapper = new SceneVisualStateMapper();
  let previous = { reveal: 0, flameHeight: 0 };
  for (let stage = 1; stage <= 7; stage += 1) {
    const heat = stage === 7 ? 1_000 : (stage - 1) * 150;
    const state = mapper.map(model({ stage, heat }));
    assert.ok(state.reveal >= previous.reveal);
    assert.ok(state.flameHeight >= previous.flameHeight);
    assert.equal(state.stage, stage);
    previous = state;
  }
  assert.equal(previous.reveal, 1);
  assert.ok(previous.flameHeight > 0.95);
});

test('reveals light continuously within a stage without changing gameplay state', () => {
  const mapper = new SceneVisualStateMapper();
  const low = mapper.map(model({ stage: 3, heat: 240 }));
  const high = mapper.map(model({ stage: 3, heat: 360 }));
  assert.ok(high.reveal > low.reveal);
  assert.ok(high.flameHeight > low.flameHeight);
});

test('keeps architecture, characters and flame in the fixed compositing order', () => {
  assert.deepEqual(SCENE_LAYER_ORDER, [
    'far-chamber', 'midground-architecture', 'ritual-plane', 'characters',
    'flame-rig', 'lighting-fx', 'foreground',
  ]);
});

test('maps characters, stage effects and boost without flattening the scene', () => {
  const mapper = new SceneVisualStateMapper();
  const servant = mapper.map(model({ stage: 3, encounters: [{ kind: 'servant', phase: 'telegraph', progress: 0.2 }] }));
  assert.equal(servant.servant, 'inhale');
  assert.equal(servant.demoness, 'hidden');
  const climax = mapper.map(model({ stage: 7, boost: { active: true, remainingMs: 2500 } }));
  assert.equal(climax.hostLevel, 2);
  assert.equal(climax.outerColor, '#9a5cff');
  assert.equal(climax.boostEnding, true);
});

test('enforces quality and reduced-motion particle caps', () => {
  const mapper = new SceneVisualStateMapper();
  const high = mapper.map(model({ stage: 7, quality: 'high' }));
  assert.equal(high.emberCap, 80);
  assert.equal(high.smokeCap, 21);
  const reduced = mapper.map(model({ stage: 7, quality: 'high', reducedMotion: true }));
  assert.ok(reduced.emberCap <= Math.floor(high.emberCap * 0.4));
  assert.equal(reduced.distortionEnabled, false);
  assert.equal(reduced.reducedMotion, true);
  const off = mapper.map(model({ stage: 7, quality: 'off' }));
  assert.equal(off.emberCap, 0);
  assert.equal(off.smokeCap, 0);
});

test('maps passive encounter states without counter progress', () => {
  const mapper = new SceneVisualStateMapper();
  const state = mapper.map(model({
    stage: 5,
    encounters: [{ kind: 'demoness', phase: 'active', progress: 0.5 }],
  }));
  assert.equal(state.demoness, 'hold');
  assert.equal(state.coreColor, '#9ed9d1');
  assert.equal('acceptedTaps' in state.encounters[0], false);
});

test('keeps an active Demoness effect revealed after heat falls to Stage 4', () => {
  const mapper = new SceneVisualStateMapper();
  const state = mapper.map(model({
    stage: 4,
    encounters: [{ kind: 'demoness', phase: 'active', progress: 0.7 }],
  }));
  assert.equal(state.demoness, 'hold');
  assert.equal(state.coreColor, '#9ed9d1');
});

test('maps concurrent character encounters independently', () => {
  const mapper = new SceneVisualStateMapper();
  const state = mapper.map(model({
    stage: 6,
    encounters: [
      { kind: 'servant', phase: 'active', progress: 0.5 },
      { kind: 'demoness', phase: 'active', progress: 0.5 },
    ],
    debuffs: [
      { kind: 'servant', sourceLabel: 'Пепельный слуга', effectLabel: 'Пепельный выдох', decayFactor: 1.8, decayIncreasePercent: 80, remainingMs: 2_000 },
      { kind: 'demoness', sourceLabel: 'Демонесса угасания', effectLabel: 'Холодное угасание', decayFactor: 1.5, decayIncreasePercent: 50, remainingMs: 3_000 },
    ],
    combinedDecayFactor: 2.5,
  }));
  assert.equal(state.servant, 'blow');
  assert.equal(state.demoness, 'hold');
  assert.equal(state.debuffs.length, 2);
  assert.equal(state.combinedDecayFactor, 2.5);
});
