// @ts-check

import { MAX_SCORE, createDefaultSave, mergeInfernoSaves, parseInfernoSave } from '../types/save.js';
import { errorMessage, fail, ok } from '../types/result.js';
import { WebPlatformService } from '../web/WebPlatformService.js';
import { createGlobalYandexSdkFactory } from './sdk.js';

export const DEFAULT_LEADERBOARD_NAME = 'best-score';
export const DEFAULT_CLOUD_SAVE_KEY = 'infernoSaveV1';

export class YandexPlatformService {
  /**
   * @param {object} [options]
   * @param {() => Promise<import('./sdk.js').YandexSdk>} [options.sdkFactory]
   * @param {number} [options.initTimeoutMs]
   * @param {number} [options.adTimeoutMs]
   * @param {number} [options.requestTimeoutMs]
   * @param {string} [options.leaderboardName]
   * @param {string} [options.cloudSaveKey]
   * @param {()=>number} [options.now]
   * @param {(diagnostic:{type:string,detail?:Record<string,unknown>})=>void} [options.onDiagnostic]
   * @param {import('../web/WebPlatformService.js').StorageLike|null} [options.storage]
   * @param {object|null} [options.documentTarget]
   * @param {object|null} [options.windowTarget]
   */
  constructor(options = {}) {
    this.sdkFactory = options.sdkFactory ?? createGlobalYandexSdkFactory();
    this.initTimeoutMs = options.initTimeoutMs ?? 5_000;
    this.adTimeoutMs = options.adTimeoutMs ?? 120_000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5_000;
    this.leaderboardName = options.leaderboardName ?? DEFAULT_LEADERBOARD_NAME;
    this.cloudSaveKey = options.cloudSaveKey ?? DEFAULT_CLOUD_SAVE_KEY;
    this.now = options.now ?? Date.now;
    this.onDiagnostic = options.onDiagnostic ?? (() => {});
    /** @type {import('./sdk.js').YandexSdk|null} */
    this.sdk = null;
    /** @type {import('./sdk.js').YandexPlayer|null} */
    this.player = null;
    /** @type {Promise<import('./sdk.js').YandexPlayer|null>|null} */
    this.playerPromise = null;
    this.readySent = false;
    /** @type {Promise<import('../types/result.js').Result<import('../types/platform.js').PlatformCapabilities>>|null} */
    this.initPromise = null;
    this.requestCounter = 0;
    this.highestSubmittedScore = -1;
    /** @type {number|null} */
    this.pendingBestScore = null;
    this.lastScoreAttemptAt = Number.NEGATIVE_INFINITY;
    /** @type {null|{score:number,promise:Promise<import('../types/result.js').Result<void>>}} */
    this.pendingScore = null;
    /** @type {null|{requestId:string}} */
    this.pendingReward = null;
    /** @type {null|(()=>void)} */
    this.detachSdkEvents = null;
    this.suppressMarkup = false;
    this.platformPausedActiveGameplay = false;

    this.web = new WebPlatformService({
      storage: options.storage,
      now: this.now,
      rewardedProvider: 'unavailable',
      onDiagnostic: this.onDiagnostic,
      documentTarget: /** @type {any} */ (options.documentTarget),
      windowTarget: /** @type {any} */ (options.windowTarget),
      onGameplayActiveChange: (active) => this.#markGameplay(active),
    });
    /** @type {import('../types/platform.js').PlatformCapabilities} */
    this.capabilities = this.#fallbackCapabilities();
  }

  async init() {
    if (!this.initPromise) this.initPromise = this.#initialize();
    return this.initPromise;
  }

  async #initialize() {
    await this.web.init();

    const sdkResult = await this.#timeBoxSdkInit();
    if (!sdkResult.ok) {
      this.capabilities = this.#fallbackCapabilities(sdkResult.error.code);
      this.#diagnostic('yandex_init_fallback', { code: sdkResult.error.code });
      return ok(this.capabilities);
    }

    this.sdk = sdkResult.value;
    if (!this.#hasRequiredSdkLifecycle(this.sdk)) {
      this.sdk = null;
      this.capabilities = this.#fallbackCapabilities('sdk-error');
      this.#diagnostic('yandex_init_fallback', { code: 'sdk-error', reason: 'required_lifecycle_api_missing' });
      return ok(this.capabilities);
    }
    this.#attachSdkEvents();
    const rewardedAds = typeof this.sdk.adv?.showRewardedVideo === 'function';
    this.capabilities = Object.freeze({
      platform: 'yandex',
      localSave: this.web.capabilities.localSave,
      cloudSave: typeof this.sdk.getPlayer === 'function',
      leaderboard: this.sdk.leaderboards ? 'remote' : 'local-only',
      rewardedProvider: rewardedAds ? 'yandex' : 'unavailable',
      rewardedAds,
      interstitialAds: false,
      gameplayLifecycle: true,
    });

