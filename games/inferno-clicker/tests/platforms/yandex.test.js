// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPlatformLocale } from '../../src/platforms/types/platform.js';
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

async function drainPromiseJobs(turns = 20) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

test('Yandex init shares the five-second startup deadline and degrades to playable Web capabilities', async (context) => {
  let currentTime = 0;
  context.mock.timers.enable({ apis: ['setTimeout'], now: currentTime });
  const service = new YandexPlatformService({
    storage: new MemoryStorage(),
    sdkFactory: () => new Promise(() => {}),
    initTimeoutMs: 10_000,
    requestTimeoutMs: 10_000,
    bootstrapDeadlineAt: 5_000,
    now: () => currentTime,
    documentTarget: null,
    windowTarget: null,
  });
  let settled = false;
  let result;
  const pending = service.init().then((value) => {
    settled = true;
    result = value;
  });
  await drainPromiseJobs();
  currentTime = 4_999;
  context.mock.timers.tick(4_999);
  await drainPromiseJobs();
  assert.equal(settled, false, 'the SDK may use the startup budget before the absolute deadline');
  currentTime = 5_000;
  context.mock.timers.tick(1);
  await pending;
  assert.equal(settled, true, 'a stalled SDK init must settle at the shared five-second deadline');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.platform, 'web');
    assert.equal(result.value.authorized, false);
    assert.equal(result.value.leaderboardRead, false);
    assert.equal(result.value.leaderboardWrite, false);
    assert.equal(result.value.rewardedProvider, 'unavailable');
    assert.equal(result.value.rewardedAds, false);
    assert.equal(result.value.degradedFrom, 'yandex');
    assert.equal(result.value.degradedReason, 'timeout');
  }
  assert.equal((await service.showRewardedAd('heat-power-2x-60s')).status, 'unavailable');
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

test('synchronous player failure cannot escape initialization or block local play', async () => {
  const mock = createYandexMock();
  mock.sdk.getPlayer = () => { throw new Error('sync getPlayer failure'); };
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock));
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.platform, 'yandex');
    assert.equal(initialized.value.authorized, false);
    assert.equal(initialized.value.cloudSave, false);
    assert.equal(initialized.value.leaderboardWrite, false);
  }
  assert.equal((await service.saveData(makeSave({ bestScore: 9 }))).ok, true);
});

test('synchronous lifecycle subscription failure degrades to the playable Web adapter', async () => {
  const mock = createYandexMock();
  mock.sdk.on = () => { throw new Error('sync SDK on failure'); };
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock));
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.platform, 'web');
    assert.equal(initialized.value.degradedFrom, 'yandex');
    assert.equal(initialized.value.degradedReason, 'sdk-error');
    assert.equal(initialized.value.rewardedAds, false);
  }
});

test('LoadingAPI.ready is emitted once and lifecycle markup is idempotent', async () => {
  const mock = createYandexMock();
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock));
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.locale, 'ru');
    assert.equal(initialized.value.authorized, true);
    assert.equal(initialized.value.cloudSave, true);
    assert.equal(initialized.value.leaderboardRead, true);
    assert.equal(initialized.value.leaderboardWrite, true);
    assert.equal(initialized.value.rewardedProvider, 'yandex');
    assert.equal(initialized.value.rewardedAds, true);
  }
  await service.markReady();
  await service.markReady();
  assert.equal(mock.calls.ready, 1);
  assert.equal(mock.calls.start, 0, 'init and LoadingAPI.ready must not mark gameplay before the first tap');
  assert.equal(mock.calls.availableMethods.includes('leaderboards.setScore'), true);
  assert.equal(mock.calls.availableMethods.includes('leaderboards.getEntries'), true);

  service.pauseGame('menu');
  service.resumeGame('menu');
  assert.equal(mock.calls.start, 0, 'READY menu/goals round-trip must not mark gameplay');
  service.startGameplay();
  service.resumeGame('menu');
  assert.equal(mock.calls.start, 1);
  mock.emit('game_api_pause');
  mock.emit('game_api_pause');
  assert.equal(mock.calls.stop, 1);
  service.pauseGame('menu');
  mock.emit('game_api_resume');
  assert.equal(mock.calls.start, 1, 'platform resume must not restart while a menu pause reason remains');
  assert.equal(mock.calls.stop, 1, 'nested pause reasons must not duplicate GameplayAPI.stop');
  assert.deepEqual(service.getPauseSnapshot().reasons, ['menu']);
  service.startGameplay();
  service.resumeGame('menu');
  assert.equal(mock.calls.start, 2);
});

