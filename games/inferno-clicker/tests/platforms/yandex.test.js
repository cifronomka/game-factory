// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import { YandexPlatformService } from '../../src/platforms/yandex/YandexPlatformService.js';
import { MemoryStorage, createYandexMock, makeSave } from './helpers.js';

function serviceOptions(storage, mock, extra = {}) {
  return {
    storage,
    sdkFactory: async () => mock.sdk,
    documentTarget: null,
    windowTarget: null,
    now: () => 2_000,
    ...extra,
  };
}

test('Yandex init is time-boxed and degrades to playable Web capabilities', async () => {
  const service = new YandexPlatformService({
    storage: new MemoryStorage(),
    sdkFactory: () => new Promise(() => {}),
    initTimeoutMs: 5,
    documentTarget: null,
    windowTarget: null,
  });
  const result = await service.init();
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.platform, 'web');
    assert.equal(result.value.rewardedProvider, 'unavailable');
    assert.equal(result.value.rewardedAds, false);
    assert.equal(result.value.degradedFrom, 'yandex');
    assert.equal(result.value.degradedReason, 'timeout');
  }
  assert.equal((await service.showRewardedAd('inferno-seal')).status, 'unavailable');
});

test('incomplete SDK shape degrades without throwing into the app', async () => {
  const service = new YandexPlatformService({
    storage: new MemoryStorage(),
    sdkFactory: async () => /** @type {any} */ ({}),
    documentTarget: null,
    windowTarget: null,
  });
  const result = await service.init();
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.platform, 'web');
    assert.equal(result.value.rewardedProvider, 'unavailable');
    assert.equal(result.value.degradedReason, 'sdk-error');
  }
});

test('LoadingAPI.ready is emitted once and lifecycle markup is idempotent', async () => {
  const mock = createYandexMock();
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock));
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.rewardedProvider, 'yandex');
    assert.equal(initialized.value.rewardedAds, true);
  }
  await service.markReady();
  await service.markReady();
  assert.equal(mock.calls.ready, 1);

  service.resumeGame('menu');
  service.resumeGame('menu');
  assert.equal(mock.calls.start, 1);
  mock.emit('game_api_pause');
  mock.emit('game_api_pause');
  assert.equal(mock.calls.stop, 1);
  service.pauseGame('menu');
  mock.emit('game_api_resume');
  assert.equal(mock.calls.start, 2);
  assert.equal(mock.calls.stop, 2);
  assert.deepEqual(service.getPauseSnapshot().reasons, ['menu']);
  service.resumeGame('menu');
  assert.equal(mock.calls.start, 3);
});

test('Yandex mode never falls back to the Web test reward provider when the official ad API is absent', async () => {
  const mock = createYandexMock();
  delete mock.sdk.adv;
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock));
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.platform, 'yandex');
    assert.equal(initialized.value.rewardedProvider, 'unavailable');
    assert.equal(initialized.value.rewardedAds, false);
  }
  assert.equal((await service.showRewardedAd('inferno-seal')).status, 'unavailable');
});

test('authorized load merges cloud records but keeps newest settings and no run state', async () => {
  const storage = new MemoryStorage();
  const local = makeSave({
    bestScore: 500,
    highestStageReached: 4,
    runsPlayed: 9,
    settings: { muted: false, reducedMotion: false, updatedAt: 30 },
    updatedAt: 30,
  });
  storage.setItem('inferno-clicker:save:v1', JSON.stringify(local));
  const cloud = makeSave({
    bestScore: 400,
    highestStageReached: 7,
    runsPlayed: 5,
    settings: { muted: true, reducedMotion: true, updatedAt: 20 },
    updatedAt: 20,
  });
  const mock = createYandexMock({ cloudData: { infernoSaveV1: { ...cloud, heat: 999 } } });
  const service = new YandexPlatformService(serviceOptions(storage, mock));
  await service.init();
  const loaded = await service.loadData();
  assert.equal(loaded.ok, true);
  if (loaded.ok && loaded.value) {
    assert.equal(loaded.value.bestScore, 500);
    assert.equal(loaded.value.highestStageReached, 7);
    assert.equal(loaded.value.runsPlayed, 9);
    assert.equal(loaded.value.settings.muted, false);
    assert.equal('heat' in loaded.value, false);
  }
});

