// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_ASSET_URLS, AudioMixer } from '../../src/presentation/audio/audioMixer.js';

function createRunningContext() {
  const counters = { sources: 0, starts: 0, stops: 0, closes: 0 };
  const sources = [];
  const parameter = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime(value) { this.value = value; }, linearRampToValueAtTime(value) { this.value = value; }, setTargetAtTime(value) { this.value = value; } });
  const context = {
    state: 'running', currentTime: 0, destination: {},
    createGain: () => ({ gain: parameter(), connect() {} }),
    createBufferSource: () => {
      counters.sources += 1;
      const source = { buffer: null, loop: false, onended: null, connect() {}, start() { counters.starts += 1; }, stop() { counters.stops += 1; } };
      sources.push(source);
      return source;
    },
    resume: async () => {},
    suspend: async () => { context.state = 'suspended'; },
    close: async () => { counters.closes += 1; context.state = 'closed'; },
  };
  return { context: /** @type {any} */ (context), counters, sources };
}

test('runtime registry provides OGG plus MP3 for wood, crackle and three fanning variants', () => {
  assert.deepEqual(Object.keys(AUDIO_ASSET_URLS), ['wood', 'crackle', 'fanA', 'fanB', 'fanC']);
  for (const candidates of Object.values(AUDIO_ASSET_URLS)) {
    assert.match(candidates[0].pathname, /\.ogg$/);
    assert.match(candidates[1].pathname, /\.mp3$/);
  }
});

test('Web Audio absence degrades silently without unlocking or rejecting', async () => {
  const mixer = new AudioMixer({ contextFactory: () => { throw new Error('unavailable'); } });
  assert.equal(await mixer.unlock(), false);
  assert.equal(mixer.getDiagnostics().unlocked, false);
  await mixer.destroy();
});

test('tap events before unlock never create audio', () => {
  const mixer = new AudioMixer();
  mixer.handleEvent({ type: 'tap-accepted', critical: false });
  assert.equal(mixer.getDiagnostics().activeVoices, 0);
  assert.equal(mixer.getDiagnostics().pendingFanTaps, 0);
});

test('AudioContext resume rejection stays recoverable', async () => {
  const context = { state: 'suspended', resume: async () => { throw new Error('gesture rejected'); } };
  const mixer = new AudioMixer({ contextFactory: () => /** @type {any} */ (context) });
  mixer.buildGraph = () => { mixer.context = /** @type {any} */ (context); };
  assert.equal(await mixer.unlock(), false);
  assert.equal(mixer.getDiagnostics().unlocked, false);
});

test('AudioContext suspend rejection is contained during pause', async () => {
  const context = { state: 'running', currentTime: 0, suspend: async () => { throw new Error('suspend rejected'); } };
  const mixer = new AudioMixer();
  mixer.context = /** @type {any} */ (context);
  await mixer.pause('menu');
  await new Promise((resolve) => setTimeout(resolve, 115));
  assert.equal(mixer.getDiagnostics().paused, true);
});

test('authored audio loads once and starts two continuous ambience beds', async () => {
  const { context, counters } = createRunningContext();
  const loaded = [];
  const mixer = new AudioMixer({ contextFactory: () => context, assetLoader: async (_context, key) => { loaded.push(key); return /** @type {any} */ ({ duration: 5 }); } });
  assert.deepEqual(await Promise.all([mixer.unlock(), mixer.unlock()]), [true, true]);
  assert.deepEqual(loaded.sort(), ['crackle', 'fanA', 'fanB', 'fanC', 'wood']);
  assert.equal(counters.sources, 2);
  assert.equal(mixer.getDiagnostics().continuousSources, 2);
  assert.equal(mixer.getDiagnostics().fanBuffers, 3);
  assert.equal(mixer.getDiagnostics().authoredWoodActive, true);
  assert.equal(await mixer.unlock(), true);
  assert.equal(loaded.length, 5);
  await mixer.destroy();
  assert.equal(counters.stops, 2);
  assert.equal(counters.closes, 1);
});

test('rapid taps aggregate into a bounded fanning voice with cooldown', async () => {
  const { context, counters, sources } = createRunningContext();
  const mixer = new AudioMixer({ contextFactory: () => context, assetLoader: async () => /** @type {any} */ ({ duration: 1 }) });
  await mixer.unlock();
  for (let index = 0; index < 20; index += 1) mixer.handleEvent({ type: 'tap-accepted', critical: false });
  assert.equal(mixer.getDiagnostics().pendingFanTaps, 20);
  await new Promise((resolve) => setTimeout(resolve, 135));
  assert.equal(counters.sources, 3, 'two loop beds plus one aggregated fan');
  assert.equal(mixer.getDiagnostics().activeFanVoices, 1);
  context.currentTime = 0.2;
  for (let index = 0; index < 8; index += 1) mixer.handleEvent({ type: 'tap-accepted', critical: false });
  await new Promise((resolve) => setTimeout(resolve, 135));
  assert.equal(mixer.getDiagnostics().activeFanVoices, 2);
  context.currentTime = 0.4;
  mixer.handleEvent({ type: 'tap-accepted', critical: false });
  await new Promise((resolve) => setTimeout(resolve, 135));
  assert.equal(mixer.getDiagnostics().activeFanVoices, 2, 'polyphony is capped at two fan voices');
  sources[2].onended?.();
  assert.equal(mixer.getDiagnostics().activeFanVoices, 1);
  await mixer.destroy();
});

test('failed authored codecs degrade to playable silence without refetch', async () => {
  const { context } = createRunningContext();
  let loads = 0;
  const mixer = new AudioMixer({ contextFactory: () => context, assetLoader: async () => { loads += 1; return null; } });
  assert.equal(await mixer.unlock(), true);
  assert.equal(mixer.getDiagnostics().continuousSources, 0);
  assert.equal(mixer.getDiagnostics().authoredAudioFailed, true);
  assert.equal(await mixer.unlock(), true);
  assert.equal(loads, 5);
  await mixer.destroy();
});

test('late authored decode cannot create a source after destroy', async () => {
  const { context, counters } = createRunningContext();
  const finishes = [];
  const mixer = new AudioMixer({ contextFactory: () => context, assetLoader: () => new Promise((resolve) => { finishes.push(resolve); }) });
  const unlocking = mixer.unlock();
  await Promise.resolve();
  await mixer.destroy();
  for (const finish of finishes) finish(/** @type {any} */ ({ duration: 5 }));
  assert.equal(await unlocking, true);
  assert.equal(counters.sources, 0);
  assert.equal(counters.starts, 0);
});