test('a stalled LoadingAPI.ready is time-boxed once without affecting gameplay lifecycle', async () => {
  const diagnostics = [];
  const mock = createYandexMock({ loadingReady: () => new Promise(() => {}) });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, {
    requestTimeoutMs: 5,
    onDiagnostic: (event) => diagnostics.push(event),
  }));
  await service.init();
  const result = await service.markReady();
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'timeout');
  assert.equal(mock.calls.ready, 1);
  assert.equal(diagnostics.some((event) => event.type === 'loading_ready_failed'), true);
  service.startGameplay();
  assert.equal(mock.calls.start, 1, 'ready timeout must not disable gameplay lifecycle');
  await service.markReady();
  assert.equal(mock.calls.ready, 1, 'ready remains at-most-once after a timeout');
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
  assert.equal((await service.showRewardedAd('heat-power-2x-60s')).status, 'unavailable');
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
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(mock.calls.setData, 1, 'record-max/local-latest merge must be written back to cloud');
  assert.equal(mock.calls.setDataPayloads[0].infernoSaveV1.bestScore, 500);
  assert.equal(mock.calls.setDataPayloads[0].infernoSaveV1.highestStageReached, 7);
  assert.deepEqual(mock.calls.setScore, [500], 'startup must automatically backfill a pre-existing local/guest best');
  assert.equal((await service.submitScore(500)).ok, true);
  assert.deepEqual(mock.calls.setScore, [500], 'manual or run-end submission must deduplicate the startup backfill');
});

test('authorized empty cloud is seeded from the local save without blocking the load result', async () => {
  const storage = new MemoryStorage();
  storage.setItem('inferno-clicker:save:v1', JSON.stringify(makeSave({ bestScore: 91, runsPlayed: 3 })));
  const mock = createYandexMock({ cloudData: {} });
  const service = new YandexPlatformService(serviceOptions(storage, mock));
  await service.init();
  const loaded = await service.loadData();
  assert.equal(loaded.ok && loaded.value?.bestScore, 91);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(mock.calls.setData, 1);
  assert.equal(mock.calls.setDataPayloads[0].infernoSaveV1.bestScore, 91);
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

test('cloud-only fallback acknowledges a newer save only after its rate-limited flush is durable', async (context) => {
  let currentTime = 0;
  context.mock.timers.enable({ apis: ['setTimeout'], now: currentTime });
  const storage = {
    getItem() { return null; },
    setItem() { throw new Error('storage blocked'); },
    removeItem() {},
  };
  const mock = createYandexMock();
  const service = new YandexPlatformService(serviceOptions(storage, mock, {
    now: () => currentTime,
    cloudWriteIntervalMs: 5_000,
  }));
  await service.init();

  const first = await service.saveData(makeSave({ bestScore: 100, updatedAt: 100 }));
  assert.equal(first.ok, true);
  assert.deepEqual(mock.calls.setDataFlush, [true]);
  assert.equal(/** @type {any} */ (mock.getCloudData()).infernoSaveV1.bestScore, 100);

  currentTime = 1_000;
  let secondSettled = false;
  const secondPromise = service.saveData(makeSave({ bestScore: 200, updatedAt: 200 }))
    .then((result) => { secondSettled = true; return result; });
  await drainPromiseJobs();
  assert.equal(secondSettled, false, 'queued cloud-only data cannot be acknowledged before setData');
  assert.equal(mock.calls.setData, 1);

  currentTime = 5_000;
  context.mock.timers.tick(4_000);
  const second = await secondPromise;
  assert.equal(second.ok, true);
  assert.equal(mock.calls.setData, 2);
  assert.deepEqual(mock.calls.setDataFlush, [true, true]);
  assert.equal(/** @type {any} */ (mock.getCloudData()).infernoSaveV1.bestScore, 200);
});

test('authorization loss disables cloud sync without an immediate retry loop', async () => {
  const diagnostics = [];
  const mock = createYandexMock();
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, {
    onDiagnostic: (event) => diagnostics.push(event.type),
  }));
  await service.init();
  service.player.isAuthorized = () => false;

  const saved = await service.saveData(makeSave({ bestScore: 123 }));
  await drainPromiseJobs();
  assert.equal(saved.ok, true, 'the successful local write remains durable');
  assert.equal(mock.calls.setData, 0);
  assert.equal(service.pendingCloudSave, null);
  assert.equal(service.cloudWriteTimer, null);
  assert.equal(service.capabilities.cloudSave, false);
  assert.equal(service.capabilities.leaderboardWrite, false);
  assert.equal(diagnostics.filter((type) => type === 'cloud_sync_disabled').length, 1);
});

