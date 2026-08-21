import test from 'node:test';
import assert from 'node:assert/strict';
import { FlameRig, familyWeights, heatVisualProfile } from '../../src/presentation/scene/flameRig.js';

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
  assert.equal(rig.families.low.coreBitmap.status, 'idle');
  assert.equal(rig.families.low.outerBitmap.status, 'idle');
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

test('actual flame target follows rendered heat, suppression and bend instead of a fixed hearth point', () => {
  const rig = new FlameRig();
  rig.setState(state({ stage: 5, flameHeight: 0.62 }));
  const warm = rig.getTargetAnchor();
  rig.setCharacterReaction({ bend: -0.5, suppression: 0.2, cold: 1, source: 'demoness-hold' });
  const struck = rig.getTargetAnchor();
  assert.ok(struck.x < warm.x, 'target follows the visibly bent flame');
  assert.ok(struck.y > warm.y, 'target follows the visibly suppressed flame height');
  assert.deepEqual(rig.getStats().targetAnchor, struck);
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

test('low, mid, high and Inferno expose render-rate temporal samples', () => {
  for (const [stage, family] of [[1, 'low'], [4, 'mid'], [6, 'high'], [7, 'high']]) {
    const rig = new FlameRig();
    rig.setState(state({ stage }));
    for (let index = 0; index < 35; index += 1) rig.update(0.05);
    const samples = [];
    for (let index = 0; index < 6; index += 1) {
      rig.update(1 / 60);
      samples.push(rig.getStats().assets[family].coreTemporal);
    }
    assert.ok(new Set(samples.map((sample) => sample.mix.toFixed(4))).size >= 5, `stage ${stage} has sub-frame temporal resolution`);
    assert.ok(samples.every((sample) => sample.currentIndex !== sample.nextIndex));
  }
});

test('accepted taps preserve authored flame phase instead of resetting the loop', () => {
  const rig = new FlameRig();
  rig.setState(state({ stage: 4 }));
  rig.update(0.037);
  const before = rig.getStats().assets.mid.coreTemporal;
  rig.handleEvent({ type: 'tap-accepted', critical: false });
  const after = rig.getStats().assets.mid.coreTemporal;
  assert.deepEqual(after, before);
  assert.ok(rig.impulse > 0);
});

test('heat continuously drives brightness, glow and bounded particle targets', () => {
  const low = heatVisualProfile(0.15);
  const middle = heatVisualProfile(0.5);
  const high = heatVisualProfile(0.85);
  for (const key of ['brightness', 'glowAlpha', 'glowRadius', 'outerAlpha', 'emberRatio', 'smokeRatio']) {
    assert.ok(low[key] < middle[key], `${key} grows below midpoint`);
    assert.ok(middle[key] < high[key], `${key} grows above midpoint`);
  }
  const rig = new FlameRig();
  rig.setState(state({ stage: 4, flameHeight: 0.21 }));
  const cool = rig.getStats().heatVisuals;
  rig.setState(state({ stage: 4, flameHeight: 0.22 }));
  const warmer = rig.getStats().heatVisuals;
  assert.ok(warmer.brightness > cool.brightness);
  assert.ok(warmer.emberRatio > cool.emberRatio);
  assert.equal(rig.getStats().family, 'mid');
});

test('all twelve adjacent stage crossings have a monotonic organic boundary envelope', () => {
  const crossings = [];
  for (let stage = 1; stage < 7; stage += 1) {
    crossings.push([stage, stage + 1], [stage + 1, stage]);
  }
  for (const [from, to] of crossings) {
    const rig = new FlameRig();
    rig.setState(state({ stage: from }));
    for (let index = 0; index < 35; index += 1) rig.update(0.05);
    rig.setState(state({ stage: to }));
    rig.handleEvent({ type: 'stage-changed', from, to });
    const start = rig.getStats();
    assert.equal(start.boundaryTransition.active, true, `${from}->${to} starts`);
    assert.equal(start.boundaryTransition.durationMs, from === 6 && to === 7 ? 1_500 : 1_050);
    rig.update(0.025);
    const flareSample = rig.getStats().flareTemporal;
    assert.ok(flareSample.mix > 0 && flareSample.mix < 1, `${from}->${to} flare is temporally interpolated`);
    if (to < from) assert.ok(flareSample.currentIndex > flareSample.nextIndex, 'downward flare plays the authored cells in reverse');
    let previousProgress = start.boundaryTransition.progress;
    const intermediate = [];
    for (let index = 0; index < 30; index += 1) {
      rig.update(0.05);
      const diagnostics = rig.getStats();
      assert.ok(diagnostics.boundaryTransition.progress >= previousProgress, `${from}->${to} is monotonic`);
      previousProgress = diagnostics.boundaryTransition.progress;
      const weights = Object.values(diagnostics.familyWeights);
      assert.ok(Math.abs(weights.reduce((sum, value) => sum + value, 0) - 1) < 1e-9);
      assert.ok(weights.filter((weight) => weight > 0.0001).length <= 2, 'no triple/full-opacity family ghost');
      if (diagnostics.boundaryTransition.active) intermediate.push(diagnostics.boundaryTransition.progress);
    }
    assert.ok(new Set(intermediate).size >= 10, `${from}->${to} has a resolved temporal envelope`);
    assert.equal(rig.getStats().boundaryTransition.progress, 1);
  }
});

test('family mixing is complementary and reverses without a positional jump', () => {
  assert.deepEqual(familyWeights(0.25), { low: 0.75, mid: 0.25, high: 0 });
  assert.deepEqual(familyWeights(1.75), { low: 0, mid: 0.25, high: 0.75 });
  const rig = new FlameRig();
  rig.setState(state({ stage: 2 }));
  rig.setState(state({ stage: 3 }));
  for (let index = 0; index < 9; index += 1) rig.update(0.05);
  const beforeReverse = rig.getStats().familyMix;
  rig.setState(state({ stage: 2 }));
  assert.equal(rig.getStats().familyMix, beforeReverse);
  rig.update(0.05);
  assert.ok(rig.getStats().familyMix < beforeReverse);
  for (let index = 0; index < 25; index += 1) rig.update(0.05);
  assert.equal(rig.getStats().familyMix, 0);
});
