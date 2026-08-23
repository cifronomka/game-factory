// @ts-check

import { MAX_SCORE, createDefaultSave, mergeInfernoSaves, parseInfernoSave } from '../types/save.js';
import { REWARDED_PLACEMENT, mapPlatformLocale } from '../types/platform.js';
import { errorMessage, fail, ok } from '../types/result.js';
import { WebPlatformService } from '../web/WebPlatformService.js';
import { createGlobalYandexSdkFactory } from './sdk.js';

export const DEFAULT_LEADERBOARD_NAME = 'best-score';
export const DEFAULT_CLOUD_SAVE_KEY = 'infernoSaveV1';
export const DEFAULT_CLOUD_WRITE_INTERVAL_MS = 5_000;
export const LEADERBOARD_READ_LIMIT = 20;
export const LEADERBOARD_READ_WINDOW_MS = 5 * 60_000;
export const LEADERBOARD_CACHE_MS = 15_000;

export class YandexPlatformService {
  /**
   * @param {object} [options]
   * @param {() => Promise<import('./sdk.js').YandexSdk>} [options.sdkFactory]
   * @param {number} [options.initTimeoutMs]
   * @param {number} [options.adTimeoutMs]
   * @param {number} [options.requestTimeoutMs]
   * @param {number} [options.cloudWriteIntervalMs]
   * @param {number} [options.bootstrapDeadlineAt]
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
    this.cloudWriteIntervalMs = options.cloudWriteIntervalMs ?? DEFAULT_CLOUD_WRITE_INTERVAL_MS;
    if (!Number.isFinite(this.cloudWriteIntervalMs) || this.cloudWriteIntervalMs < 0) {
      throw new TypeError('cloudWriteIntervalMs must be a non-negative finite number.');
    }
    this.leaderboardName = options.leaderboardName ?? DEFAULT_LEADERBOARD_NAME;
    this.cloudSaveKey = options.cloudSaveKey ?? DEFAULT_CLOUD_SAVE_KEY;
    this.now = options.now ?? Date.now;
    this.bootstrapDeadlineAt = Number.isFinite(options.bootstrapDeadlineAt)
      ? Number(options.bootstrapDeadlineAt)
      : Number.POSITIVE_INFINITY;
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
    /** @type {number[]} */
    this.leaderboardReadTimestamps = [];
    /** @type {{at:number,entries:import('../types/platform.js').LeaderboardEntry[]}|null} */
    this.leaderboardCache = null;
    /** @type {null|{score:number,promise:Promise<import('../types/result.js').Result<void>>}} */
    this.pendingScore = null;
    /** @type {null|{score:number,promise:Promise<{status:'ok'}|{status:'error',error:unknown}>}} */
    this.leaderboardSdkOperation = null;
    /** @type {Promise<import('../types/result.js').Result<void>>|null} */
    this.leaderboardDrainPromise = null;
    /** @type {null|{requestId:string}} */
    this.pendingReward = null;
    /** @type {import('../types/save.js').InfernoSaveV1|null} */
    this.pendingCloudSave = null;
    /** @type {import('../types/save.js').InfernoSaveV1|null} */
    this.lastCloudWrittenSave = null;
    this.lastCloudWriteFlushed = true;
    /** @type {Promise<import('../types/result.js').Result<void>>|null} */
    this.cloudWriteInFlight = null;
    /** @type {Promise<{status:'ok'}|{status:'error',error:unknown}>|null} */
    this.cloudSdkOperation = null;
    /** @type {Promise<import('../types/result.js').Result<void>>|null} */
    this.cloudFlushPromise = null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this.cloudWriteTimer = null;
    this.cloudFlushInProgress = false;
    this.cloudSyncDisabled = false;
    /** @type {Promise<import('../types/result.js').Result<void>>} */
    this.saveWriteTail = Promise.resolve(ok(undefined));
    this.lastCloudWriteAt = Number.NEGATIVE_INFINITY;
    /** @type {null|(()=>void)} */
    this.detachSdkEvents = null;

