// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CharacterScene,
  INFERNO_HOST_REGIONS,
  demonessDisapprovalGesture,
  demonessEffectiveUpscale,
  demonessHandSocket,
  demonessTemporalPhase,
  hostMotionForRegion,
  servantTemporalPhase,
  visibleIceShardProgresses,
} from '../../src/presentation/scene/characterScene.js';

function state(overrides = {}) {
  return { stage: 1, stageProgress: 0, paused: false, encounters: [], servant: 'hidden', demoness: 'hidden', hostLevel: 0, reducedMotion: false, ...overrides };
}

function advance(scene, seconds) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) scene.update(0.05);
}

test('servant temporal curve exposes prepare, inhale hold, exhale ramp, peak and fade', () => {
  assert.equal(servantTemporalPhase({ phase: 'telegraph', progress: 0.05 }).phase, 'prepare');
  assert.equal(servantTemporalPhase({ phase: 'telegraph', progress: 0.8 }).phase, 'inhale-hold');
  const start = servantTemporalPhase({ phase: 'active', progress: 0.05 });
  const ramp = servantTemporalPhase({ phase: 'active', progress: 0.25 });
  const peak = servantTemporalPhase({ phase: 'active', progress: 0.5 });
  const fade = servantTemporalPhase({ phase: 'active', progress: 0.8 });
  assert.equal(start.phase, 'exhale-start');
  assert.ok(start.strength < ramp.strength);
  assert.equal(peak.strength, 1);
  assert.ok(fade.strength < peak.strength);
});

test('servant holds one world anchor and recovers after effect', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 3 }));
  advance(scene, 0.85);
  scene.setState(state({ stage: 3, encounters: [{ kind: 'servant', phase: 'active', progress: 0.5 }] }));
  const active = scene.getDiagnostics();
  assert.equal(active.servant.state, 'exhale-peak');
  assert.equal(active.servant.strength, 1);
  assert.deepEqual(active.servant.anchor, [300, 1_225]);
  assert.equal(active.reaction.source, 'servant-blow');
  scene.setState(state({ stage: 3 }));
  assert.equal(scene.getDiagnostics().servant.state, 'recovery');
  advance(scene, 0.5);
  assert.equal(scene.getDiagnostics().servant.state, 'recovery');
  advance(scene, 0.35);
  assert.equal(scene.getDiagnostics().servant.state, 'idle');
});

test('servant appearance fades in and temporally blends authored poses without a full-opacity pop', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 2 }));
  assert.equal(scene.getDiagnostics().servant.visible, false);

  scene.setState(state({ stage: 3 }));
  const start = scene.getDiagnostics().servant;
  assert.equal(start.state, 'appearance');
  assert.equal(start.opacity, 0);
  assert.equal(start.temporal.mix, 0);

  scene.update(0.05);
  const first = scene.getDiagnostics().servant;
  scene.update(0.05);
  const second = scene.getDiagnostics().servant;
  assert.ok(first.opacity > 0 && first.opacity < second.opacity);
  assert.ok(second.opacity < 0.1, 'the character remains a soft reveal during the first 100ms');

  scene.update(0.05);
  const blended = scene.getDiagnostics().servant;
  assert.ok(blended.temporal.mix > 0 && blended.temporal.mix < 1, 'adjacent authored poses crossfade at render cadence');

  advance(scene, 0.65);
  const settled = scene.getDiagnostics().servant;
  assert.equal(settled.state, 'idle');
  assert.equal(settled.opacity, 0.98);
});

