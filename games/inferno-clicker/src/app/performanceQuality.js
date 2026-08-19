// @ts-check

/**
 * One-way presentation-only quality guard. Gameplay state and fixed-step timing
 * never enter this controller.
 */
export class PerformanceQualityController {
  /** @param {{windowMs?:number,thresholdMs?:number}=} options */
  constructor(options = {}) {
    this.windowMs = options.windowMs ?? 5_000;
    this.thresholdMs = options.thresholdMs ?? 24;
    /** @type {{at:number,frameMs:number}[]} */ this.samples = [];
    this.downgraded = false;
  }

  /** @param {number} atMs @param {number} frameMs @returns {boolean} */
  observe(atMs, frameMs) {
    if (this.downgraded || !Number.isFinite(atMs) || !Number.isFinite(frameMs) || frameMs < 0) return false;
    this.samples.push({ at: atMs, frameMs });
    const cutoff = atMs - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].at < cutoff) this.samples.shift();
    if (this.samples.length < 2 || this.samples[0].at > cutoff + 50) return false;
    const ordered = this.samples.map((sample) => sample.frameMs).sort((a, b) => a - b);
    const p95 = ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)];
    if (p95 <= this.thresholdMs) return false;
    this.downgraded = true;
    this.samples.length = 0;
    return true;
  }
}
