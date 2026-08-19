// @ts-check

/** Serializes, coalesces and retries records/settings persistence. */
export class SaveCoordinator {
  /**
   * @template T
   * @param {{read:()=>T,save:(value:T)=>Promise<{ok:boolean}>,signature:(value:T)=>string,initialValue?:T,delayMs?:number,maxRetries?:number,onFailure?:()=>void}} options
   */
  constructor(options) {
    this.read = options.read;
    this.save = options.save;
    this.signature = options.signature;
    this.delayMs = options.delayMs ?? 500;
    this.maxRetries = options.maxRetries ?? 2;
    this.onFailure = options.onFailure ?? (() => undefined);
    this.lastSignature = options.initialValue === undefined ? '' : this.signature(options.initialValue);
    this.retryCount = 0;
    this.dirty = false;
    /** @type {ReturnType<typeof setTimeout>|null} */ this.timer = null;
    /** @type {Promise<void>|null} */ this.inFlight = null;
  }

  request() {
    this.dirty = true;
    if (this.timer === null && this.inFlight === null) this.#schedule(this.delayMs);
  }

  async flushNow() {
    this.dirty = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (this.inFlight) {
      await this.inFlight;
      if (this.dirty) return this.flushNow();
      return;
    }
    return this.#flush();
  }

  /** @param {number} delay */
  #schedule(delay) {
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.#flush();
    }, delay);
  }

  async #flush() {
    if (this.inFlight) return this.inFlight;
    if (!this.dirty) return;
    this.dirty = false;
    const value = this.read();
    const signature = this.signature(value);
    if (signature === this.lastSignature) return;
    this.inFlight = (async () => {
      const result = await this.save(value);
      if (result.ok) {
        this.lastSignature = signature;
        this.retryCount = 0;
      } else if (this.retryCount < this.maxRetries) {
        this.retryCount += 1;
        this.dirty = true;
      } else this.onFailure();
    })().finally(() => {
      this.inFlight = null;
      if (this.dirty && this.timer === null) this.#schedule(this.delayMs * (2 ** this.retryCount));
    });
    return this.inFlight;
  }

  dispose() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