test('Demoness Stage 4 silhouette does not consume reveal and cast is restrained phase-driven', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 4 }));
  advance(scene, 1.5);
  assert.equal(scene.getDiagnostics().demoness.state, 'silhouette');
  assert.equal(scene.getDiagnostics().demoness.revealed, false);
  scene.setState(state({ stage: 5 }));
  assert.equal(scene.getDiagnostics().demoness.state, 'appearance');
  advance(scene, 1.05);
  scene.setState(state({ stage: 5, encounters: [{ kind: 'demoness', phase: 'telegraph', progress: 0.5 }] }));
  assert.equal(scene.getDiagnostics().demoness.state, 'arms-rise');
  scene.setState(state({ stage: 5, encounters: [{ kind: 'demoness', phase: 'active', progress: 0.5 }] }));
  assert.equal(scene.getDiagnostics().demoness.state, 'cold-hold');
  assert.equal(scene.getDiagnostics().demoness.coldStrength, 1);
  assert.equal(scene.getDiagnostics().reaction.source, 'demoness-hold');
  scene.setState(state({ stage: 5 }));
  assert.equal(scene.getDiagnostics().demoness.state, 'recovery');
  advance(scene, 1.05);
  assert.equal(scene.getDiagnostics().demoness.state, 'idle');
});

test('concurrent hazards combine presentation reaction without replacing either actor', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 6 }));
  advance(scene, 1.05);
  scene.setState(state({ stage: 6, encounters: [
    { kind: 'servant', phase: 'active', progress: 0.5 },
    { kind: 'demoness', phase: 'active', progress: 0.5 },
  ] }));
  const diagnostics = scene.getDiagnostics();
  assert.equal(diagnostics.servant.state, 'exhale-peak');
  assert.equal(diagnostics.demoness.state, 'cold-hold');
  assert.equal(diagnostics.reaction.source, 'combined');
  assert.ok(diagnostics.reaction.suppression > 0.2);
});

test('Inferno host exposes independent authored-motion roles and advances a five-frame atlas', () => {
  assert.equal(INFERNO_HOST_REGIONS.length, 2);
  const motions = INFERNO_HOST_REGIONS.map((region) => hostMotionForRegion(region, 3.25, false));
  assert.equal(new Set(motions.map((motion) => motion.hover.toFixed(3))).size, 2);
  for (const motion of motions) {
    assert.ok(Math.abs(motion.hover) <= 3);
    assert.ok(Math.abs(motion.rotation) <= 0.0051);
  }
  const reduced = INFERNO_HOST_REGIONS.map((region) => hostMotionForRegion(region, 3.25, true));
  assert.ok(reduced.some((motion) => Math.abs(motion.hover) > 0.01));
  assert.equal(new Set(reduced.map((motion) => motion.hover.toFixed(3))).size, 2);
  for (let index = 0; index < reduced.length; index += 1) {
    assert.ok(Math.abs(reduced[index].hover) <= INFERNO_HOST_REGIONS[index].amplitude * 0.22 + 1e-9);
    assert.equal(reduced[index].rotation, 0);
  }
  const scene = new CharacterScene();
  const diagnostics = scene.getDiagnostics().host;
  assert.equal(diagnostics.asset, 'idle');
  assert.equal(diagnostics.regions, 2);
  assert.equal(diagnostics.authoredFrames, 5);
  assert.equal(diagnostics.wholePlateOnly, false);
  assert.equal(diagnostics.entryDurationMs, 1_500);
  scene.setState(state({ stage: 6, hostLevel: 2 }));
  advance(scene, 0.55);
  const frames = scene.getDiagnostics().host.frames;
  assert.notEqual(frames.main, frames.sentinel, 'separate host parts remain on independent authored phases');
});

test('Demoness keeps a calm idle and performs one restrained disapproval gesture every 5-9 active seconds', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 5 }));
  advance(scene, 1.05);
  assert.equal(scene.getDiagnostics().demoness.state, 'idle');
  advance(scene, 6.45);
  assert.equal(scene.getDiagnostics().demoness.state, 'disapproval');
  assert.equal(scene.getDiagnostics().demoness.clip, 'disapproval');
  assert.equal(scene.getDiagnostics().demoness.frame, 0, 'body remains on one calm authored frame');
  advance(scene, 2.05);
  const recovered = scene.getDiagnostics().demoness;
  assert.equal(recovered.state, 'idle');
  assert.equal(recovered.disapprovalCount, 1);
  assert.ok(recovered.nextDisapprovalMs >= 5_000 && recovered.nextDisapprovalMs <= 9_000);
  assert.deepEqual(recovered.size, [460, 700]);
});