test('cloud read receives only the startup deadline left after SDK and player initialization', async (context) => {
  let currentTime = 0;
  context.mock.timers.enable({ apis: ['setTimeout'], now: currentTime });
  const storage = new MemoryStorage();
  storage.setItem('inferno-clicker:save:v1', JSON.stringify(makeSave({ runsPlayed: 3 })));
  const mock = createYandexMock();
  let cloudReads = 0;
  const player = {
    isAuthorized: () => true,
    getUniqueID: () => 'player',
    getData: async () => {
      cloudReads += 1;
      return new Promise(() => {});
    },
    setData: async () => {},
  };
  mock.sdk.getPlayer = () => new Promise((resolve) => setTimeout(() => resolve(player), 2_000));
  const service = new YandexPlatformService(serviceOptions(storage, mock, {
    sdkFactory: () => new Promise((resolve) => setTimeout(() => resolve(mock.sdk), 1_000)),
    initTimeoutMs: 10_000,
    requestTimeoutMs: 10_000,
    bootstrapDeadlineAt: 5_000,
    now: () => currentTime,
  }));
  let settled = false;
  let loaded;
  const startup = service.init()
    .then(() => service.loadData())
    .then((value) => {
      settled = true;
      loaded = value;
    });

  await drainPromiseJobs();
  currentTime = 1_000;
  context.mock.timers.tick(1_000);
  await drainPromiseJobs();
  currentTime = 2_999;
  context.mock.timers.tick(1_999);
  await drainPromiseJobs();
  assert.equal(settled, false);
  currentTime = 3_000;
  context.mock.timers.tick(1);
  await drainPromiseJobs();
  assert.equal(cloudReads, 1, 'cloud read starts after the delayed SDK/player phases');
  currentTime = 4_999;
  context.mock.timers.tick(1_999);
  await drainPromiseJobs();
  assert.equal(settled, false, 'cloud read may use only the remaining startup budget');
  currentTime = 5_000;
  context.mock.timers.tick(1);
  await startup;
  assert.equal(settled, true, 'startup must not receive a fresh per-request timeout for cloud data');
  assert.equal(loaded.ok, true);
  assert.equal(loaded.ok && loaded.value?.runsPlayed, 3);
});

test('guest keeps local progress, reads the remote board, and skips writes without prompting', async () => {
  const storage = new MemoryStorage();
  const mock = createYandexMock({ authorized: false });
  const service = new YandexPlatformService(serviceOptions(storage, mock));
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.authorized, false);
    assert.equal(initialized.value.cloudSave, false);
    assert.equal(initialized.value.leaderboardRead, true);
    assert.equal(initialized.value.leaderboardWrite, false);
  }
  const saved = await service.saveData(makeSave({ bestScore: 12 }));
  assert.equal(saved.ok, true);
  assert.equal(mock.calls.setData, 0);
  const submitted = await service.submitScore(12);
  assert.equal(submitted.ok, true);
  assert.deepEqual(mock.calls.setScore, []);
  const board = await service.getLeaderboard();
  assert.equal(board.ok, true);
  assert.equal(mock.calls.getEntries, 1);
  assert.deepEqual(mock.calls.getEntriesOptions[0], { includeUser: false, quantityTop: 10 });
});

test('SDK language mapping selects Russian fallback group and English for all other languages', async () => {
  for (const language of ['ru', 'be', 'kk', 'uk', 'uz', 'ru-RU', 'KK_kz']) {
    assert.equal(mapPlatformLocale(language), 'ru');
  }
  for (const language of ['en', 'de', 'tr', '', undefined]) {
    assert.equal(mapPlatformLocale(language), 'en');
  }

  const russianMock = createYandexMock({ language: 'kk' });
  const russian = new YandexPlatformService(serviceOptions(new MemoryStorage(), russianMock));
  const russianInit = await russian.init();
  assert.equal(russianInit.ok && russianInit.value.locale, 'ru');

  const englishMock = createYandexMock({ language: 'tr' });
  const english = new YandexPlatformService(serviceOptions(new MemoryStorage(), englishMock));
  const englishInit = await english.init();
  assert.equal(englishInit.ok && englishInit.value.locale, 'en');
});

test('capabilities and calls honor current isAvailableMethod results', async () => {
  const storage = new MemoryStorage();
  const mock = createYandexMock({
    methodAvailability: {
      'leaderboards.setScore': false,
      'leaderboards.getEntries': false,
    },
  });
  const service = new YandexPlatformService(serviceOptions(storage, mock));
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.leaderboardRead, false);
    assert.equal(initialized.value.leaderboardWrite, false);
  }
  await service.saveData(makeSave({ bestScore: 20 }));
  const submitted = await service.submitScore(20);
  assert.equal(submitted.ok, false);
  if (!submitted.ok) assert.equal(submitted.error.code, 'unavailable');
  assert.deepEqual(mock.calls.setScore, []);
  const board = await service.getLeaderboard();
  assert.equal(board.ok, true);
  assert.equal(mock.calls.getEntries, 0);
});

