import test from 'node:test';
import assert from 'node:assert/strict';
import { FlameRig } from '../../src/presentation/scene/flameRig.js';

function state(overrides = {}) {
  return {
    stage: 4, stageProgress: 0.2, emberCap: 12, smokeCap: 4, paused: false, reducedMotion: false, quality: 'high', flashesEnabled: true,
    flameHeight: 0.34, flameWidth: 0.16, outerColor: '#f05a24', coreColor: '#fff0c2',
    boostActive: false, boostEnding: false,
    encounters: [], ...overrides,
  };
}

test('every accepted tap creates immediate feedback without exceeding caps', () => {
  const rig = new FlameRig();
  rig.setState(state({ emberCap: 2 }));
  rig.handleEvent({ type: 'tap-accepted', critical: false }, 10);
  assert.equal(rig.pulses[0].kind, 'tap');
  assert.ok(rig.getStats().embers <= 2);
});

test('family switch crossfades for at least 0.8 seconds and authored flare plays every boundary', () => {
  const rig = new FlameRig();
  rig.setState(state({ stage: 2 }));
  rig.setState(state({ stage: 3 }));
  rig.handleEvent({ type: 'stage-changed', from: 2, to: 3 });
  assert.equal(rig.getStats().family, 'mid');
  assert.equal(rig.getStats().previousFamily, 'low');
  assert.equal(rig.getStats().flareActive, true);
  for (let index = 0; index < 16; index += 1) rig.update(0.05);
  assert.equal(rig.getStats().previousFamily, 'low');
  for (let index = 0; index < 6; index += 1) rig.update(0.05);
  assert.equal(rig.getStats().previousFamily, null);
});

test('pause freezes authored flame and stage flare frames', () => {
  const rig = new FlameRig();
  rig.setState(state({ stage: 3 }));
  rig.handleEvent({ type: 'stage-changed', from: 2, to: 3 });
  rig.update(0.05);
  const before = rig.getStats();
  rig.setState(state({ stage: 3, paused: true }));
  for (let index = 0; index < 12; index += 1) rig.update(0.05);
  const after = rig.getStats();
  assert.equal(after.assets.mid.coreFrame, before.assets.mid.coreFrame);
  assert.equal(after.transitionProgress, before.transitionProgress);
  assert.equal(after.flareActive, before.flareActive);
});

test('asset loading is staged instead of eager-loading all decoded atlases', () => {
  let created = 0;
  const imageFactory = () => {
    created += 1;
    return { complete: true, naturalWidth: 1024, naturalHeight: 1024, decoding: 'auto', src: '', addEventListener() {} };
  };
  const rig = new FlameRig({ imageFactory });
  assert.equal(created, 2, 'only low core and outer are critical');
  rig.setState(state({ stage: 1, stageProgress: 0.61 }));
  assert.equal(created, 3, 'transition flare preloads late in stage 1');
  rig.setState(state({ stage: 2, stageProgress: 0.61 }));
  assert.equal(created, 5, 'mid family preloads late in stage 2');
  rig.setState(state({ stage: 5, stageProgress: 0.61 }));
  assert.equal(created, 7, 'high family preloads late in stage 5');
});

test('rapid accepted taps remain accepted while presentation aggregates pulse count', () => {
  const rig = new FlameRig();
  rig.setState(state());
  for (let index = 0; index < 20; index += 1) rig.handleEvent({ type: 'tap-accepted', critical: false });
  assert.equal(rig.pulses.length, 2);
  assert.ok(rig.impulse > 0);
});

test('paused visual state freezes particle and pulse lifetimes', () => {
  const rig = new FlameRig();
  rig.setState(state({ paused: true }));
  rig.handleEvent({ type: 'tap-accepted', critical: false }, 0);
  const before = rig.pulses[0].age;
  rig.update(1);
  assert.equal(rig.pulses[0].age, before);
});

test('beneficial Heat Window active cue uses its warm semantic pulse', () => {
  const rig = new FlameRig();
  rig.setState(state({ encounters: [{ kind: 'heat-window', phase: 'active', progress: 0.5 }] }));
  rig.handleEvent({ type: 'encounter-cue', kind: 'heat-window', phase: 'active' }, 0);
  assert.equal(rig.pulses.length, 1);
  assert.equal(rig.pulses[0].kind, 'heat');
});

test('phase-driven character reaction bends, cools and suppresses flame without resetting authored loops', () => {
  const rig = new FlameRig();
  rig.setState(state());
  rig.update(0.05);
  const frame = rig.getStats().assets.mid.coreFrame;
  rig.setCharacterReaction({ bend: -0.58, suppression: 0.2, emberDrift: 0, cold: 1, source: 'demoness-hold' });
  const reaction = rig.getStats().characterReaction;
  assert.equal(reaction.source, 'demoness-hold');
  assert.equal(reaction.cold, 1);
  assert.equal(reaction.suppression, 0.2);
  assert.equal(rig.getStats().assets.mid.coreFrame, frame);
});

test('Demoness cold visibly reduces accepted-tap and ambient embers', () => {
  const warm = new FlameRig();
  warm.setState(state({ emberCap: 80 }));
  warm.handleEvent({ type: 'tap-accepted', critical: false });
  const cold = new FlameRig();
  cold.setState(state({ emberCap: 80 }));
  cold.setCharacterReaction({ cold: 1, source: 'demoness-hold' });
  cold.handleEvent({ type: 'tap-accepted', critical: false });
  assert.equal(warm.getStats().embers, 7);
  assert.equal(cold.getStats().embers, 3);
});

test('Stage 6 to 7 starts one bounded 1.5 second Inferno entry payoff', () => {
  const rig = new FlameRig();
  rig.setState(state({ stage: 6 }));
  rig.setState(state({ stage: 7 }));
  rig.handleEvent({ type: 'stage-changed', from: 6, to: 7 });
  assert.equal(rig.getStats().infernoEntryProgress, 0);
  assert.deepEqual(rig.getStats().infernoPayoff, { durationMs: 1_500, highFlameExpansion: true, emberBurst: true, runeWave: true, lightingPulse: true });
  for (let index = 0; index < 15; index += 1) rig.update(0.05);
  assert.equal(rig.getStats().infernoEntryProgress, 0.5);
  for (let index = 0; index < 15; index += 1) rig.update(0.05);
  assert.equal(rig.getStats().infernoEntryProgress, 1);
});