test('Demoness disapproval follows ordered gaze phases without a dance loop', () => {
  assert.equal(demonessDisapprovalGesture(0.1).phase, 'look-left');
  assert.equal(demonessDisapprovalGesture(0.6).phase, 'hold-left');
  assert.equal(demonessDisapprovalGesture(1.0).phase, 'look-right');
  assert.equal(demonessDisapprovalGesture(1.5).phase, 'hold-right');
  assert.equal(demonessDisapprovalGesture(1.9).phase, 'return');
});

test('Demoness conical ice follows authored cast and hold hand sockets', () => {
  assert.deepEqual(demonessHandSocket('cast', 0), [0.36, 0.48]);
  assert.deepEqual(demonessHandSocket('cast', 7), [0.21, 0.32]);
  assert.deepEqual(demonessHandSocket('hold', 0), [0.24, 0.35]);
  assert.deepEqual(demonessHandSocket('hold', 3), [0.21, 0.32]);
});

test('stage-down waits for authored recovery before hiding or returning to silhouette', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 6 }));
  advance(scene, 1.05);
  scene.setState(state({ stage: 6, encounters: [
    { kind: 'servant', phase: 'active', progress: 0.5 },
    { kind: 'demoness', phase: 'active', progress: 0.5 },
  ] }));
  scene.setState(state({ stage: 2 }));
  let diagnostics = scene.getDiagnostics();
  assert.equal(diagnostics.servant.visible, true);
  assert.equal(diagnostics.servant.state, 'recovery');
  assert.equal(diagnostics.demoness.revealed, true);
  assert.equal(diagnostics.demoness.state, 'recovery');
  advance(scene, 0.85);
  diagnostics = scene.getDiagnostics();
  assert.equal(diagnostics.servant.visible, false);
  assert.equal(diagnostics.servant.state, 'hidden');
  advance(scene, 0.2);
  diagnostics = scene.getDiagnostics();
  assert.equal(diagnostics.demoness.visible, false);
  assert.equal(diagnostics.demoness.state, 'hidden');

  const silhouetteScene = new CharacterScene();
  silhouetteScene.setState(state({ stage: 5 }));
  advance(silhouetteScene, 1.05);
  silhouetteScene.setState(state({ stage: 5, encounters: [{ kind: 'demoness', phase: 'active', progress: 0.5 }] }));
  silhouetteScene.setState(state({ stage: 4 }));
  assert.equal(silhouetteScene.getDiagnostics().demoness.state, 'recovery');
  advance(silhouetteScene, 1.05);
  assert.equal(silhouetteScene.getDiagnostics().demoness.state, 'silhouette');
  assert.equal(silhouetteScene.getDiagnostics().demoness.revealed, false);
});

test('Stage 5 to 4 keeps a visible preframe and fades through intermediate opacity states', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 5 }));
  advance(scene, 1.05);
  const preframe = scene.getDiagnostics().demoness;
  assert.equal(preframe.visible, true);
  assert.equal(preframe.opacity, 0.97);

  scene.setState(state({ stage: 4 }));
  const transitionStart = scene.getDiagnostics().demoness;
  assert.equal(transitionStart.visible, true);
  assert.equal(transitionStart.revealed, true);
  assert.equal(transitionStart.state, 'stage-exit');
  assert.equal(transitionStart.opacity, preframe.opacity, 'first transition frame does not pop');
  assert.equal(transitionStart.clip, preframe.clip, 'exit starts on the currently rendered clip');
  assert.equal(transitionStart.frame, preframe.frame, 'exit starts on the currently rendered frame');
  assert.equal(transitionStart.elapsed, preframe.elapsed, 'exit preserves the authored application clock');
  assert.deepEqual(transitionStart.temporal, preframe.temporal, 'exit preserves the exact sub-frame blend snapshot');
  assert.deepEqual(transitionStart.exitVisual, {
    opacity: 0.97,
    brightness: 1.16,
    contrast: 1.03,
    saturation: 1.05,
    shadowBlur: 22,
    shadowAlpha: 0.5,
  }, 'exit filter at t0 exactly matches the normal idle render profile');

  const opacitySamples = [];
  for (let index = 0; index < 18; index += 1) {
    scene.setState(state({ stage: 4 }));
    scene.update(0.05);
    const sample = scene.getDiagnostics().demoness;
    opacitySamples.push(sample.opacity);
    assert.equal(sample.clip, preframe.clip, 'exit keeps the authored clip pose');
    assert.equal(sample.frame, preframe.frame, 'exit keeps the authored frame pose');
    assert.deepEqual(sample.temporal, preframe.temporal, 'exit keeps the authored sub-frame blend pose');
  }
  const intermediate = opacitySamples.filter((opacity) => opacity > 0.5 && opacity < 0.97);
  assert.ok(new Set(intermediate.map((opacity) => opacity.toFixed(4))).size >= 3);
  for (let index = 1; index < opacitySamples.length; index += 1) {
    assert.ok(opacitySamples[index] <= opacitySamples[index - 1], 'opacity never jumps brighter during exit');
  }
  const silhouette = scene.getDiagnostics().demoness;
  assert.equal(silhouette.visible, true);
  assert.equal(silhouette.state, 'silhouette');
  assert.equal(silhouette.revealed, false);
  assert.equal(silhouette.opacity, 0.5);
});