test('missing isAvailableMethod disables leaderboard calls without breaking local or cloud persistence', async () => {
  const storage = new MemoryStorage();
  const mock = createYandexMock({ cloudData: { infernoSaveV1: makeSave({ bestScore: 20 }) } });
  delete /** @type {any} */ (mock.sdk).isAvailableMethod;
  const service = new YandexPlatformService(serviceOptions(storage, mock, { cloudWriteIntervalMs: 0 }));
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.localSave, true);
    assert.equal(initialized.value.cloudSave, true);
    assert.equal(initialized.value.leaderboard, 'local-only');
    assert.equal(initialized.value.leaderboardRead, false);
    assert.equal(initialized.value.leaderboardWrite, false);
  }

  const loaded = await service.loadData();
  assert.equal(loaded.ok && loaded.value?.bestScore, 20);
  const saved = await service.saveData(makeSave({ bestScore: 30, updatedAt: 300 }));
  assert.equal(saved.ok, true, 'local persistence remains the immediate acknowledgement boundary');
  const flushed = await service.flushData();
  assert.equal(flushed.ok, true);
  assert.equal(JSON.parse(storage.getItem('inferno-clicker:save:v1')).bestScore, 30);
  assert.equal(/** @type {any} */ (mock.getCloudData()).infernoSaveV1.bestScore, 30);

  const submitted = await service.submitScore(30);
  assert.equal(submitted.ok, false);
  if (!submitted.ok) assert.equal(submitted.error.code, 'unavailable');
  const board = await service.getLeaderboard();
  assert.equal(board.ok, true, 'leaderboard reads fall back to the local record');
  assert.deepEqual(mock.calls.setScore, []);
  assert.equal(mock.calls.getEntries, 0);
});

test('stalled player and method availability probes share one five-second startup deadline', async (context) => {
  let currentTime = 0;
  context.mock.timers.enable({ apis: ['setTimeout'], now: currentTime });
  const mock = createYandexMock();
  mock.sdk.getPlayer = async () => new Promise(() => {});
  mock.sdk.isAvailableMethod = async () => new Promise(() => {});
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, {
    initTimeoutMs: 10_000,
    requestTimeoutMs: 10_000,
    bootstrapDeadlineAt: 5_000,
    now: () => currentTime,
  }));
  let settled = false;
  let initialized;
  let loaded;
  const startup = service.init()
    .then(async (value) => {
      initialized = value;
      loaded = await service.loadData();
    })
    .then(() => { settled = true; });
  await drainPromiseJobs();
  currentTime = 4_999;
  context.mock.timers.tick(4_999);
  await drainPromiseJobs();
  assert.equal(settled, false);
  currentTime = 5_000;
  context.mock.timers.tick(1);
  await startup;
  assert.equal(settled, true, 'parallel hung probes must settle together at the absolute deadline');
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.platform, 'yandex');
    assert.equal(initialized.value.authorized, false);
    assert.equal(initialized.value.cloudSave, false);
    assert.equal(initialized.value.leaderboardRead, false);
    assert.equal(initialized.value.leaderboardWrite, false);
  }
  assert.equal(loaded.ok, true);
});

test('cloud persistence is immediate locally, throttled to one write per five seconds, and latest-wins merged', async () => {
  let currentTime = 0;
  const mock = createYandexMock();
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, {
    now: () => currentTime,
    cloudWriteIntervalMs: 5_000,
  }));
  await service.init();

  await service.saveData(makeSave({
    bestScore: 100,
    highestStageReached: 3,
    runsPlayed: 1,
    settings: { muted: false, reducedMotion: false, updatedAt: 100 },
    updatedAt: 100,
  }));
  await drainPromiseJobs();
  assert.equal(mock.calls.setData, 1);
  assert.deepEqual(mock.calls.setDataFlush, [false]);

  currentTime = 1_000;
  await service.saveData(makeSave({
    bestScore: 90,
    highestStageReached: 5,
    runsPlayed: 2,
    settings: { muted: true, reducedMotion: false, updatedAt: 200 },
    updatedAt: 200,
  }));
  currentTime = 2_000;
  await service.saveData(makeSave({
    bestScore: 150,
    highestStageReached: 4,
    runsPlayed: 3,
    settings: { muted: false, reducedMotion: true, updatedAt: 300 },
    updatedAt: 300,
  }));
  assert.equal(mock.calls.setData, 1);

  currentTime = 5_000;
  const flushed = await service.flushData();
  assert.equal(flushed.ok, true);
  assert.equal(mock.calls.setData, 2);
  assert.deepEqual(mock.calls.setDataFlush, [false, true]);
  const secondPayload = /** @type {any} */ (mock.calls.setDataPayloads[1]).infernoSaveV1;
  assert.equal(secondPayload.bestScore, 150);
  assert.equal(secondPayload.highestStageReached, 5);
  assert.equal(secondPayload.runsPlayed, 3);
  assert.deepEqual(secondPayload.settings, { muted: false, reducedMotion: true, updatedAt: 300 });

  currentTime = 6_000;
  await service.saveData(makeSave({ bestScore: 160, runsPlayed: 4, updatedAt: 400 }));
  assert.equal(mock.calls.setData, 2);
  currentTime = 10_000;
  await service.dispose();
  assert.equal(mock.calls.setData, 3);
  assert.deepEqual(mock.calls.setDataFlush, [false, true, true]);
});