    if (!this.web.getPauseSnapshot().paused) this.#markGameplay(true);
    return ok(this.capabilities);
  }

  async markReady() {
    await this.init();
    if (this.readySent) return ok(undefined);
    this.readySent = true;
    if (!this.sdk) return ok(undefined);
    try {
      await this.sdk.features.LoadingAPI?.ready();
      return ok(undefined);
    } catch (error) {
      this.#diagnostic('loading_ready_failed', { message: errorMessage(error) });
      return fail('sdk-error', 'LoadingAPI.ready() failed.', true);
    }
  }

  async loadData() {
    const localResult = await this.web.loadData();
    if (!localResult.ok) return localResult;
    const local = localResult.value;
    const player = await this.#authorizedPlayer();
    if (!player) return localResult;

    try {
      const cloudObject = await player.getData([this.cloudSaveKey]);
      const cloudRaw = cloudObject[this.cloudSaveKey];
      if (cloudRaw === undefined || cloudRaw === null) return localResult;
      const cloudResult = parseInfernoSave(cloudRaw);
      if (!cloudResult.ok) {
        this.#diagnostic('cloud_save_rejected', { message: cloudResult.error.message });
        return localResult;
      }
      const merged = local ? mergeInfernoSaves(local, cloudResult.value) : cloudResult.value;
      const persisted = await this.web.saveData(merged);
      if (!persisted.ok) {
        this.#diagnostic('local_cache_write_failed', { code: persisted.error.code });
      }
      return ok(merged);
    } catch (error) {
      this.#diagnostic('cloud_read_failed', { message: errorMessage(error) });
      return localResult;
    }
  }

  /** @param {import('../types/save.js').InfernoSaveV1} data */
  async saveData(data) {
    const parsed = parseInfernoSave(data);
    if (!parsed.ok) return parsed;
    const before = await this.web.loadData();
    if (!before.ok) return before;
    const previousBest = before.value?.bestScore ?? 0;
    if (parsed.value.bestScore > previousBest) {
      this.pendingBestScore = Math.max(this.pendingBestScore ?? 0, parsed.value.bestScore);
    }
    const localResult = await this.web.saveData(parsed.value);
    const player = await this.#authorizedPlayer();
    if (!player) return localResult;
    try {
      await player.setData({ [this.cloudSaveKey]: parsed.value }, false);
      return ok(undefined);
    } catch (error) {
      this.#diagnostic('cloud_write_failed', { message: errorMessage(error) });
      return fail('cloud-error', 'Local save succeeded, but cloud save failed.', true);
    }
  }

  /** @param {number} score */
  async submitScore(score) {
    if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
      return fail('invalid-data', `Best Score must be an integer from 0 to ${MAX_SCORE}.`);
    }

    const loaded = await this.web.loadData();
    if (!loaded.ok) return loaded;
    const localBest = loaded.value?.bestScore ?? 0;
    if (score < localBest || score <= this.highestSubmittedScore) return ok(undefined);
    if (score > localBest) {
      const localScoreResult = await this.web.submitScore(score);
      if (!localScoreResult.ok) return localScoreResult;
      this.pendingBestScore = Math.max(this.pendingBestScore ?? 0, score);
    }
    if (score === localBest && this.pendingBestScore !== score) return ok(undefined);

    if (this.pendingScore) {
      return score <= this.pendingScore.score
        ? this.pendingScore.promise
        : fail('busy', 'A leaderboard submission is already pending.', true);
    }
    if (!this.sdk?.leaderboards) return fail('unavailable', 'Yandex leaderboard is unavailable.');

    const player = await this.#authorizedPlayer();
    if (!player) return fail('unauthorized', 'Leaderboard submission requires an authorized player.');
    const available = await this.#methodAvailable('leaderboards.setScore');
    if (!available) return fail('unavailable', 'leaderboards.setScore is unavailable.');
    if (this.pendingScore) {
      return score <= this.pendingScore.score
        ? this.pendingScore.promise
        : fail('busy', 'A leaderboard submission is already pending.', true);
    }

    const now = this.now();
    if (now - this.lastScoreAttemptAt < 1_000) {
      return fail('rate-limited', 'Leaderboard submissions are limited to one request per second.', true);
    }
    this.lastScoreAttemptAt = now;

    const promise = this.sdk.leaderboards.setScore(this.leaderboardName, score)
      .then(() => {
        this.highestSubmittedScore = Math.max(this.highestSubmittedScore, score);
        if (this.pendingBestScore === score) this.pendingBestScore = null;
        return ok(undefined);
      })
      .catch((error) => {
        this.#diagnostic('leaderboard_submit_failed', { message: errorMessage(error) });
        return fail('sdk-error', 'Unable to submit Best Score.', true);
      })
      .finally(() => {
        this.pendingScore = null;
      });
    this.pendingScore = { score, promise };
    return promise;
  }

  async getLeaderboard() {
    if (!this.sdk?.leaderboards) return this.web.getLeaderboard();
    const available = await this.#methodAvailable('leaderboards.getEntries');
    if (!available) return fail('unavailable', 'leaderboards.getEntries is unavailable.');
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;
    try {
      const request = this.sdk.leaderboards.getEntries(this.leaderboardName, {
        includeUser: true,
        quantityAround: 3,
        quantityTop: 10,
      });
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), this.requestTimeoutMs);
      });
      const result = await Promise.race([request, timeout]);
      if (result === null) return fail('timeout', 'Leaderboard request timed out.', true);
      return ok(result.entries.map((entry) => ({
        rank: entry.rank,
        score: entry.score,
        displayName: entry.player?.publicName || 'Игрок',
        isCurrentPlayer: false,
        source: 'yandex',
      })));
    } catch (error) {
      this.#diagnostic('leaderboard_read_failed', { message: errorMessage(error) });
      return fail('sdk-error', 'Unable to load the leaderboard.', true);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }

  /** @param {'inferno-seal'} placement */
  async showRewardedAd(placement) {
    const requestId = this.#requestId('rewarded');
    if (placement !== 'inferno-seal' || !this.sdk?.adv?.showRewardedVideo) {
      return this.#rewardUnavailable(requestId, 'Rewarded ads are unavailable.');
    }
    if (this.pendingReward) return this.#rewardUnavailable(requestId, 'Another rewarded request is pending.', 'busy');

    this.pendingReward = { requestId };
    this.web.systemPause('ad');

    return new Promise((resolve) => {
      let settled = false;
      let rewarded = false;
      let wasShown = false;
      const timeout = setTimeout(() => finish({
        status: 'error',
        requestId,
        error: { code: 'timeout', message: 'Rewarded ad timed out.', retryable: true },
      }), this.adTimeoutMs);

      /** @param {import('../types/platform.js').RewardedResult} result */
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (this.pendingReward?.requestId === requestId) this.pendingReward = null;
        this.web.systemResume('ad');
        resolve(result);
      };

      try {
        this.sdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => { wasShown = true; },
            onRewarded: () => { rewarded = true; },
            onClose: (sdkWasShown) => finish({
              status: rewarded ? 'rewarded' : 'closed',
              requestId,
              wasShown: sdkWasShown ?? wasShown,
            }),
            onError: (error) => finish({
              status: 'error',
              requestId,
              wasShown,
              error: { code: 'sdk-error', message: errorMessage(error), retryable: true },
            }),
          },
        });
      } catch (error) {
        finish({
          status: 'error',
          requestId,
          error: { code: 'sdk-error', message: errorMessage(error), retryable: true },
        });
      }
    });
  }

  /** @param {string} _placement */
  async showInterstitial(_placement) {
    return {
      status: 'unavailable',
      requestId: this.#requestId('interstitial'),
      error: { code: 'unavailable', message: 'Interstitial ads are disabled for this MVP.', retryable: false },
    };
  }

  /** @param {string} [reason] */
  pauseGame(reason = 'menu') {
    return this.web.pauseGame(reason);
  }

  /** @param {string} [reason] */
  resumeGame(reason = 'menu') {
    return this.web.resumeGame(reason);
  }

  /** @param {(snapshot:import('../types/platform.js').PauseSnapshot)=>void} listener */
  subscribePauseChanges(listener) {
    return this.web.subscribePauseChanges(listener);
  }

  getPauseSnapshot() {
    return this.web.getPauseSnapshot();
  }

  dispose() {
    this.detachSdkEvents?.();
    this.detachSdkEvents = null;
    this.web.dispose();
  }

  async #timeBoxSdkInit() {
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(fail('timeout', 'Yandex SDK initialization timed out.', true)), this.initTimeoutMs);
    });
    const sdk = Promise.resolve()
      .then(this.sdkFactory)
      .then((value) => ok(value))
      .catch((error) => fail('sdk-error', `Yandex SDK initialization failed: ${errorMessage(error)}`, true));
    const result = await Promise.race([sdk, timeout]);
    if (timer !== undefined) clearTimeout(timer);
    return /** @type {import('../types/result.js').Result<import('./sdk.js').YandexSdk>} */ (result);
  }

  #attachSdkEvents() {
    if (!this.sdk?.on || !this.sdk.off || this.detachSdkEvents) return;
    const pause = () => {
      if (!this.web.getPauseSnapshot().paused) this.platformPausedActiveGameplay = true;
      this.suppressMarkup = true;
      this.web.systemPause('platform');
      this.suppressMarkup = false;
    };
    const resume = () => {
      this.suppressMarkup = true;
      this.web.systemResume('platform');
      this.suppressMarkup = false;
      if (this.platformPausedActiveGameplay && this.web.getPauseSnapshot().paused) {
        this.#markGameplay(false);
      }
      this.platformPausedActiveGameplay = false;
    };
    this.sdk.on('game_api_pause', pause);
    this.sdk.on('game_api_resume', resume);
    this.detachSdkEvents = () => {
      this.sdk?.off('game_api_pause', pause);
      this.sdk?.off('game_api_resume', resume);
    };
  }

  /** @param {boolean} active */
  #markGameplay(active) {
    if (this.suppressMarkup) return;
    try {
      if (active) this.sdk?.features?.GameplayAPI?.start();
      else this.sdk?.features?.GameplayAPI?.stop();
    } catch (error) {
      this.#diagnostic('gameplay_markup_failed', { message: errorMessage(error) });
    }
  }

  async #authorizedPlayer() {
    if (!this.playerPromise) {
      this.playerPromise = this.sdk?.getPlayer
        ? this.sdk.getPlayer().catch((error) => {
            this.#diagnostic('player_unavailable', { message: errorMessage(error) });
            return null;
          })
        : Promise.resolve(null);
    }
    this.player = await this.playerPromise;
    try {
      return this.player?.isAuthorized() ? this.player : null;
    } catch (error) {
      this.#diagnostic('player_authorization_failed', { message: errorMessage(error) });
      return null;
    }
  }

  /** @param {string} method */
  async #methodAvailable(method) {
    if (!this.sdk?.isAvailableMethod) return true;
    try {
      return await this.sdk.isAvailableMethod(method);
    } catch (error) {
      this.#diagnostic('method_availability_failed', { method, message: errorMessage(error) });
      return false;
    }
  }

  /** @param {import('./sdk.js').YandexSdk} sdk */
  #hasRequiredSdkLifecycle(sdk) {
    return typeof sdk.features?.LoadingAPI?.ready === 'function'
      && typeof sdk.features?.GameplayAPI?.start === 'function'
      && typeof sdk.features?.GameplayAPI?.stop === 'function'
      && typeof sdk.on === 'function'
      && typeof sdk.off === 'function';
  }

  /** @param {import('../types/result.js').PlatformErrorCode} [reason] */
  #fallbackCapabilities(reason) {
    return Object.freeze({
      platform: 'web',
      localSave: this.web?.capabilities.localSave ?? false,
      cloudSave: false,
      leaderboard: 'local-only',
      rewardedProvider: 'unavailable',
      rewardedAds: false,
      interstitialAds: false,
      gameplayLifecycle: true,
      ...(reason ? { degradedFrom: 'yandex', degradedReason: reason } : {}),
    });
  }

  /** @param {string} prefix */
  #requestId(prefix) {
    this.requestCounter += 1;
    return `${prefix}-${this.requestCounter}`;
  }

  /** @param {string} requestId @param {string} message @param {'unavailable'|'busy'} [code] */
  #rewardUnavailable(requestId, message, code = 'unavailable') {
    return {
      status: 'unavailable',
      requestId,
      error: { code, message, retryable: code === 'busy' },
    };
  }

  /** @param {string} type @param {Record<string,unknown>} detail */
  #diagnostic(type, detail) {
    this.onDiagnostic({ type, detail });
  }
}