test('active Demoness effect remains revealed when heat falls back to Stage 4', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 5 }));
  advance(scene, 1.05);
  const active = [{ kind: 'demoness', phase: 'active', progress: 0.5 }];
  scene.setState(state({ stage: 5, encounters: active }));
  assert.equal(scene.getDiagnostics().demoness.state, 'cold-hold');
  scene.setState(state({ stage: 4, encounters: active }));
  const diagnostics = scene.getDiagnostics().demoness;
  assert.equal(diagnostics.state, 'cold-hold');
  assert.equal(diagnostics.revealed, true);
  assert.equal(diagnostics.coldStrength, 1);
});

test('pause freezes character animation application clock', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 3 }));
  advance(scene, 0.2);
  scene.setState(state({ stage: 3, paused: true }));
  const before = scene.getDiagnostics().servant;
  advance(scene, 0.5);
  const after = scene.getDiagnostics().servant;
  assert.equal(after.frame, before.frame);
  assert.equal(after.elapsed, before.elapsed);
});

test('character atlases preload immediately before their stage dependencies', () => {
  let created = 0;
  const imageFactory = () => {
    created += 1;
    return { complete: true, naturalWidth: 1536, naturalHeight: 1120, decoding: 'auto', src: '', addEventListener() {} };
  };
  const scene = new CharacterScene({ imageFactory });
  assert.equal(created, 0);
  scene.setState(state({ stage: 2, stageProgress: 0.61 }));
  assert.equal(created, 1);
  scene.setState(state({ stage: 3, stageProgress: 0.61 }));
  assert.equal(created, 3);
  scene.setState(state({ stage: 5, stageProgress: 0.61 }));
  assert.equal(created, 6);
});

test('Demoness cold curve has deliberate look, gather, stable hold and release', () => {
  assert.equal(demonessTemporalPhase({ phase: 'telegraph', progress: 0.1 }).phase, 'cast-look');
  assert.equal(demonessTemporalPhase({ phase: 'telegraph', progress: 0.9 }).phase, 'cast-gather');
  assert.equal(demonessTemporalPhase({ phase: 'active', progress: 0.5 }).phase, 'cold-hold');
  assert.ok(demonessTemporalPhase({ phase: 'active', progress: 0.75 }).frame >= 6, 'hold traverses the upper authored frames');
  const release = demonessTemporalPhase({ phase: 'active', progress: 0.9 });
  assert.equal(release.phase, 'cold-release');
  assert.ok(release.strength < 1);
});

test('Demoness source cells stay within 1.25x effective upscale at required DPR2 viewports', () => {
  for (const [width, height] of [[390, 844], [1366, 768], [768, 1024]]) {
    assert.ok(demonessEffectiveUpscale(width, height, 2) <= 1.25, `${width}x${height} exceeds the source-resolution contract`);
  }
});