test('a stale lower save cannot regress durable local or cloud record maxima', async () => {
  let currentTime = 0;
  const storage = new MemoryStorage();
  const mock = createYandexMock();
  const service = new YandexPlatformService(serviceOptions(storage, mock, {
    now: () => currentTime,
    cloudWriteIntervalMs: 5_000,
  }));
  await service.init();
  await service.saveData(makeSave({ bestScore: 100, highestStageReached: 3, updatedAt: 100 }));
  await drainPromiseJobs();
  currentTime = 1_000;
  await service.saveData(makeSave({ bestScore: 90, highestStageReached: 5, updatedAt: 200 }));
  currentTime = 5_000;
  const flushed = await service.flushData();
  assert.equal(flushed.ok, true);
  const local = JSON.parse(storage.getItem('inferno-clicker:save:v1'));
  const cloud = /** @type {any} */ (mock.getCloudData()).infernoSaveV1;
  assert.equal(local.bestScore, 100);
  assert.equal(local.highestStageReached, 5);
  assert.equal(cloud.bestScore, 100);
  assert.equal(cloud.highestStageReached, 5);
});

test('concurrent higher then lower saveData calls serialize without regressing maxima', async () => {
  const storage = new MemoryStorage();
  const mock = createYandexMock();
  const service = new YandexPlatformService(serviceOptions(storage, mock, { cloudWriteIntervalMs: 0 }));
  await service.init();
  const [higher, lower] = await Promise.all([
    service.saveData(makeSave({ bestScore: 200, highestStageReached: 5, updatedAt: 200 })),
    service.saveData(makeSave({ bestScore: 100, highestStageReached: 3, updatedAt: 100 })),
  ]);
  assert.equal(higher.ok, true);
  assert.equal(lower.ok, true);
  assert.equal((await service.flushData()).ok, true);
  const local = JSON.parse(storage.getItem('inferno-clicker:save:v1'));
  const cloud = /** @type {any} */ (mock.getCloudData()).infernoSaveV1;
  assert.equal(local.bestScore, 200);
  assert.equal(local.highestStageReached, 5);
  assert.equal(cloud.bestScore, 200);
  assert.equal(cloud.highestStageReached, 5);
  assert.equal(mock.calls.setDataPayloads.every((payload) => payload.infernoSaveV1.bestScore === 200), true);
});

test('cloud latest-wins queue preserves 200 while the 100 write is in flight', async () => {
  let releaseFirst;
  let markFirstStarted;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const firstStarted = new Promise((resolve) => { markFirstStarted = resolve; });
  const mock = createYandexMock({
    async setData(data) {
      if (/** @type {any} */ (data).infernoSaveV1.bestScore === 100) {
        markFirstStarted();
        await firstGate;
      }
    },
  });
  const storage = new MemoryStorage();
  const service = new YandexPlatformService(serviceOptions(storage, mock, { cloudWriteIntervalMs: 0 }));
  await service.init();

  const firstLocal = await service.saveData(makeSave({ bestScore: 100, updatedAt: 100 }));
  assert.equal(firstLocal.ok, true);
  await firstStarted;
  const latestLocal = await service.saveData(makeSave({ bestScore: 200, updatedAt: 200 }));
  assert.equal(latestLocal.ok, true, 'a newer local record must not wait behind the old cloud request');
  assert.equal(JSON.parse(storage.getItem('inferno-clicker:save:v1')).bestScore, 200);
  assert.deepEqual(mock.calls.setDataPayloads.map((payload) => payload.infernoSaveV1.bestScore), [100]);

  const flushing = service.flushData();
  releaseFirst();
  const flushed = await flushing;
  assert.equal(flushed.ok, true);
  assert.deepEqual(mock.calls.setDataPayloads.map((payload) => payload.infernoSaveV1.bestScore), [100, 200]);
  assert.deepEqual(mock.calls.setDataFlush, [false, true]);
});

