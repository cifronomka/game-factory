// @ts-check

/** Pure lifecycle/polyphony model shared by the browser mixer and unit tests. */
export class AudioMixerState {
  /** @param {number=} maxVoices */
  constructor(maxVoices = 16) {
    this.maxVoices = maxVoices;
    this.unlocked = false;
    this.muted = false;
    this.stage = 1;
    this.boost = false;
    /** @type {Set<string>} */ this.pauseReasons = new Set();
    /** @type {Set<number>} */ this.voices = new Set();
    this.nextVoiceId = 1;
  }

  unlock() { this.unlocked = true; }
  /** @param {boolean} muted */ setMuted(muted) { this.muted = muted; }
  /** @param {number} stage */ setStage(stage) { this.stage = Math.max(1, Math.min(7, Math.round(stage))); }
  /** @param {boolean} active */ setBoost(active) { this.boost = active; }
  /** @param {string} reason */ pause(reason) { if (reason) this.pauseReasons.add(reason); }
  /** @param {string} reason */ resume(reason) { this.pauseReasons.delete(reason); }
  canPlay() { return this.unlocked && !this.muted && this.pauseReasons.size === 0 && this.voices.size < this.maxVoices; }
  beginVoice() {
    if (!this.canPlay()) return null;
    const id = this.nextVoiceId++;
    this.voices.add(id);
    return id;
  }
  /** @param {number} id */ endVoice(id) { this.voices.delete(id); }
  clearVoices() { this.voices.clear(); }
  snapshot() {
    return Object.freeze({
      unlocked: this.unlocked,
      muted: this.muted,
      stage: this.stage,
      boost: this.boost,
      paused: this.pauseReasons.size > 0,
      pauseReasons: Object.freeze([...this.pauseReasons].sort()),
      activeVoices: this.voices.size,
      maxVoices: this.maxVoices,
    });
  }
}