    this.web = new WebPlatformService({
      storage: options.storage,
      now: this.now,
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
    if (!this.#attachSdkEvents()) {
      this.sdk = null;
      this.capabilities = this.#fallbackCapabilities('sdk-error');
      this.#diagnostic('yandex_init_fallback', { code: 'sdk-error', reason: 'lifecycle_subscription_failed' });
      return ok(this.capabilities);
    }
    const probeTimeoutMs = this.#bootstrapTimeout(this.requestTimeoutMs);
    const [player, leaderboardRead, writeMethodAvailable] = await Promise.all([
      this.#getPlayer(probeTimeoutMs),
      typeof this.sdk.leaderboards?.getEntries === 'function'
        ? this.#methodAvailable('leaderboards.getEntries', probeTimeoutMs)
        : false,
      typeof this.sdk.leaderboards?.setScore === 'function'
        ? this.#methodAvailable('leaderboards.setScore', probeTimeoutMs)
        : false,
    ]);
    const authorized = this.#isAuthorizedPlayer(player);
    const leaderboardWrite = Boolean(authorized && writeMethodAvailable);
    const rewardedAds = typeof this.sdk.adv?.showRewardedVideo === 'function';
    this.capabilities = Object.freeze({
      platform: 'yandex',
      locale: mapPlatformLocale(this.sdk.environment?.i18n?.lang),
      authorized,
      localSave: this.web.capabilities.localSave,
      cloudSave: Boolean(authorized
        && typeof player?.getData === 'function'
        && typeof player?.setData === 'function'),
      leaderboard: leaderboardRead || leaderboardWrite ? 'remote' : 'local-only',
      leaderboardRead,
      leaderboardWrite,
      rewardedProvider: rewardedAds ? 'yandex' : 'unavailable',
      rewardedAds,
      interstitialAds: false,
      gameplayLifecycle: true,
    });

    return ok(this.capabilities);
  }

  async markReady() {
    await this.init();
    if (this.readySent) return ok(undefined);
    this.readySent = true;
    if (!this.sdk) return ok(undefined);
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;
    try {
      const operation = Promise.resolve()
        .then(() => this.sdk.features.LoadingAPI?.ready())
        .then(
          () => ({ status: /** @type {'ok'} */ ('ok') }),
          (error) => ({ status: /** @type {'error'} */ ('error'), error }),
        );
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ status: 'timeout' }), this.requestTimeoutMs);
      });
      const outcome = /** @type {{status:'ok'}|{status:'error',error:unknown}|{status:'timeout'}} */ (
        await Promise.race([operation, timeout])
      );
      if (outcome.status === 'timeout') {
        this.#diagnostic('loading_ready_failed', { message: 'LoadingAPI.ready() timed out.' });
        return fail('timeout', 'LoadingAPI.ready() timed out.', true);
      }
      if (outcome.status === 'error') throw outcome.error;
      return ok(undefined);
    } catch (error) {
      this.#diagnostic('loading_ready_failed', { message: errorMessage(error) });
      return fail('sdk-error', 'LoadingAPI.ready() failed.', true);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }

  async loadData() {
    try {
      return await this.#loadInitialData();
    } finally {
      // The absolute deadline applies only to the remote bootstrap. Later
      // voluntary SDK calls retain their normal per-request timeout.
      this.bootstrapDeadlineAt = Number.POSITIVE_INFINITY;
    }
  }

  async #loadInitialData() {
    const localResult = await this.web.loadData();
    if (!localResult.ok) return localResult;
    const local = localResult.value;
    const player = await this.#authorizedPlayer();
    if (!player) return localResult;

    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;
    try {
      const operation = Promise.resolve()
        .then(() => player.getData([this.cloudSaveKey]))
        .then(
          (value) => ({ status: /** @type {'ok'} */ ('ok'), value }),
          (error) => ({ status: /** @type {'error'} */ ('error'), error }),
        );
      const timeoutMs = this.#bootstrapTimeout(this.requestTimeoutMs);
      if (timeoutMs <= 0) {
        this.#diagnostic('cloud_read_failed', { message: 'Remote bootstrap deadline elapsed; local save retained.' });
        this.#backfillLeaderboardInBackground(local, 'bootstrap_deadline');
        return localResult;
      }
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs);
      });
      const outcome = /** @type {{status:'ok',value:Record<string,unknown>}|{status:'error',error:unknown}|{status:'timeout'}} */ (
        await Promise.race([operation, timeout])
      );
      if (outcome.status === 'timeout') {
        this.#diagnostic('cloud_read_failed', { message: 'Yandex cloud read timed out; local save retained.' });
        this.#backfillLeaderboardInBackground(local, 'cloud_read_timeout');
        return localResult;
      }
      if (outcome.status === 'error') throw outcome.error;
      const cloudObject = outcome.value;
      const cloudRaw = cloudObject[this.cloudSaveKey];
      if (cloudRaw === undefined || cloudRaw === null) {
        if (local) this.#queueCloudSaveInBackground(local, 'cloud_seed_from_local');
        this.#backfillLeaderboardInBackground(local, 'local_save');
        return localResult;
      }
      const cloudResult = parseInfernoSave(cloudRaw);
      if (!cloudResult.ok) {
        this.#diagnostic('cloud_save_rejected', { message: cloudResult.error.message });
        this.#backfillLeaderboardInBackground(local, 'cloud_save_rejected');
        return localResult;
      }
      // Bind subsequent latest-wins merges to the durable cloud baseline even
      // when localStorage is blocked and no new setData call has happened yet.
      this.lastCloudWrittenSave = cloudResult.value;
      this.lastCloudWriteFlushed = true;
      const merged = local ? mergeInfernoSaves(local, cloudResult.value) : cloudResult.value;
      const persisted = await this.web.saveData(merged);
      if (!persisted.ok) {
        this.#diagnostic('local_cache_write_failed', { code: persisted.error.code });
      }
      if (JSON.stringify(merged) !== JSON.stringify(cloudResult.value)) {
        this.#queueCloudSaveInBackground(merged, 'cloud_merge_writeback');
      }
      this.#backfillLeaderboardInBackground(merged, 'merged_save');
      return ok(merged);
    } catch (error) {
      this.#diagnostic('cloud_read_failed', { message: errorMessage(error) });
      this.#backfillLeaderboardInBackground(local, 'cloud_read_failed');
      return localResult;
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }

  /** @param {import('../types/save.js').InfernoSaveV1} data */
  saveData(data) {
    const parsed = parseInfernoSave(data);
    if (!parsed.ok) return Promise.resolve(parsed);
    const operation = this.saveWriteTail.then(() => this.#saveParsedData(parsed.value));
    this.saveWriteTail = operation;
    return operation;
  }

  /** @param {import('../types/save.js').InfernoSaveV1} parsedSave */
  async #saveParsedData(parsedSave) {
    const before = await this.web.loadData();
    if (!before.ok) return before;
    let nextSave = parsedSave;
    for (const knownSave of [before.value, this.lastCloudWrittenSave, this.pendingCloudSave]) {
      if (knownSave) nextSave = mergeInfernoSaves(knownSave, nextSave);
    }
    const previousBest = before.value?.bestScore ?? 0;
    if (nextSave.bestScore > previousBest) {
      this.pendingBestScore = Math.max(this.pendingBestScore ?? 0, nextSave.bestScore);
    }
    const localResult = await this.web.saveData(nextSave);
    const cloudAvailable = Boolean(this.capabilities.cloudSave
      && !this.cloudSyncDisabled
      && this.player
      && this.#isAuthorizedPlayer(this.player));
    if (this.capabilities.cloudSave && !cloudAvailable) this.#disableCloudSync('authorization_lost');

    // If localStorage itself is unavailable, cloud is the only durability
    // path and each rate-limited flush becomes the acknowledgement boundary.
    if (!localResult.ok) {
      if (!cloudAvailable) return localResult;
      this.pendingCloudSave = this.pendingCloudSave
        ? mergeInfernoSaves(this.pendingCloudSave, nextSave)
        : nextSave;
      return this.flushData();
    }

    // Local persistence is the acknowledgement boundary. Cloud sync is a
    // separately throttled, latest-wins queue and must never hold a newer
    // local record behind a slow or stalled SDK request. Explicit flushData()
    // still awaits the remote queue on run end and background transitions.
    if (cloudAvailable) {
      this.#queueCloudSaveInBackground(nextSave, 'local_save');
    }
    return localResult;
  }

  async flushData() {
    while (true) {
      if (!this.cloudFlushPromise) {
        this.cloudFlushInProgress = true;
        this.#clearCloudWriteTimer();
        const promise = this.#flushCloudQueue().finally(() => {
          this.cloudFlushInProgress = false;
          if (this.cloudFlushPromise === promise) this.cloudFlushPromise = null;
          if (this.pendingCloudSave) this.#scheduleCloudWrite();
        });
        this.cloudFlushPromise = promise;
      }
      const result = await this.cloudFlushPromise;
      if (!result.ok) return result;
      if (!this.pendingCloudSave && (!this.lastCloudWrittenSave || this.lastCloudWriteFlushed)) return result;
      // A newer save may have entered during the final microtask of the prior
      // flush. Loop until that exact latest value has reached setData(..., true).
    }
  }

  /** @param {number} score */
  async submitScore(score) {
    if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
      return fail('invalid-data', `Best Score must be an integer from 0 to ${MAX_SCORE}.`);
    }

    // Register the candidate before the first await. A newer submit that
    // arrives while an older SDK call is settling can therefore be observed
    // by the same drain instead of falling into the promise-finalization gap.
    this.pendingBestScore = Math.max(this.pendingBestScore ?? 0, score);

    const loaded = await this.web.loadData();
    if (!loaded.ok) return loaded;
    const localBest = loaded.value?.bestScore ?? 0;
    if (score > localBest) {
      const localScoreResult = await this.web.submitScore(score);
      if (!localScoreResult.ok) return localScoreResult;
    }
    const candidate = Math.max(score, localBest);
    this.pendingBestScore = Math.max(this.pendingBestScore ?? 0, candidate);
    if (this.pendingBestScore <= this.highestSubmittedScore) {
      this.pendingBestScore = null;
      return ok(undefined);
    }
    while (this.pendingBestScore !== null && this.pendingBestScore > this.highestSubmittedScore) {
      const result = await this.#ensureLeaderboardDrain();
      if (!result.ok) return result;
    }
    return ok(undefined);
  }

  #ensureLeaderboardDrain() {
    if (!this.leaderboardDrainPromise) {
      const drain = this.#drainLeaderboardQueue();
      const tracked = drain.finally(() => {
        if (this.leaderboardDrainPromise === tracked) this.leaderboardDrainPromise = null;
      });
      this.leaderboardDrainPromise = tracked;
    }
    return this.leaderboardDrainPromise;
  }

  /** @param {string} reason */
  #resumeLeaderboardDrainInBackground(reason) {
    void Promise.resolve().then(async () => {
      if (this.leaderboardDrainPromise) await this.leaderboardDrainPromise;
      if (this.leaderboardSdkOperation
        || this.pendingBestScore === null
        || this.pendingBestScore <= this.highestSubmittedScore) return;
      const result = await this.#ensureLeaderboardDrain();
      if (!result.ok) this.#diagnostic('leaderboard_backfill_deferred', { reason, code: result.error.code });
    });
  }

  async #drainLeaderboardQueue() {
    const player = await this.#authorizedPlayer();
    if (!player) {
      this.#diagnostic('leaderboard_submit_skipped', { reason: 'guest' });
      this.pendingBestScore = null;
      return ok(undefined);
    }
    if (typeof this.sdk?.leaderboards?.setScore !== 'function') return fail('unavailable', 'Yandex leaderboard is unavailable.');
    const available = await this.#methodAvailable('leaderboards.setScore');
    if (!available) return fail('unavailable', 'leaderboards.setScore is unavailable.');
    if (this.leaderboardSdkOperation) {
      return fail('busy', 'A timed-out leaderboard request is still pending.', true);
    }

    while (this.pendingBestScore !== null && this.pendingBestScore > this.highestSubmittedScore) {
      const waitMs = Math.max(0, 1_000 - (this.now() - this.lastScoreAttemptAt));
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      const target = this.pendingBestScore;
      this.lastScoreAttemptAt = Math.max(this.now(), this.lastScoreAttemptAt + 1_000);
      const promise = this.#submitLeaderboardTarget(target);
      this.pendingScore = { score: target, promise };
      const result = await promise;
      this.pendingScore = null;
      if (!result.ok) return result;
      if (this.pendingBestScore !== null && this.pendingBestScore <= this.highestSubmittedScore) this.pendingBestScore = null;
    }
    return ok(undefined);
  }

  /** @param {number} score */
  async #submitLeaderboardTarget(score) {
      /** @type {ReturnType<typeof setTimeout>|undefined} */
      let timer;
      const operation = Promise.resolve()
        .then(() => this.sdk.leaderboards.setScore(this.leaderboardName, score))
        .then(
          () => ({ status: /** @type {'ok'} */ ('ok') }),
          (error) => ({ status: /** @type {'error'} */ ('error'), error }),
        );
      this.leaderboardSdkOperation = { score, promise: operation };
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ status: 'timeout' }), this.requestTimeoutMs);
      });
      try {
        const outcome = /** @type {{status:'ok'}|{status:'error',error:unknown}|{status:'timeout'}} */ (await Promise.race([operation, timeout]));
        if (outcome.status === 'timeout') {
          this.#diagnostic('leaderboard_submit_failed', { message: 'leaderboards.setScore timed out.' });
          void operation.then((lateOutcome) => {
            if (this.leaderboardSdkOperation?.promise === operation) this.leaderboardSdkOperation = null;
            if (lateOutcome.status === 'ok') {
              this.highestSubmittedScore = Math.max(this.highestSubmittedScore, score);
              if (this.pendingBestScore !== null && this.pendingBestScore <= this.highestSubmittedScore) {
                this.pendingBestScore = null;
              }
            } else {
              this.#diagnostic('leaderboard_submit_late_failure', { message: errorMessage(lateOutcome.error) });
            }
            this.#resumeLeaderboardDrainInBackground('late_sdk_settlement');
          });
          return fail('timeout', 'Best Score submission timed out.', true);
        }
        if (this.leaderboardSdkOperation?.promise === operation) this.leaderboardSdkOperation = null;
        if (outcome.status === 'error') throw outcome.error;
        this.highestSubmittedScore = Math.max(this.highestSubmittedScore, score);
        return ok(undefined);
      } catch (error) {
        this.#diagnostic('leaderboard_submit_failed', { message: errorMessage(error) });
        return fail('sdk-error', 'Unable to submit Best Score.', true);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
  }

  async getLeaderboard() {
    if (typeof this.sdk?.leaderboards?.getEntries !== 'function') return this.web.getLeaderboard();
    const now = this.now();
    if (this.leaderboardCache && now - this.leaderboardCache.at < LEADERBOARD_CACHE_MS) {
      return ok(this.leaderboardCache.entries);
    }
    if (!await this.#methodAvailable('leaderboards.getEntries')) return this.web.getLeaderboard();
    this.leaderboardReadTimestamps = this.leaderboardReadTimestamps.filter((at) => now - at < LEADERBOARD_READ_WINDOW_MS);
    if (this.leaderboardReadTimestamps.length >= LEADERBOARD_READ_LIMIT) {
      this.#diagnostic('leaderboard_read_rate_limited', { limit: LEADERBOARD_READ_LIMIT, windowMs: LEADERBOARD_READ_WINDOW_MS });
      return this.leaderboardCache ? ok(this.leaderboardCache.entries) : this.web.getLeaderboard();
    }
    this.leaderboardReadTimestamps.push(now);
    const authorized = this.#isAuthorizedPlayer(await this.#getPlayer());
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;
    try {
      const request = this.sdk.leaderboards.getEntries(this.leaderboardName, authorized
        ? { includeUser: true, quantityAround: 3, quantityTop: 10 }
        : { includeUser: false, quantityTop: 10 });
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), this.requestTimeoutMs);
      });
      const result = await Promise.race([request, timeout]);
      if (result === null) return fail('timeout', 'Leaderboard request timed out.', true);
      const currentPlayerId = authorized ? this.#currentPlayerId() : null;
      const entries = result.entries.map((entry) => ({
        rank: entry.rank,
        score: entry.score,
        displayName: entry.player?.publicName || (this.capabilities.locale === 'ru' ? 'Игрок' : 'Player'),
        isCurrentPlayer: Boolean(currentPlayerId && entry.player?.uniqueID === currentPlayerId),
        source: 'yandex',
      }));
      this.leaderboardCache = { at: now, entries };
      return ok(entries);
    } catch (error) {
      this.#diagnostic('leaderboard_read_failed', { message: errorMessage(error) });
      return fail('sdk-error', 'Unable to load the leaderboard.', true);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }

  /** @param {typeof REWARDED_PLACEMENT} placement @param {import('../types/platform.js').RewardedCallbacks} [callbacks] */
  async showRewardedAd(placement, callbacks = {}) {
    const requestId = this.#requestId('rewarded');
    if (placement !== REWARDED_PLACEMENT || !this.sdk?.adv?.showRewardedVideo) {
      return this.#rewardUnavailable(requestId, 'Rewarded ads are unavailable.');
    }
    if (this.pendingReward) return this.#rewardUnavailable(requestId, 'Another rewarded request is pending.', 'busy');

    this.pendingReward = { requestId };
    this.web.systemPause('ad');

    return new Promise((resolve) => {
      let terminal = false;
      let rewarded = false;
      let wasShown = false;
      const timeout = setTimeout(() => {
        if (rewarded) {
          this.#diagnostic('rewarded_close_timeout', { requestId });
          finish();
          return;
        }
        finish({
          status: 'error',
          requestId,
          error: { code: 'timeout', message: 'Rewarded ad timed out.', retryable: true },
        });
      }, this.adTimeoutMs);

      /** @param {import('../types/platform.js').RewardedResult=} result */
      const finish = (result) => {
        if (terminal) return;
        terminal = true;
        clearTimeout(timeout);
        if (this.pendingReward?.requestId === requestId) this.pendingReward = null;
        this.web.systemResume('ad');
        resolve(rewarded ? { status: 'rewarded', requestId, wasShown: true } : result);
      };

      try {
        this.sdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => { wasShown = true; },
            onRewarded: () => {
              if (terminal || rewarded) return;
              rewarded = true;
              try { callbacks.onRewarded?.(); }
              catch (error) { this.#diagnostic('rewarded_delivery_callback_failed', { requestId, message: errorMessage(error) }); }
            },
            onClose: (sdkWasShown) => finish(rewarded ? undefined : {
              status: 'closed', requestId, wasShown: sdkWasShown ?? wasShown,
            }),
            onError: (error) => {
              if (rewarded) {
                this.#diagnostic('rewarded_terminal_error_after_reward', { requestId, message: errorMessage(error) });
                finish();
                return;
              }
              finish({
                status: 'error',
                requestId,
                wasShown,
                error: { code: 'sdk-error', message: errorMessage(error), retryable: true },
              });
            },
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

  startGameplay() {
    this.web.startGameplay();
  }

  stopGameplay() {
    this.web.stopGameplay();
  }

  /** @param {(snapshot:import('../types/platform.js').PauseSnapshot)=>void} listener */
  subscribePauseChanges(listener) {
    return this.web.subscribePauseChanges(listener);
  }

  getPauseSnapshot() {
    return this.web.getPauseSnapshot();
  }

  async dispose() {
    const flushResult = await this.flushData();
    if (!flushResult.ok) {
      this.#diagnostic('cloud_flush_failed_on_dispose', { code: flushResult.error.code });
    }
    this.#clearCloudWriteTimer();
    this.detachSdkEvents?.();
    this.detachSdkEvents = null;
    this.web.dispose();
  }

  async #timeBoxSdkInit() {
    const timeoutMs = this.#bootstrapTimeout(this.initTimeoutMs);
    if (timeoutMs <= 0) return fail('timeout', 'Yandex SDK bootstrap deadline elapsed.', true);
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(fail('timeout', 'Yandex SDK initialization timed out.', true)), timeoutMs);
    });
    const sdk = Promise.resolve()
      .then(this.sdkFactory)
      .then((value) => ok(value))
      .catch((error) => fail('sdk-error', `Yandex SDK initialization failed: ${errorMessage(error)}`, true));
    const result = await Promise.race([sdk, timeout]);
    if (timer !== undefined) clearTimeout(timer);
    return /** @type {import('../types/result.js').Result<import('./sdk.js').YandexSdk>} */ (result);
  }

  /** @param {number} preferredMs */
  #bootstrapTimeout(preferredMs) {
    return Math.max(0, Math.min(preferredMs, this.bootstrapDeadlineAt - this.now()));
  }

  #attachSdkEvents() {
    if (this.detachSdkEvents) return true;
    if (!this.sdk?.on || !this.sdk.off) return false;
    const pause = () => {
      this.web.systemPause('platform');
    };
    const resume = () => {
      this.web.systemResume('platform');
    };
    try {
      this.sdk.on('game_api_pause', pause);
      this.sdk.on('game_api_resume', resume);
    } catch (error) {
      try { this.sdk.off('game_api_pause', pause); } catch { /* best-effort rollback */ }
      try { this.sdk.off('game_api_resume', resume); } catch { /* best-effort rollback */ }
      this.#diagnostic('lifecycle_subscription_failed', { message: errorMessage(error) });
      return false;
    }
    this.detachSdkEvents = () => {
      try { this.sdk?.off('game_api_pause', pause); }
      catch (error) { this.#diagnostic('lifecycle_unsubscribe_failed', { event: 'game_api_pause', message: errorMessage(error) }); }
      try { this.sdk?.off('game_api_resume', resume); }
      catch (error) { this.#diagnostic('lifecycle_unsubscribe_failed', { event: 'game_api_resume', message: errorMessage(error) }); }
    };
    return true;
  }

  /** @param {boolean} active */
  #markGameplay(active) {
    try {
      if (active) this.sdk?.features?.GameplayAPI?.start();
      else this.sdk?.features?.GameplayAPI?.stop();
    } catch (error) {
      this.#diagnostic('gameplay_markup_failed', { message: errorMessage(error) });
    }
  }

  async #authorizedPlayer() {
    const player = await this.#getPlayer();
    return this.#isAuthorizedPlayer(player) ? player : null;
  }

  /** @param {number} [timeoutMs] */
  async #getPlayer(timeoutMs = this.requestTimeoutMs) {
    if (!this.sdk?.getPlayer) return null;
    if (!this.playerPromise) {
      if (timeoutMs <= 0) {
        this.#diagnostic('player_unavailable', { message: 'Remote bootstrap deadline elapsed before the player request.' });
        this.playerPromise = Promise.resolve(null);
        return null;
      }
      /** @type {ReturnType<typeof setTimeout>|undefined} */
      let timer;
      const request = Promise.resolve().then(() => this.sdk.getPlayer()).catch((error) => {
        this.#diagnostic('player_unavailable', { message: errorMessage(error) });
        return null;
      });
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => {
          this.#diagnostic('player_unavailable', { message: 'Yandex player request timed out.' });
          resolve(null);
        }, timeoutMs);
      });
      this.playerPromise = Promise.race([request, timeout]).finally(() => {
        if (timer !== undefined) clearTimeout(timer);
      });
    }
    this.player = await this.playerPromise;
    return this.player;
  }

  /** @param {import('./sdk.js').YandexPlayer|null} player */
  #isAuthorizedPlayer(player) {
    try {
      return player?.isAuthorized() === true;
    } catch (error) {
      this.#diagnostic('player_authorization_failed', { message: errorMessage(error) });
      return false;
    }
  }

  #currentPlayerId() {
    try {
      return this.player?.getUniqueID?.() ?? null;
    } catch (error) {
      this.#diagnostic('player_id_failed', { message: errorMessage(error) });
      return null;
    }
  }

  /** @param {import('../types/save.js').InfernoSaveV1} save */
  async #queueCloudSave(save) {
    if (this.cloudSyncDisabled) return fail('unauthorized', 'Yandex cloud sync is disabled for this session.');
    this.pendingCloudSave = this.pendingCloudSave
      ? mergeInfernoSaves(this.pendingCloudSave, save)
      : save;

    if (this.cloudFlushInProgress || this.cloudWriteInFlight || this.cloudSdkOperation) return ok(undefined);
    if (this.now() - this.lastCloudWriteAt >= this.cloudWriteIntervalMs) {
      this.#clearCloudWriteTimer();
      return this.#writePendingCloud(false);
    }
    this.#scheduleCloudWrite();
    return ok(undefined);
  }

  /** @param {import('../types/save.js').InfernoSaveV1} save @param {string} reason */
  #queueCloudSaveInBackground(save, reason) {
    void this.#queueCloudSave(save).then((result) => {
      if (!result.ok) this.#diagnostic('cloud_writeback_deferred', { reason, code: result.error.code });
    });
  }

  /** @param {import('../types/save.js').InfernoSaveV1|null} save @param {string} reason */
  #backfillLeaderboardInBackground(save, reason) {
    if (!save || save.bestScore <= 0) return;
    void this.submitScore(save.bestScore).then((result) => {
      if (!result.ok) this.#diagnostic('leaderboard_backfill_deferred', { reason, code: result.error.code });
    });
  }

  /** @param {boolean} flush */
  #writePendingCloud(flush) {
    if (this.cloudWriteInFlight) return this.cloudWriteInFlight;
    if (this.cloudSdkOperation) {
      return Promise.resolve(fail('busy', 'A timed-out cloud request is still pending.', true));
    }
    const save = this.pendingCloudSave;
    if (!save) return Promise.resolve(ok(undefined));
    this.pendingCloudSave = null;

    const promise = this.#performCloudWrite(save, flush).finally(() => {
      if (this.cloudWriteInFlight === promise) this.cloudWriteInFlight = null;
      if (this.pendingCloudSave && !this.cloudFlushInProgress) this.#scheduleCloudWrite();
    });
    this.cloudWriteInFlight = promise;
    return promise;
  }

  /** @param {import('../types/save.js').InfernoSaveV1} save @param {boolean} flush */
  async #performCloudWrite(save, flush) {
    const player = await this.#authorizedPlayer();
    if (!player) {
      this.#disableCloudSync('authorization_lost_during_write');
      return fail('unauthorized', 'Cloud save is unavailable for a guest player.');
    }

    this.lastCloudWriteAt = this.now();
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;
    try {
      const operation = Promise.resolve()
        .then(() => player.setData({ [this.cloudSaveKey]: save }, flush))
        .then(
          () => ({ status: /** @type {'ok'} */ ('ok') }),
          (error) => ({ status: /** @type {'error'} */ ('error'), error }),
        );
      this.cloudSdkOperation = operation;
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ status: 'timeout' }), this.requestTimeoutMs);
      });
      const outcome = /** @type {{status:'ok'}|{status:'error',error:unknown}|{status:'timeout'}} */ (
        await Promise.race([operation, timeout])
      );
      if (outcome.status === 'timeout') {
        this.pendingCloudSave = this.pendingCloudSave
          ? mergeInfernoSaves(save, this.pendingCloudSave)
          : save;
        this.#diagnostic('cloud_write_failed', { message: 'Yandex cloud save timed out.' });
        void operation.then((lateOutcome) => {
          if (this.cloudSdkOperation === operation) this.cloudSdkOperation = null;
          if (lateOutcome.status === 'ok') {
            this.lastCloudWriteAt = this.now();
            this.lastCloudWrittenSave = save;
            this.lastCloudWriteFlushed = flush;
          }
          else this.#diagnostic('cloud_write_late_failure', { message: errorMessage(lateOutcome.error) });
          if (this.pendingCloudSave && !this.cloudFlushInProgress) this.#scheduleCloudWrite();
        });
        return fail('timeout', 'Local save succeeded, but cloud save timed out.', true);
      }
      if (this.cloudSdkOperation === operation) this.cloudSdkOperation = null;
      if (outcome.status === 'error') throw outcome.error;
      this.lastCloudWrittenSave = save;
      this.lastCloudWriteFlushed = flush;
      return ok(undefined);
    } catch (error) {
      this.pendingCloudSave = this.pendingCloudSave
        ? mergeInfernoSaves(save, this.pendingCloudSave)
        : save;
      this.#diagnostic('cloud_write_failed', { message: errorMessage(error) });
      return fail('cloud-error', 'Local save succeeded, but cloud save failed.', true);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  #scheduleCloudWrite() {
    if (this.cloudWriteTimer !== null
      || this.cloudWriteInFlight
      || this.cloudSdkOperation
      || this.cloudFlushInProgress
      || !this.pendingCloudSave) return;
    const elapsed = this.now() - this.lastCloudWriteAt;
    const delay = Math.max(0, this.cloudWriteIntervalMs - elapsed);
    this.cloudWriteTimer = setTimeout(() => {
      this.cloudWriteTimer = null;
      void this.#writePendingCloud(false);
    }, delay);
    this.cloudWriteTimer.unref?.();
  }

  #clearCloudWriteTimer() {
    if (this.cloudWriteTimer !== null) clearTimeout(this.cloudWriteTimer);
    this.cloudWriteTimer = null;
  }

  /** @param {string} reason */
  #disableCloudSync(reason) {
    if (this.cloudSyncDisabled) return;
    this.cloudSyncDisabled = true;
    this.pendingCloudSave = null;
    this.lastCloudWriteFlushed = true;
    this.#clearCloudWriteTimer();
    const leaderboardRead = this.capabilities.leaderboardRead === true;
    this.capabilities = Object.freeze({
      ...this.capabilities,
      authorized: false,
      cloudSave: false,
      leaderboardWrite: false,
      leaderboard: leaderboardRead ? 'remote' : 'local-only',
    });
    this.#diagnostic('cloud_sync_disabled', { reason });
  }

  async #flushCloudQueue() {
    if (this.cloudWriteInFlight) {
      const inFlightResult = await this.cloudWriteInFlight;
      if (!inFlightResult.ok) return inFlightResult;
    }
    if (this.cloudSdkOperation) {
      return fail('timeout', 'A timed-out cloud request is still pending.', true);
    }
    if (!this.pendingCloudSave && this.lastCloudWrittenSave && !this.lastCloudWriteFlushed) {
      this.pendingCloudSave = this.lastCloudWrittenSave;
    }

    while (this.pendingCloudSave) {
      const elapsed = this.now() - this.lastCloudWriteAt;
      const delay = Math.max(0, this.cloudWriteIntervalMs - elapsed);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      this.#clearCloudWriteTimer();
      const result = await this.#writePendingCloud(true);
      if (!result.ok) return result;
    }
    return ok(undefined);
  }

  /** @param {string} method @param {number} [timeoutMs] */
  async #methodAvailable(method, timeoutMs = this.requestTimeoutMs) {
    if (!this.sdk?.isAvailableMethod) {
      this.#diagnostic('method_availability_failed', { method, message: 'isAvailableMethod is unavailable.' });
      return false;
    }
    if (timeoutMs <= 0) {
      this.#diagnostic('method_availability_failed', { method, message: 'Remote bootstrap deadline elapsed.' });
      return false;
    }
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;
    try {
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      });
      const available = await Promise.race([this.sdk.isAvailableMethod(method), timeout]);
      if (available === null) {
        this.#diagnostic('method_availability_failed', { method, message: 'Availability request timed out.' });
        return false;
      }
      return available === true;
    } catch (error) {
      this.#diagnostic('method_availability_failed', { method, message: errorMessage(error) });
      return false;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
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
      locale: this.web?.capabilities.locale ?? 'en',
      authorized: false,
      localSave: this.web?.capabilities.localSave ?? false,
      cloudSave: false,
      leaderboard: 'local-only',
      leaderboardRead: false,
      leaderboardWrite: false,
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
