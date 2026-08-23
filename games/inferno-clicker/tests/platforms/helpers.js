// @ts-check

import { createDefaultSave } from '../../src/platforms/types/save.js';

export class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  /** @param {string} key */
  getItem(key) { return this.values.get(key) ?? null; }
  /** @param {string} key @param {string} value */
  setItem(key, value) { this.values.set(key, value); }
  /** @param {string} key */
  removeItem(key) { this.values.delete(key); }
}

export class EventHub {
  constructor() {
    this.hidden = false;
    /** @type {Map<string, Set<()=>void>>} */
    this.listeners = new Map();
  }
  /** @param {string} type @param {()=>void} listener */
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  /** @param {string} type @param {()=>void} listener */
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  /** @param {string} type */
  emit(type) { for (const listener of this.listeners.get(type) ?? []) listener(); }
}

/** @param {Partial<import('../../src/platforms/types/save.js').InfernoSaveV1>} [overrides] */
export function makeSave(overrides = {}) {
  const base = createDefaultSave(100);
  return {
    ...base,
    ...overrides,
    settings: { ...base.settings, ...(overrides.settings ?? {}) },
    dailyRitual: { ...base.dailyRitual, ...(overrides.dailyRitual ?? {}) },
    tutorialFlags: { ...base.tutorialFlags, ...(overrides.tutorialFlags ?? {}) },
  };
}

/**
 * @param {object} [options]
 * @param {boolean} [options.authorized]
 * @param {string} [options.language]
 * @param {string} [options.playerId]
 * @param {Record<string,unknown>} [options.cloudData]
 * @param {(data:Record<string,unknown>,flush:boolean)=>Promise<void>} [options.setData]
 * @param {(name:string,score:number)=>Promise<void>} [options.setScore]
 * @param {()=>Promise<void>|void} [options.loadingReady]
 * @param {Record<string,boolean>} [options.methodAvailability]
 * @param {(name:string,options:Record<string,unknown>)=>Promise<{entries:Array<{rank:number,score:number,player?:{publicName?:string,uniqueID?:string}}>,userRank?:number}>} [options.getEntries]
 * @param {(callbacks:Record<string,Function>)=>void} [options.rewarded]
 */
export function createYandexMock(options = {}) {
  /** @type {Map<string, Set<()=>void>>} */
  const events = new Map();
  const calls = {
    ready: 0,
    start: 0,
    stop: 0,
    getPlayer: 0,
    setData: 0,
    setScore: /** @type {number[]} */ ([]),
    getEntries: 0,
    rewardedVideo: 0,
    getEntriesOptions: /** @type {Record<string,unknown>[]} */ ([]),
    availableMethods: /** @type {string[]} */ ([]),
    setDataPayloads: /** @type {Record<string,unknown>[]} */ ([]),
    setDataFlush: /** @type {boolean[]} */ ([]),
  };
  let cloudData = { ...(options.cloudData ?? {}) };
  const player = {
    isAuthorized: () => options.authorized ?? true,
    getUniqueID: () => options.playerId ?? 'current-player',
    async getData() { return { ...cloudData }; },
    async setData(data, flush = false) {
      calls.setData += 1;
      calls.setDataPayloads.push(data);
      calls.setDataFlush.push(flush);
      if (options.setData) await options.setData(data, flush);
      cloudData = { ...cloudData, ...data };
    },
  };
  const sdk = {
    environment: { i18n: { lang: options.language ?? 'ru' } },
    features: {
      LoadingAPI: { ready: () => { calls.ready += 1; return options.loadingReady?.(); } },
      GameplayAPI: {
        start: () => { calls.start += 1; },
        stop: () => { calls.stop += 1; },
      },
    },
    adv: {
      showRewardedVideo: ({ callbacks }) => {
        calls.rewardedVideo += 1;
        if (options.rewarded) options.rewarded(callbacks);
        else callbacks.onClose?.(false);
      },
    },
    leaderboards: {
      async setScore(name, score) {
        calls.setScore.push(score);
        if (options.setScore) await options.setScore(name, score);
      },
      async getEntries(name, requestOptions) {
        calls.getEntries += 1;
        calls.getEntriesOptions.push(requestOptions);
        if (options.getEntries) return options.getEntries(name, requestOptions);
        return { entries: [{ rank: 1, score: 321, player: { publicName: 'Игрок' } }] };
      },
    },
    async getPlayer() { calls.getPlayer += 1; return player; },
    async isAvailableMethod(method) {
      calls.availableMethods.push(method);
      return options.methodAvailability?.[method] ?? true;
    },
    on(event, callback) {
      const listeners = events.get(event) ?? new Set();
      listeners.add(callback);
      events.set(event, listeners);
    },
    off(event, callback) { events.get(event)?.delete(callback); },
  };
  return {
    sdk,
    calls,
    emit(event) {
      for (const callback of events.get(event) ?? []) callback();
    },
    getCloudData() { return cloudData; },
  };
}