test('explicit flush commits the last SDK-queued save even when no newer value is pending', async () => {
  const mock = createYandexMock();
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, {
    cloudWriteIntervalMs: 0,
  }));
  await service.init();
  await service.saveData(makeSave({ bestScore: 44 }));
  await drainPromiseJobs();
  assert.deepEqual(mock.calls.setDataFlush, [false]);
  const flushed = await service.flushData();
  assert.equal(flushed.ok, true);
  assert.deepEqual(mock.calls.setDataFlush, [false, true]);
  assert.deepEqual(mock.calls.setDataPayloads[1], mock.calls.setDataPayloads[0]);
});

test('local save acknowledges immediately while flush and dispose expose a stalled cloud write', async (context) => {
  let currentTime = 0;
  context.mock.timers.enable({ apis: ['setTimeout'], now: currentTime });
  const diagnostics = [];
  const mock = createYandexMock({ setData: async () => new Promise(() => {}) });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, {
    requestTimeoutMs: 5,
    cloudWriteIntervalMs: 0,
    now: () => currentTime,
    onDiagnostic: (event) => diagnostics.push(event.type),
  }));
  await service.init();
  const saved = await service.saveData(makeSave({ bestScore: 55 }));
  assert.equal(saved.ok, true, 'successful local persistence must not wait for the remote SDK');
  await drainPromiseJobs();
  assert.equal(mock.calls.setData, 1);
  let flushSettled = false;
  let flushResult;
  const flushing = service.flushData().then((result) => {
    flushSettled = true;
    flushResult = result;
  });
  await drainPromiseJobs();
  assert.equal(flushSettled, false);
  currentTime = 5;
  context.mock.timers.tick(5);
  await flushing;
  assert.equal(flushResult.ok, false);
  if (!flushResult.ok) assert.equal(flushResult.error.code, 'timeout');
  await service.dispose();
  assert.equal(mock.calls.setData, 1);
  assert.equal(diagnostics.includes('cloud_write_failed'), true);
  assert.equal(diagnostics.includes('cloud_flush_failed_on_dispose'), true);
});

test('explicit cloud flush retries the pending save after an SDK error', async () => {
  let currentTime = 0;
  let attempts = 0;
  const mock = createYandexMock({
    async setData() {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary cloud failure');
    },
  });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, {
    cloudWriteIntervalMs: 5_000,
    now: () => currentTime,
  }));
  await service.init();
  assert.equal((await service.saveData(makeSave({ bestScore: 66 }))).ok, true);
  await drainPromiseJobs();
  assert.equal(mock.calls.setData, 1);
  currentTime = 5_000;
  const retried = await service.flushData();
  assert.equal(retried.ok, true);
  assert.deepEqual(mock.calls.setDataPayloads.map((payload) => payload.infernoSaveV1.bestScore), [66, 66]);
});

test('timed-out cloud save retries only after the original SDK operation settles', async (context) => {
  let currentTime = 0;
  let releaseFirst;
  let attempts = 0;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  context.mock.timers.enable({ apis: ['setTimeout'], now: currentTime });
  const mock = createYandexMock({
    async setData() {
      attempts += 1;
      if (attempts === 1) await firstGate;
    },
  });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, {
    cloudWriteIntervalMs: 0,
    requestTimeoutMs: 5,
    now: () => currentTime,
  }));
  await service.init();
  assert.equal((await service.saveData(makeSave({ bestScore: 67 }))).ok, true);
  await drainPromiseJobs();
  assert.equal(mock.calls.setData, 1);

  const firstFlush = service.flushData();
  currentTime = 5;
  context.mock.timers.tick(5);
  const timedOut = await firstFlush;
  assert.equal(timedOut.ok, false);
  if (!timedOut.ok) assert.equal(timedOut.error.code, 'timeout');
  const overlapBlocked = await service.flushData();
  assert.equal(overlapBlocked.ok, false);
  if (!overlapBlocked.ok) assert.equal(overlapBlocked.error.code, 'timeout');
  assert.equal(mock.calls.setData, 1, 'retry must not overlap an SDK request that may still commit');

  releaseFirst();
  await drainPromiseJobs();
  const retried = await service.flushData();
  assert.equal(retried.ok, true);
  assert.deepEqual(mock.calls.setDataPayloads.map((payload) => payload.infernoSaveV1.bestScore), [67, 67]);
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

