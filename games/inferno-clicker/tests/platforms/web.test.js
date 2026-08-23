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

test('web adapter keeps a local Best Score and never exposes a fake reward', async () => {
  const storage = new MemoryStorage();
  const service = new WebPlatformService({ storage, locale: 'en', documentTarget: null, windowTarget: null });
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.locale, 'en');
    assert.equal(initialized.value.authorized, false);
    assert.equal(initialized.value.leaderboardRead, false);
    assert.equal(initialized.value.leaderboardWrite, false);
    assert.equal(initialized.value.rewardedProvider, 'unavailable');
    assert.equal(initialized.value.rewardedAds, false);
  }
  await service.saveData(makeSave({ bestScore: 10 }));
  assert.equal((await service.submitScore(9)).ok, true);
  assert.equal((await service.submitScore(15)).ok, true);
  const board = await service.getLeaderboard();
  assert.equal(board.ok, true);
  if (board.ok) assert.deepEqual(board.value.map(({ score, source }) => ({ score, source })), [{ score: 15, source: 'local' }]);
  const reward = await service.showRewardedAd('heat-power-2x-60s');
  assert.equal(reward.status, 'unavailable');
  assert.equal(reward.wasShown, undefined);
  assert.equal((await service.showInterstitial('never')).status, 'unavailable');
});

test('concurrent local score submissions cannot let a lower score overwrite a higher one', async () => {
  const storage = new MemoryStorage();
  const service = new WebPlatformService({ storage, documentTarget: null, windowTarget: null });
  await service.init();
  const [higher, lower] = await Promise.all([service.submitScore(200), service.submitScore(100)]);
  assert.equal(higher.ok, true);
  assert.equal(lower.ok, true);
  assert.equal(JSON.parse(storage.getItem('inferno-clicker:save:v1')).bestScore, 200);
});

test('legacy Web test-provider input cannot re-enable a fake reward', async () => {
  const service = new WebPlatformService(/** @type {any} */ ({
    storage: new MemoryStorage(),
    rewardedProvider: 'test',
    documentTarget: null,
    windowTarget: null,
  }));
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.rewardedProvider, 'unavailable');
    assert.equal(initialized.value.rewardedAds, false);
  }
  const result = await service.showRewardedAd('heat-power-2x-60s');
  assert.equal(result.status, 'unavailable');
  assert.equal(result.wasShown, undefined);
});

test('web adapter rejects legacy reward placement', async () => {
  const service = new WebPlatformService({ storage: new MemoryStorage(), documentTarget: null, windowTarget: null });
  const result = await service.showRewardedAd(/** @type {any} */ ('inferno-seal'));
  assert.equal(result.status, 'unavailable');
  assert.match(result.error?.message ?? '', /Invalid placement/);
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
  service.startGameplay();
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
