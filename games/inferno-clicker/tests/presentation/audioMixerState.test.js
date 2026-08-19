import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioMixerState } from '../../src/presentation/audio/audioMixerState.js';

test('audio remains unavailable before explicit unlock and while muted', () => {
  const state = new AudioMixerState();
  assert.equal(state.canPlay(), false);
  state.unlock();
  assert.equal(state.canPlay(), true);
  state.setMuted(true);
  assert.equal(state.canPlay(), false);
});

test('pause reasons are independent and one resume cannot clear another', () => {
  const state = new AudioMixerState();
  state.unlock();
  state.pause('ad');
  state.pause('visibility');
  state.resume('ad');
  assert.equal(state.snapshot().paused, true);
  assert.deepEqual(state.snapshot().pauseReasons, ['visibility']);
  state.resume('visibility');
  assert.equal(state.canPlay(), true);
});

test('polyphony hard cap is sixteen and voices can be reclaimed', () => {
  const state = new AudioMixerState(16);
  state.unlock();
  const ids = Array.from({ length: 16 }, () => state.beginVoice());
  assert.ok(ids.every((id) => id !== null));
  assert.equal(state.beginVoice(), null);
  state.endVoice(ids[0]);
  assert.notEqual(state.beginVoice(), null);
  assert.equal(state.snapshot().activeVoices, 16);
});

test('stage and boost state are clamped and explicit', () => {
  const state = new AudioMixerState();
  state.setStage(12);
  state.setBoost(true);
  assert.equal(state.snapshot().stage, 7);
  assert.equal(state.snapshot().boost, true);
});