test('leaderboard latest-wins queue submits 200 after 100 is already in flight', async () => {
  let currentTime = 0;
  let releaseFirst;
  let markFirstStarted;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const firstStarted = new Promise((resolve) => { markFirstStarted = resolve; });
  const mock = createYandexMock({
    async setScore(_name, score) {
      if (score === 100) {
        markFirstStarted();
        await firstGate;
      }
    },
  });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, {
    now: () => currentTime,
  }));
  await service.init();

  const first = service.submitScore(100);
  await firstStarted;
  const latest = service.submitScore(200);
  await drainPromiseJobs();
  assert.deepEqual(mock.calls.setScore, [100], 'the improved score stays queued while 100 is in flight');
  currentTime = 1_000;
  releaseFirst();
  const [firstResult, latestResult] = await Promise.all([first, latest]);
  assert.equal(firstResult.ok, true);
  assert.equal(latestResult.ok, true);
  assert.deepEqual(mock.calls.setScore, [100, 200]);
});

test('concurrent high then lower submissions preserve the high local and remote score', async () => {
  const storage = new MemoryStorage();
  const mock = createYandexMock();
  const service = new YandexPlatformService(serviceOptions(storage, mock, { cloudWriteIntervalMs: 0 }));
  await service.init();
  const [higher, lower] = await Promise.all([service.submitScore(200), service.submitScore(100)]);
  assert.equal(higher.ok, true);
  assert.equal(lower.ok, true);
  assert.deepEqual(mock.calls.setScore, [200]);
  assert.equal(JSON.parse(storage.getItem('inferno-clicker:save:v1')).bestScore, 200);
});

test('leaderboard submission can retry the same score after an SDK error', async () => {
  let currentTime = 0;
  let attempts = 0;
  const mock = createYandexMock({
    async setScore() {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary leaderboard failure');
    },
  });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, {
    now: () => currentTime,
  }));
  await service.init();
  const failed = await service.submitScore(77);
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.error.code, 'sdk-error');
  currentTime = 1_000;
  const retried = await service.submitScore(77);
  assert.equal(retried.ok, true);
  assert.deepEqual(mock.calls.setScore, [77, 77]);
});

test('leaderboard timeout blocks a newer SDK write until the original operation settles', async (context) => {
  let currentTime = 0;
  let attempts = 0;
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  context.mock.timers.enable({ apis: ['setTimeout'], now: currentTime });
  const mock = createYandexMock({
    async setScore() {
      attempts += 1;
      if (attempts === 1) await firstGate;
    },
  });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, {
    requestTimeoutMs: 5,
    now: () => currentTime,
  }));
  await service.init();
  const first = service.submitScore(88);
  await drainPromiseJobs();
  assert.deepEqual(mock.calls.setScore, [88]);
  currentTime = 5;
  context.mock.timers.tick(5);
  const timedOut = await first;
  assert.equal(timedOut.ok, false);
  if (!timedOut.ok) assert.equal(timedOut.error.code, 'timeout');

  const blocked = await service.submitScore(200);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error.code, 'busy');
  assert.deepEqual(mock.calls.setScore, [88], 'no newer SDK write may overtake the timed-out live operation');

  currentTime = 1_000;
  releaseFirst();
  await drainPromiseJobs(40);
  assert.deepEqual(mock.calls.setScore, [88, 200]);
  assert.equal(service.highestSubmittedScore, 200);
  assert.equal(service.pendingBestScore, null);
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

test('leaderboard reads use a short cache and never exceed 20 SDK calls per five-minute window', async () => {
  const mock = createYandexMock({ authorized: false });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock));
  await service.init();
  assert.equal((await service.getLeaderboard()).ok, true);
  assert.equal((await service.getLeaderboard()).ok, true);
  assert.equal(mock.calls.getEntries, 1, 'fresh leaderboard cache should avoid a second SDK call');
  for (let index = 1; index < 20; index += 1) {
    service.leaderboardCache = null;
    assert.equal((await service.getLeaderboard()).ok, true);
  }
  assert.equal(mock.calls.getEntries, 20);
  service.leaderboardCache = null;
  const limited = await service.getLeaderboard();
  assert.equal(limited.ok, true, 'rate limit degrades to the local board');
  assert.equal(mock.calls.getEntries, 20);
});

