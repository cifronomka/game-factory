// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import { WebPlatformService } from '../../src/platforms/web/WebPlatformService.js';
import { EventHub, MemoryStorage, makeSave } from './helpers.js';

test('web adapter quarantines corrupt storage and returns safe defaults', async () => {
  const storage = new MemoryStorage();
  storage.setItem('save', '{broken');
  const diagnostics = [];
  const service = new WebPlatformService({
    storage,
    storageKey: 'save',
    now: () => 123,
    onDiagnostic: (event) => diagnostics.push(event.type),
    documentTarget: null,
    windowTarget: null,
  });
  const loaded = await service.loadData();
  assert.equal(loaded.ok, true);
  if (loaded.ok) assert.equal(loaded.value?.bestScore, 0);
  assert.deepEqual(diagnostics, ['save_recovered']);
  assert.equal(storage.getItem('save'), null);
  assert.equal(storage.getItem('save:corrupt:123'), '{broken');
});

test('web adapter keeps a local Best Score and review test rewards are async, idempotent, and show no fake ad', async () => {
  const storage = new MemoryStorage();
  const service = new WebPlatformService({ storage, documentTarget: null, windowTarget: null });
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.rewardedProvider, 'test');
    assert.equal(initialized.value.rewardedAds, true);
  }
  await service.saveData(makeSave({ bestScore: 10 }));
  assert.equal((await service.submitScore(9)).ok, true);
  assert.equal((await service.submitScore(15)).ok, true);
  const board = await service.getLeaderboard();
  assert.equal(board.ok, true);
  if (board.ok) assert.deepEqual(board.value.map(({ score, source }) => ({ score, source })), [{ score: 15, source: 'local' }]);
  let settled = false;
  const first = service.showRewardedAd('inferno-seal');
  first.then(() => { settled = true; });
  const duplicate = service.showRewardedAd('inferno-seal');
  assert.equal(settled, false);
  assert.strictEqual(duplicate, first);
  const reward = await first;
  assert.equal(reward.status, 'rewarded');
  assert.equal(reward.wasShown, false);
  assert.equal((await duplicate).requestId, reward.requestId);
  assert.equal((await service.showInterstitial('never')).status, 'unavailable');
});

test('web adapter can explicitly disable the test reward provider', async () => {
  const service = new WebPlatformService({
    storage: new MemoryStorage(),
    rewardedProvider: 'unavailable',
    documentTarget: null,
    windowTarget: null,
  });
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.rewardedProvider, 'unavailable');
    assert.equal(initialized.value.rewardedAds, false);
  }
  const result = await service.showRewardedAd('inferno-seal');
  assert.equal(result.status, 'unavailable');
  assert.equal(result.wasShown, undefined);
});

test('web adapter rejects a Yandex or unknown provider so providers remain mutually exclusive', () => {
  assert.throws(() => new WebPlatformService(/** @type {any} */ ({ rewardedProvider: 'yandex' })), /must be "test" or "unavailable"/);
  assert.throws(() => new WebPlatformService(/** @type {any} */ ({ rewardedProvider: 'other' })), /must be "test" or "unavailable"/);
});

test('web adapter converts storage exceptions into typed results', async () => {
  const storage = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('full'); },
    removeItem() {},
  };
  const service = new WebPlatformService({ storage, documentTarget: null, windowTarget: null });
  assert.deepEqual(await service.loadData(), { ok: true, value: null });
  const saved = await service.saveData(makeSave());
  assert.equal(saved.ok, false);
  if (!saved.ok) assert.equal(saved.error.code, 'storage-error');
});

test('visibility and menu reasons cannot clear each other or double-resume', async () => {
  const documentTarget = new EventHub();
  const windowTarget = new EventHub();
  const activeChanges = [];
  const service = new WebPlatformService({
    storage: new MemoryStorage(),
    documentTarget,
    windowTarget,
    onGameplayActiveChange: (active) => activeChanges.push(active),
  });
  await service.init();
  service.resumeGame('menu');
  service.pauseGame('menu');
  service.pauseGame('menu');
  documentTarget.hidden = true;
  documentTarget.emit('visibilitychange');
  service.resumeGame('menu');
  assert.deepEqual(service.getPauseSnapshot().reasons, ['visibility']);
  documentTarget.hidden = false;
  documentTarget.emit('visibilitychange');
  documentTarget.emit('visibilitychange');
  assert.equal(service.getPauseSnapshot().paused, false);
  assert.deepEqual(activeChanges, [true, false, true]);
});
