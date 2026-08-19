// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import { createDevPlatformService } from '../../src/platforms/dev/DevPlatformService.js';
import { MemoryStorage } from './helpers.js';

test('development rewarded mock is deny-by-default in production', () => {
  assert.throws(() => createDevPlatformService({
    isProduction: true,
    allowDevMocks: true,
  }), /forbidden in production/);
  assert.throws(() => createDevPlatformService({
    isProduction: false,
    allowDevMocks: false,
  }), /explicitly enabled/);
});

test('explicit non-production mock can emulate rewarded without an SDK', async () => {
  const service = createDevPlatformService({
    isProduction: false,
    allowDevMocks: true,
    rewardedResult: 'rewarded',
    storage: new MemoryStorage(),
  });
  const initialized = await service.init();
  assert.equal(initialized.ok, true);
  if (initialized.ok) {
    assert.equal(initialized.value.platform, 'development');
    assert.equal(initialized.value.rewardedProvider, 'test');
    assert.equal(initialized.value.rewardedAds, true);
  }
  let settled = false;
  const first = service.showRewardedAd('inferno-seal');
  first.then(() => { settled = true; });
  const duplicate = service.showRewardedAd('inferno-seal');
  assert.equal(settled, false);
  assert.strictEqual(duplicate, first);
  const result = await first;
  assert.equal(result.status, 'rewarded');
  assert.equal(result.wasShown, false);
});