test('stalled leaderboard score submission times out but retains the live SDK ordering lock', async () => {
  const mock = createYandexMock({ setScore: async () => new Promise(() => {}) });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, { requestTimeoutMs: 5 }));
  await service.init();
  const result = await service.submitScore(33);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'timeout');
  assert.equal(service.pendingScore, null);
  assert.notEqual(service.leaderboardSdkOperation, null);
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
  const legacy = await service.showRewardedAd(/** @type {any} */ ('inferno-seal'));
  assert.equal(legacy.status, 'unavailable');
  assert.equal(mock.calls.rewardedVideo, 0);
  service.startGameplay();
  service.resumeGame('menu');
  const snapshots = [];
  service.subscribePauseChanges((snapshot) => snapshots.push(snapshot));
  const result = await service.showRewardedAd('heat-power-2x-60s');
  assert.equal(result.status, 'rewarded');
  assert.equal(mock.calls.rewardedVideo, 1);
  assert.equal(service.getPauseSnapshot().paused, false);
  assert.equal(snapshots.some((snapshot) => snapshot.reasons.includes('ad')), true);
});

test('rewarded close and SDK error never report a reward', async () => {
  const closedMock = createYandexMock({ rewarded: (callbacks) => callbacks.onClose?.(true) });
  const closedService = new YandexPlatformService(serviceOptions(new MemoryStorage(), closedMock));
  await closedService.init();
  assert.equal((await closedService.showRewardedAd('heat-power-2x-60s')).status, 'closed');

  const errorMock = createYandexMock({ rewarded: (callbacks) => {
    callbacks.onError?.(new Error('offline'));
    callbacks.onClose?.(false);
  } });
  const errorService = new YandexPlatformService(serviceOptions(new MemoryStorage(), errorMock));
  await errorService.init();
  const result = await errorService.showRewardedAd('heat-power-2x-60s');
  assert.equal(result.status, 'error');
  assert.equal(result.error?.code, 'sdk-error');
  assert.equal(errorService.getPauseSnapshot().reasons.includes('ad'), false);
});

test('late onRewarded after a terminal close is ignored', async () => {
  let earned = 0;
  const mock = createYandexMock({ rewarded: (callbacks) => {
    callbacks.onOpen?.();
    callbacks.onClose?.(true);
    callbacks.onRewarded?.();
    setTimeout(() => callbacks.onRewarded?.(), 0);
  } });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock));
  await service.init();
  const result = await service.showRewardedAd('heat-power-2x-60s', { onRewarded: () => { earned += 1; } });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(result.status, 'closed');
  assert.equal(earned, 0);
});

test('onRewarded delivers exactly once before close while the ad pause remains terminal-bound', async () => {
  let callbacks;
  const mock = createYandexMock({ rewarded(value) { callbacks = value; } });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock));
  await service.init();
  service.startGameplay();
  service.resumeGame('menu');
  let earned = 0;
  let terminal = false;
  const pending = service.showRewardedAd('heat-power-2x-60s', { onRewarded: () => { earned += 1; } });
  pending.then(() => { terminal = true; });
  await new Promise((resolve) => setImmediate(resolve));
  callbacks.onOpen?.();
  callbacks.onRewarded?.();
  callbacks.onRewarded?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(earned, 1);
  assert.equal(terminal, false);
  assert.equal(service.getPauseSnapshot().reasons.includes('ad'), true);
  assert.equal((await service.showRewardedAd('heat-power-2x-60s')).status, 'unavailable');
  callbacks.onError?.(new Error('terminal after earned reward'));
  const result = await pending;
  assert.equal(result.status, 'rewarded');
  assert.equal(service.getPauseSnapshot().reasons.includes('ad'), false);
  callbacks.onClose?.(true);
  assert.equal(service.getPauseSnapshot().reasons.includes('ad'), false);
});

test('earned reward survives a missing close and the terminal timeout releases ad pause', async () => {
  const mock = createYandexMock({ rewarded(callbacks) {
    callbacks.onOpen?.();
    callbacks.onRewarded?.();
  } });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, { adTimeoutMs: 5 }));
  await service.init();
  service.startGameplay();
  service.resumeGame('menu');
  let earned = 0;
  const pending = service.showRewardedAd('heat-power-2x-60s', { onRewarded: () => { earned += 1; } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(earned, 1);
  assert.equal(service.getPauseSnapshot().reasons.includes('ad'), true);
  const result = await pending;
  assert.equal(result.status, 'rewarded');
  assert.equal(service.getPauseSnapshot().reasons.includes('ad'), false);
});

test('rewarded timeout releases only the ad reason and grants no reward', async () => {
  const mock = createYandexMock({ rewarded() {} });
  const service = new YandexPlatformService(serviceOptions(new MemoryStorage(), mock, { adTimeoutMs: 5 }));
  await service.init();
  service.resumeGame('menu');
  service.pauseGame('visibility');
  const result = await service.showRewardedAd('heat-power-2x-60s');
  assert.equal(result.status, 'error');
  assert.equal(result.error?.code, 'timeout');
  assert.deepEqual(service.getPauseSnapshot().reasons, ['visibility']);
});
