import test from 'node:test';
import assert from 'node:assert/strict';
import { OptionalBitmap } from '../../src/presentation/scene/optionalBitmap.js';
import { EnvironmentScene, INFERNAL_CHAMBER_URL } from '../../src/presentation/scene/environmentScene.js';
import {
  ASH_SERVANT_ATLAS_URL,
  ASH_SERVANT_ATLAS_URLS,
  CharacterScene,
  DEMONESS_ATLAS_URL,
  DEMONESS_ATLAS_URLS,
  INFERNO_HOST_URL,
  INFERNO_HOST_URLS,
} from '../../src/presentation/scene/characterScene.js';
import { FLAME_ATLAS_URLS, STAGE_FLARE_URL } from '../../src/presentation/scene/flameRig.js';

function fakeImage(width, height) {
  return {
    complete: true,
    naturalWidth: width,
    naturalHeight: height,
    decoding: 'auto',
    src: '',
    addEventListener() {},
  };
}

test('asset URLs remain relative to the copied src/assets dist layout', () => {
  assert.match(INFERNAL_CHAMBER_URL, /\/assets\/backgrounds\/bg-infernal-chamber-production\.webp$/);
  assert.match(ASH_SERVANT_ATLAS_URL, /\/assets\/characters\/ash-servant\/ash-servant-idle-v4\.webp$/);
  assert.match(ASH_SERVANT_ATLAS_URLS.recovery, /\/assets\/characters\/ash-servant\/ash-servant-recovery-v4\.webp$/);
  assert.match(DEMONESS_ATLAS_URL, /\/assets\/characters\/demoness\/demoness-idle-v5\.webp$/);
  assert.match(DEMONESS_ATLAS_URLS.cast, /\/assets\/characters\/demoness\/demoness-cast-v5\.webp$/);
  assert.match(INFERNO_HOST_URL, /\/assets\/characters\/character-inferno-host-main-v4\.webp$/);
  assert.match(INFERNO_HOST_URLS.sentinel, /\/assets\/characters\/character-inferno-host-sentinel-v4\.webp$/);
  assert.match(FLAME_ATLAS_URLS.low.core, /\/assets\/flame\/atlases\/core-low-v2\.webp$/);
  assert.match(FLAME_ATLAS_URLS.low.outer, /\/assets\/flame\/atlases\/outer-low-v2\.webp$/);
  assert.match(FLAME_ATLAS_URLS.mid.core, /\/assets\/flame\/atlases\/core-mid-v2\.webp$/);
  assert.match(FLAME_ATLAS_URLS.high.outer, /\/assets\/flame\/atlases\/outer-high-v2\.webp$/);
  assert.match(STAGE_FLARE_URL, /\/assets\/flame\/transitions\/stage-flare-v2\.webp$/);
});

test('optional bitmap is unavailable without Image and scenes fail safely without geometric characters', () => {
  const bitmap = new OptionalBitmap('asset.png', { imageFactory: () => null });
  assert.equal(bitmap.status, 'unavailable');
  assert.equal(bitmap.isReady(), false);
  const background = new EnvironmentScene({ imageFactory: () => null });
  const characters = new CharacterScene({ imageFactory: () => null });
  assert.equal(background.background.status, 'unavailable');
  assert.equal(characters.servantBitmap.status, 'idle');
  assert.equal(characters.demonessBitmap.status, 'idle');
  assert.equal(characters.hostBitmap.status, 'idle');
});

test('lazy optional bitmap does not allocate Image until explicitly requested', () => {
  let factories = 0;
  const bitmap = new OptionalBitmap('asset.png', { autoLoad: false, imageFactory: () => { factories += 1; return fakeImage(64, 64); } });
  assert.equal(bitmap.status, 'idle');
  assert.equal(factories, 0);
  bitmap.startLoad();
  assert.equal(bitmap.status, 'ready');
  assert.equal(factories, 1);
});

test('optional bitmap release drops the decoded image and permits a clean reload', () => {
  let factories = 0;
  const bitmap = new OptionalBitmap('asset.png', { autoLoad: false, imageFactory: () => { factories += 1; return fakeImage(64, 64); } });
  bitmap.startLoad();
  assert.equal(bitmap.status, 'ready');
  bitmap.release();
  assert.equal(bitmap.status, 'idle');
  assert.equal(bitmap.image, null);
  bitmap.startLoad();
  assert.equal(bitmap.status, 'ready');
  assert.equal(factories, 2);
});

test('critical bitmap exposes one bounded explicit retry', async () => {
  const listeners = [];
  let factories = 0;
  const bitmap = new OptionalBitmap('asset.png', {
    imageFactory: () => {
      factories += 1;
      return {
        complete: false,
        naturalWidth: 0,
        naturalHeight: 0,
        decoding: 'auto',
        src: '',
        addEventListener(type, listener) { listeners.push({ type, listener }); },
      };
    },
  });
  listeners.find((item) => item.type === 'error')?.listener();
  assert.equal(await bitmap.whenSettled(), 'failed');
  const retry = bitmap.retry();
  listeners.slice(2).find((item) => item.type === 'load')?.listener();
  assert.equal(await retry, true);
  assert.equal(factories, 2);
  assert.equal(await bitmap.retry(), true);
  assert.equal(factories, 2);
});

test('cover crops portrait source instead of distorting it', () => {
  const image = fakeImage(1024, 1536);
  const bitmap = new OptionalBitmap('background.png', { imageFactory: () => image });
  const calls = [];
  const context = { drawImage: (...args) => calls.push(args) };
  assert.equal(bitmap.drawCover(context, 0, 0, 1080, 1920), true);
  assert.equal(calls.length, 1);
  const [, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height] = calls[0];
  assert.equal(sourceY, 0);
  assert.equal(sourceHeight, 1536);
  assert.equal(sourceWidth, 864);
  assert.equal(sourceX, 80);
  assert.deepEqual([x, y, width, height], [0, 0, 1080, 1920]);
});

test('transparent character cutout uses contain placement', () => {
  const image = fakeImage(768, 1152);
  const bitmap = new OptionalBitmap('character.png', { imageFactory: () => image });
  const calls = [];
  const context = { drawImage: (...args) => calls.push(args) };
  assert.equal(bitmap.drawContain(context, 225, 470, 630, 900), true);
  const [, x, y, width, height] = calls[0];
  assert.equal(height, 900);
  assert.equal(width, 600);
  assert.equal(x, 240);
  assert.equal(y, 470);
});
