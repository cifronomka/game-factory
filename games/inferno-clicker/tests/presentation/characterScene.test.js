// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterScene } from '../../src/presentation/scene/characterScene.js';

function state(overrides = {}) {
  return { stage: 1, stageProgress: 0, paused: false, servant: 'hidden', demoness: 'hidden', hostLevel: 0, ...overrides };
}

function advance(scene, seconds) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) scene.update(0.05);
}

test('servant completes appearance before inhale-blow cause and effect states', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 3, servant: 'inhale' }));
  assert.equal(scene.getDiagnostics().servant.state, 'appearance');
  advance(scene, 0.3);
  scene.setState(state({ stage: 3, servant: 'blow' }));
  assert.equal(scene.getDiagnostics().servant.state, 'appearance');
  advance(scene, 0.35);
  assert.equal(scene.getDiagnostics().servant.state, 'blow');
  scene.setState(state({ stage: 3, servant: 'idle' }));
  assert.equal(scene.getDiagnostics().servant.state, 'idle');
});

test('demoness completes appearance before cast-hold states', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 5, demoness: 'cast' }));
  assert.equal(scene.getDiagnostics().demoness.state, 'appearance');
  advance(scene, 1.05);
  assert.equal(scene.getDiagnostics().demoness.state, 'cast');
  scene.setState(state({ stage: 5, demoness: 'hold' }));
  assert.equal(scene.getDiagnostics().demoness.state, 'hold');
});

test('pause freezes character animation application clock', () => {
  const scene = new CharacterScene();
  scene.setState(state({ stage: 3, servant: 'idle' }));
  advance(scene, 0.2);
  scene.setState(state({ stage: 3, servant: 'idle', paused: true }));
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
    return { complete: true, naturalWidth: 1536, naturalHeight: 1024, decoding: 'auto', src: '', addEventListener() {} };
  };
  const scene = new CharacterScene({ imageFactory });
  assert.equal(created, 0);
  scene.setState(state({ stage: 2, stageProgress: 0.61 }));
  assert.equal(created, 1);
  scene.setState(state({ stage: 3, stageProgress: 0.61 }));
  assert.equal(created, 2);
  scene.setState(state({ stage: 5, stageProgress: 0.61 }));
  assert.equal(created, 3);
});
