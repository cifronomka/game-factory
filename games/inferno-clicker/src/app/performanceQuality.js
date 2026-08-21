// @ts-check

/**
 * One-way presentation-only quality guard. Gameplay state and fixed-step timing
 * never enter this controller.
 */
export class PerformanceQualityController {
  /**
   * @param {{warmupMs?:number,windowMs?:number,thresholdMs?:number,confirmationWindows?:number,minSamples?:number}=} options
   */
  constructor(options = {}) {
    this.warmupMs = options.warmupMs ?? 2_000;
    this.windowMs = options.windowMs ?? 2_000;
    this.thresholdMs = options.thresholdMs ?? 24;
    this.confirmationWindows = options.confirmationWindows ?? 2;
    this.minSamples = options.minSamples ?? 20;
    /** @type {{at:number,renderMs:number}[]} */ this.samples = [];
    /** @type {number|null} */ this.activeSince = null;
    this.overBudgetWindows = 0;
    this.downgraded = false;
    this.lastP95Ms = 0;
    /** @type {null|'sustained-render-cost'} */ this.downgradeReason = null;
  }

  resetObservation() {
    this.samples.length = 0;
    this.activeSince = null;
    this.overBudgetWindows = 0;
  }

  /**
   * Observes CPU work spent updating and drawing one presentation frame. The
   * interval between requestAnimationFrame callbacks is deliberately not used:
   * it reflects display refresh rate as well as rendering cost.
   * @param {number} atMs
   * @param {number} renderMs
   * @param {{visible?:boolean,paused?:boolean}=} state
   * @returns {boolean}
   */
  observe(atMs, renderMs, state = {}) {
    if (this.downgraded) return false;
    if (state.visible === false || state.paused === true) {
      this.resetObservation();
      return false;
    }
    if (!Number.isFinite(atMs) || !Number.isFinite(renderMs) || renderMs < 0) return false;
    if (this.activeSince === null || atMs < this.activeSince) {
      this.activeSince = atMs;
      this.samples.length = 0;
      this.overBudgetWindows = 0;
      return false;
    }
    if (atMs - this.activeSince < this.warmupMs) return false;
    this.samples.push({ at: atMs, renderMs });
    if (this.samples.length < this.minSamples || atMs - this.samples[0].at < this.windowMs) return false;
    const ordered = this.samples.map((sample) => sample.renderMs).sort((a, b) => a - b);
    const p95 = ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)];
    this.lastP95Ms = p95;
    this.samples.length = 0;
    if (p95 <= this.thresholdMs) {
      this.overBudgetWindows = 0;
      return false;
    }
    this.overBudgetWindows += 1;
    if (this.overBudgetWindows < this.confirmationWindows) return false;
    this.downgraded = true;
    this.downgradeReason = 'sustained-render-cost';
    return true;
  }

  getDiagnostics() {
    return Object.freeze({
      downgraded: this.downgraded,
      reason: this.downgradeReason,
      renderP95Ms: this.lastP95Ms,
      thresholdMs: this.thresholdMs,
      confirmedWindows: this.overBudgetWindows,
    });
  }
}