test('ice shards disappear individually on contact before steam begins', () => {
  const beforeContact = visibleIceShardProgresses(0.96);
  assert.ok(beforeContact.some(({ progress }) => progress === 0.96));
  const atContact = visibleIceShardProgresses(1);
  assert.ok(atContact.length > 0, 'trailing shards remain in flight');
  assert.ok(atContact.every(({ progress }) => progress < 0.97), 'no shard remains embedded in the flame contact zone');
});

test('delayed clip decode freezes the last valid atlas frame until the requested atlas is ready', async () => {
  const images = [];
  const imageFactory = () => {
    const listeners = {};
    const image = {
      complete: false, naturalWidth: 0, naturalHeight: 0, decoding: 'auto', src: '',
      addEventListener(type, listener) { listeners[type] = listener; },
      resolve() { image.naturalWidth = 1024; image.naturalHeight = 640; listeners.load?.(); },
    };
    images.push(image);
    return image;
  };
  const scene = new CharacterScene({ imageFactory });
  scene.requestClipAsset('servant', 'idle');
  images[0].resolve();
  await Promise.resolve();
  scene.servantAnimator.setClip('idle');
  scene.servantAnimator.elapsed = 5 / 6;
  scene.requestClipAsset('servant', 'inhale');
  scene.servantAnimator.setClip('inhale');
  scene.servantAnimator.elapsed = 0.75;
  assert.deepEqual(scene.activeFrame('servant'), { x: 256, y: 320, w: 256, h: 320 });
  images[1].resolve();
  await Promise.resolve();
  assert.deepEqual(scene.activeFrame('servant'), { x: 768, y: 320, w: 256, h: 320 });
  assert.equal(scene.getDiagnostics().servant.assetClip, 'inhale');
});

test('delayed recovery-to-idle decode holds the final recovery pose instead of reindexing its atlas', async () => {
  const images = [];
  const imageFactory = () => {
    const listeners = {};
    const image = {
      complete: false, naturalWidth: 0, naturalHeight: 0, decoding: 'auto', src: '',
      addEventListener(type, listener) { listeners[type] = listener; },
      resolve() { image.naturalWidth = 1024; image.naturalHeight = 640; listeners.load?.(); },
    };
    images.push(image);
    return image;
  };
  const scene = new CharacterScene({ imageFactory });
  scene.requestClipAsset('servant', 'recovery');
  images[0].resolve();
  await Promise.resolve();
  scene.servantVisible = true;
  scene.servantRequested = 'idle';
  scene.servantDisplay = 'recovery';
  scene.servantRecoveryRemaining = 0.01;
  scene.servantAnimator.setClip('recovery');
  scene.servantAnimator.elapsed = 0.79;
  scene.update(0.05);
  assert.equal(scene.servantAnimator.clipName, 'idle');
  assert.deepEqual(scene.activeFrame('servant'), { x: 768, y: 320, w: 256, h: 320 });
  images[1].resolve();
  await Promise.resolve();
  assert.deepEqual(scene.activeFrame('servant'), { x: 0, y: 0, w: 256, h: 320 });
});

test('Demoness affects the flame only after the travelling cold effect makes contact', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 5 }));
  advance(scene, 1.05);
  scene.setFlameTarget({ x: 517, y: 982 });
  scene.setState(state({ stage: 5, encounters: [{ kind: 'demoness', phase: 'active', progress: 0.05 }] }));
  let diagnostics = scene.getDiagnostics();
  assert.equal(diagnostics.demoness.state, 'cold-ramp');
  assert.ok(diagnostics.demoness.coldStrength > 0);
  assert.equal(diagnostics.demoness.impactStrength, 0);
  assert.equal(diagnostics.reaction.source, 'none');
  assert.deepEqual(diagnostics.demoness.spell.target, { x: 517, y: 982 });

  scene.setState(state({ stage: 5, encounters: [{ kind: 'demoness', phase: 'active', progress: 0.199 }] }));
  diagnostics = scene.getDiagnostics();
  assert.ok(diagnostics.demoness.spellReach >= 0.97);
  assert.ok(diagnostics.demoness.impactStrength > 0);
  assert.equal(diagnostics.reaction.source, 'demoness-hold');
});