test('authorized cloud remains usable when localStorage writes fail', async () => {
  const storage = {
    getItem() { return null; },
    setItem() { throw new Error('storage blocked'); },
    removeItem() {},
  };
  const cloud = makeSave({ bestScore: 77 });
  const mock = createYandexMock({ cloudData: { infernoSaveV1: cloud } });
  const service = new YandexPlatformService(serviceOptions(storage, mock));
  await service.init();
  const loaded = await service.loadData();
  assert.equal(loaded.ok, true);
  if (loaded.ok) assert.equal(loaded.value?.bestScore, 77);
  const saved = await service.saveData(makeSave({ bestScore: 88 }));
  assert.equal(saved.ok, true);
  assert.equal(mock.calls.setData, 1);
});

test('guest uses local save and leaderboard submission returns unauthorized', async () => {
  const storage = new MemoryStorage();
  const mock = createYandexMock({ authorized: false });
  const service = new YandexPlatformService(serviceOptions(storage, mock));
  await service.init();
  const saved = await service.saveData(makeSave({ bestScore: 12 }));
  assert.equal(saved.ok, true);
  assert.equal(mock.calls.setData, 0);
  const submitted = await service.submitScore(12);
  assert.equal(submitted.ok, false);
  if (!submitted.ok) assert.equal(submitted.error.code, 'unauthorized');
});

test('leaderboard uses current direct API and deduplicates an in-flight Best Score', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const storage = new MemoryStorage();
  const mock = createYandexMock({ setScore: async () => gate });
  const service = new YandexPlatformService(serviceOptions(storage, mock));
  await service.init();
  await service.saveData(makeSave({ bestScore: 100 }));
  const first = service.submitScore(100);
  const duplicate = service.submitScore(100);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(mock.calls.setScore, [100]);
  release();
  assert.equal((await first).ok, true);
  assert.equal((await duplicate).ok, true);
  assert.equal((await service.submitScore(100)).ok, true);
  assert.deepEqual(mock.calls.setScore, [100]);

  const board = await service.getLeaderboard();
  assert.equal(board.ok, true);
  if (board.ok) assert.deepEqual(board.value[0], {
    rank: 1,
    score: 321,
    displayName: 'Игрок',
    isCurrentPlayer: false,
    source: 'yandex',
  });
});

test('stalled leaderboard read times out without blocking the results flow', async () => {
  const mock = createYandexMock();
  mock.sdk.leaderboards.getEntries = async () => new Promise(() => {});
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, { requestTimeoutMs: 5 }));
  await service.init();
  const result = await service.getLeaderboard();
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'timeout');
});

test('rewarded callback grants once; duplicate callbacks and close only settle once', async () => {
  const mock = createYandexMock({
    rewarded(callbacks) {
      callbacks.onOpen?.();
      callbacks.onRewarded?.();
      callbacks.onRewarded?.();
      callbacks.onClose?.(true);
      callbacks.onClose?.(true);
    },
  });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock));
  await service.init();
  service.resumeGame('menu');
  const snapshots = [];
  service.subscribePauseChanges((snapshot) => snapshots.push(snapshot));
  const result = await service.showRewardedAd('inferno-seal');
  assert.equal(result.status, 'rewarded');
  assert.equal(service.getPauseSnapshot().paused, false);
  assert.equal(snapshots.some((snapshot) => snapshot.reasons.includes('ad')), true);
});

test('rewarded close and SDK error never report a reward', async () => {
  const closedMock = createYandexMock({ rewarded: (callbacks) => callbacks.onClose?.(true) });
  const closedService = new YandexPlatformService(serviceOptions(new MemoryStorage(), closedMock));
  await closedService.init();
  assert.equal((await closedService.showRewardedAd('inferno-seal')).status, 'closed');

  const errorMock = createYandexMock({ rewarded: (callbacks) => {
    callbacks.onError?.(new Error('offline'));
    callbacks.onClose?.(false);
  } });
  const errorService = new YandexPlatformService(serviceOptions(new MemoryStorage(), errorMock));
  await errorService.init();
  const result = await errorService.showRewardedAd('inferno-seal');
  assert.equal(result.status, 'error');
  assert.equal(result.error?.code, 'sdk-error');
  assert.equal(errorService.getPauseSnapshot().reasons.includes('ad'), false);
});

test('rewarded timeout releases only the ad reason and grants no reward', async () => {
  const mock = createYandexMock({ rewarded() {} });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, { adTimeoutMs: 5 }));
  await service.init();
  service.resumeGame('menu');
  service.pauseGame('visibility');
  const result = await service.showRewardedAd('inferno-seal');
  assert.equal(result.status, 'error');
  assert.equal(result.error?.code, 'timeout');
  assert.deepEqual(service.getPauseSnapshot().reasons, ['visibility']);
});
