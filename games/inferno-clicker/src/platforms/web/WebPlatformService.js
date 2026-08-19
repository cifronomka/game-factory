// @ts-check

import { attachBrowserLifecycle } from '../shared/browserLifecycle.js';
import { PauseController } from '../shared/PauseController.js';
import { createDefaultSave, MAX_SCORE, parseInfernoSave } from '../types/save.js';
import { fail, ok } from '../types/result.js';

export const DEFAULT_STORAGE_KEY = 'inferno-clicker:save:v1';

/** @typedef {{getItem:(key:string)=>string|null, setItem:(key:string,value:string)=>void, removeItem:(key:string)=>void}} StorageLike */
/** @typedef {{type:string, detail?:Record<string, unknown>}} PlatformDiagnostic */

/** @returns {StorageLike|null} */
function defaultStorage() {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

export class WebPlatformService {
  /**
   * @param {object} [options]
   * @param {StorageLike|null} [options.storage]
   * @param {string} [options.storageKey]
   * @param {()=>number} [options.now]
   * @param {'test'|'unavailable'} [options.rewardedProvider] Explicit review/test provider by default; set to `unavailable` to disable rewards.
   * @param {(diagnostic:PlatformDiagnostic)=>void} [options.onDiagnostic]
   * @param {(active:boolean)=>void} [options.onGameplayActiveChange]
   * @param {import('../shared/browserLifecycle.js').VisibilitySource|null} [options.documentTarget]
   * @param {import('../shared/browserLifecycle.js').EventSource|null} [options.windowTarget]
   */
  constructor(options = {}) {
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.now = options.now ?? Date.now;
    this.rewardedProvider = options.rewardedProvider ?? 'test';
    if (this.rewardedProvider !== 'test' && this.rewardedProvider !== 'unavailable') {
      throw new TypeError('Web rewardedProvider must be "test" or "unavailable".');
    }
    this.onDiagnostic = options.onDiagnostic ?? (() => {});
    this.pauseController = new PauseController(options.onGameplayActiveChange);
    this.lifecycleOptions = {
      documentTarget: options.documentTarget,
      windowTarget: options.windowTarget,
    };
    /** @type {null|(()=>void)} */
    this.detachLifecycle = null;
    this.requestCounter = 0;
    /** @type {Promise<import('../types/platform.js').RewardedResult>|null} */
    this.pendingTestReward = null;
    /** @type {import('../types/platform.js').PlatformCapabilities} */
    this.capabilities = Object.freeze({
      platform: 'web',
      localSave: this.storage !== null,
      cloudSave: false,
      leaderboard: 'local-only',
      rewardedProvider: this.rewardedProvider,
      rewardedAds: this.rewardedProvider === 'test',
      interstitialAds: false,
      gameplayLifecycle: true,
    });
  }

  async init() {
    if (!this.detachLifecycle) {
      this.detachLifecycle = attachBrowserLifecycle(this, this.lifecycleOptions);
    }
    return ok(this.capabilities);
  }

  async markReady() {
    return ok(undefined);
  }

  async loadData() {
    if (!this.storage) return ok(null);
    /** @type {string|null} */
    let encoded;
    try {
      encoded = this.storage.getItem(this.storageKey);
    } catch (error) {
      this.#diagnostic('storage_read_failed', error);
      return ok(null);
    }
    if (encoded === null) return ok(null);

    try {
      const parsed = parseInfernoSave(JSON.parse(encoded));
      if (parsed.ok) return parsed;
      this.#recoverCorrupt(encoded, parsed.error.message);
    } catch (error) {
      this.#recoverCorrupt(encoded, error instanceof Error ? error.message : String(error));
    }
    return ok(createDefaultSave(this.now()));
  }

  /** @param {import('../types/save.js').InfernoSaveV1} data */
  async saveData(data) {
    const parsed = parseInfernoSave(data);
    if (!parsed.ok) return parsed;
    if (!this.storage) return fail('storage-error', 'Persistent storage is unavailable.', true);
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(parsed.value));
      return ok(undefined);
    } catch (error) {
      this.#diagnostic('storage_write_failed', error);
      return fail('storage-error', 'Unable to write the local save.', true);
    }
  }

  /** @param {number} score */
  async submitScore(score) {
    if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
      return fail('invalid-data', `Best Score must be an integer from 0 to ${MAX_SCORE}.`);
    }
    const loaded = await this.loadData();
    if (!loaded.ok) return loaded;
    const save = loaded.value ?? createDefaultSave(this.now());
    if (score <= save.bestScore) return ok(undefined);
    return this.saveData({ ...save, bestScore: score, updatedAt: Math.max(save.updatedAt, this.now()) });
  }

  async getLeaderboard() {
    const loaded = await this.loadData();
    if (!loaded.ok) return loaded;
    if (!loaded.value) return ok([]);
    return ok([{
      rank: 1,
      score: loaded.value.bestScore,
      displayName: 'Local Best',
      isCurrentPlayer: true,
      source: 'local',
    }]);
  }

  /** @param {'inferno-seal'} placement */
  showRewardedAd(placement) {
    if (this.rewardedProvider === 'unavailable' || placement !== 'inferno-seal') {
      return Promise.resolve({
        status: /** @type {'unavailable'} */ ('unavailable'),
        requestId: this.#requestId('rewarded'),
        error: { code: /** @type {'unavailable'} */ ('unavailable'), message: 'Rewarded provider is unavailable in Web fallback.', retryable: false },
      });
    }

    // The review provider has no ad UI. Concurrent duplicate calls share one
    // asynchronous request/result so one user action cannot create two rewards.
    if (this.pendingTestReward) return this.pendingTestReward;
    const requestId = this.#requestId('test-rewarded');
    const request = Promise.resolve().then(() => ({
      status: /** @type {'rewarded'} */ ('rewarded'),
      requestId,
      wasShown: false,
    })).finally(() => {
      if (this.pendingTestReward === request) this.pendingTestReward = null;
    });
    this.pendingTestReward = request;
    return request;
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
    this.pauseController.pause(reason);
    return ok(undefined);
  }

  /** @param {string} [reason] */
  resumeGame(reason = 'menu') {
    this.pauseController.requestResume(reason);
    return ok(undefined);
  }

  /** @param {string} reason */
  systemPause(reason) {
    this.pauseController.pause(reason);
  }

  /** @param {string} reason */
  systemResume(reason) {
    this.pauseController.systemResume(reason);
  }

  stopGameplay() {
    this.pauseController.stopGameplay();
  }

  /** @param {(snapshot:import('../types/platform.js').PauseSnapshot)=>void} listener */
  subscribePauseChanges(listener) {
    return this.pauseController.subscribe(listener);
  }

  getPauseSnapshot() {
    return this.pauseController.snapshot();
  }

  dispose() {
    this.detachLifecycle?.();
    this.detachLifecycle = null;
  }

  /** @param {string} prefix */
  #requestId(prefix) {
    this.requestCounter += 1;
    return `${prefix}-${this.requestCounter}`;
  }

  /** @param {string} encoded @param {string} reason */
  #recoverCorrupt(encoded, reason) {
    this.onDiagnostic({ type: 'save_recovered', detail: { reason } });
    if (!this.storage) return;
    try {
      this.storage.setItem(`${this.storageKey}:corrupt:${this.now()}`, encoded);
      this.storage.removeItem(this.storageKey);
    } catch (error) {
      this.#diagnostic('save_quarantine_failed', error);
    }
  }

  /** @param {string} type @param {unknown} error */
  #diagnostic(type, error) {
    this.onDiagnostic({
      type,
      detail: { message: error instanceof Error ? error.message : String(error) },
    });
  }
}
