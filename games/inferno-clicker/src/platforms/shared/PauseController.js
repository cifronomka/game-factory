// @ts-check

/** @typedef {import('../types/platform.js').PauseSnapshot} PauseSnapshot */

export class PauseController {
  /** @param {(active:boolean)=>void} [onActiveChange] */
  constructor(onActiveChange = () => {}) {
    /** @type {Set<string>} */
    this.reasons = new Set();
    /** @type {Set<(snapshot:PauseSnapshot)=>void>} */
    this.listeners = new Set();
    this.gameplayRequested = false;
    this.active = false;
    this.onActiveChange = onActiveChange;
  }

  /** @param {string} reason */
  pause(reason) {
    const changed = !this.reasons.has(reason);
    this.reasons.add(reason);
    if (changed) this.#publish();
  }

  /** Public/app resume also records that an active gameplay session is desired. @param {string} reason */
  requestResume(reason) {
    this.gameplayRequested = true;
    const changed = this.reasons.delete(reason);
    if (changed) this.#publish();
    else this.#syncActive();
  }

  /** Platform/browser resume never starts gameplay that the app has not requested. @param {string} reason */
  systemResume(reason) {
    if (this.reasons.delete(reason)) this.#publish();
  }

  stopGameplay() {
    if (!this.gameplayRequested) return;
    this.gameplayRequested = false;
    this.#publish();
  }

  /** @param {(snapshot:PauseSnapshot)=>void} listener */
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  /** @returns {PauseSnapshot} */
  snapshot() {
    return Object.freeze({
      paused: this.reasons.size > 0 || !this.gameplayRequested,
      reasons: Object.freeze([...this.reasons].sort()),
      gameplayRequested: this.gameplayRequested,
    });
  }

  #publish() {
    this.#syncActive();
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  #syncActive() {
    const next = this.gameplayRequested && this.reasons.size === 0;
    if (next === this.active) return;
    this.active = next;
    this.onActiveChange(next);
  }
}
