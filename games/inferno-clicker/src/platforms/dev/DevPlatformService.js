// @ts-check

import { ok } from '../types/result.js';
import { REWARDED_PLACEMENT } from '../types/platform.js';
import { WebPlatformService } from '../web/WebPlatformService.js';

class DevPlatformService extends WebPlatformService {
  /** @param {object} options @param {'rewarded'|'closed'|'error'} options.rewardedResult */
  constructor(options) {
    super(options);
    this.rewardedResult = options.rewardedResult;
    /** @type {Promise<import('../types/platform.js').RewardedResult>|null} */
    this.pendingDevReward = null;
    this.capabilities = Object.freeze({
      platform: 'development',
      locale: this.capabilities.locale,
      authorized: false,
      localSave: this.capabilities.localSave,
      cloudSave: false,
      leaderboard: 'local-only',
      leaderboardRead: false,
      leaderboardWrite: false,
      rewardedProvider: 'test',
      rewardedAds: true,
      interstitialAds: false,
      gameplayLifecycle: true,
    });
  }

  async init() {
    await super.init();
    return ok(this.capabilities);
  }

  /** @param {typeof REWARDED_PLACEMENT} placement */
  showRewardedAd(placement) {
    if (placement !== REWARDED_PLACEMENT) return super.showRewardedAd(placement);
    if (this.pendingDevReward) return this.pendingDevReward;
    this.requestCounter += 1;
    const requestId = `dev-rewarded-${this.requestCounter}`;
    const request = Promise.resolve().then(() => {
      if (this.rewardedResult === 'rewarded') return /** @type {import('../types/platform.js').RewardedResult} */ ({ status: 'rewarded', requestId, wasShown: false });
      if (this.rewardedResult === 'closed') return /** @type {import('../types/platform.js').RewardedResult} */ ({ status: 'closed', requestId, wasShown: false });
      return /** @type {import('../types/platform.js').RewardedResult} */ ({
        status: 'error',
        requestId,
        wasShown: false,
        error: { code: 'sdk-error', message: 'Configured development provider failure.', retryable: true },
      });
    }).finally(() => {
      if (this.pendingDevReward === request) this.pendingDevReward = null;
    });
    this.pendingDevReward = request;
    return request;
  }
}

/**
 * Development mocks are deny-by-default and require an explicit non-production build flag.
 * @param {object} options
 * @param {false} options.isProduction
 * @param {true} options.allowDevMocks
 * @param {'rewarded'|'closed'|'error'} [options.rewardedResult]
 * @param {import('../web/WebPlatformService.js').StorageLike|null} [options.storage]
 */
export function createDevPlatformService(options) {
  if (options?.isProduction !== false || options?.allowDevMocks !== true) {
    throw new Error('Development platform mocks are forbidden in production and must be explicitly enabled.');
  }
  return new DevPlatformService({ ...options, rewardedResult: options.rewardedResult ?? 'rewarded' });
}
