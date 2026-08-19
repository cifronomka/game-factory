// @ts-check

import { AudioMixerState } from './audioMixerState.js';

export const AUDIO_ASSET_URLS = Object.freeze({
  wood: Object.freeze([
    new URL('../../../assets/audio/fire/embers-wood-bed.ogg', import.meta.url),
    new URL('../../../assets/audio/fire/embers-wood-bed.mp3', import.meta.url),
  ]),
  crackle: Object.freeze([
    new URL('../../../assets/audio/fire/charcoal-crackle.ogg', import.meta.url),
    new URL('../../../assets/audio/fire/charcoal-crackle.mp3', import.meta.url),
  ]),
  fanA: Object.freeze([
    new URL('../../../assets/audio/fan/fan-soft-a.ogg', import.meta.url),
    new URL('../../../assets/audio/fan/fan-soft-a.mp3', import.meta.url),
  ]),
  fanB: Object.freeze([
    new URL('../../../assets/audio/fan/fan-soft-b.ogg', import.meta.url),
    new URL('../../../assets/audio/fan/fan-soft-b.mp3', import.meta.url),
  ]),
  fanC: Object.freeze([
    new URL('../../../assets/audio/fan/fan-soft-c.ogg', import.meta.url),
    new URL('../../../assets/audio/fan/fan-soft-c.mp3', import.meta.url),
  ]),
});

/** @param {BaseAudioContext} context @param {keyof typeof AUDIO_ASSET_URLS} key */
async function loadAuthoredAsset(context, key) {
  for (const url of AUDIO_ASSET_URLS[key]) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const bytes = await response.arrayBuffer();
      return await context.decodeAudioData(bytes.slice(0));
    } catch { /* matching MP3 fallback, then silence for this optional asset */ }
  }
  return null;
}

/**
 * Authored wood/charcoal ambience and bounded bellows response. Tap events are
 * aggregated for presentation only; no tone/pitch ladder or gameplay timing is
 * derived from this mixer.
 */
export class AudioMixer {
  /** @param {{contextFactory?:(()=>AudioContext),assetLoader?:((context:BaseAudioContext,key:keyof typeof AUDIO_ASSET_URLS)=>Promise<AudioBuffer|null>)}=} options */
  constructor(options = {}) {
    this.state = new AudioMixerState(10);
    this.contextFactory = options.contextFactory ?? (() => {
      const Constructor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Constructor) throw new Error('Web Audio is unavailable');
      return new Constructor();
    });
    this.assetLoader = options.assetLoader ?? loadAuthoredAsset;
    /** @type {AudioContext|null} */ this.context = null;
    /** @type {GainNode|null} */ this.master = null;
    /** @type {GainNode|null} */ this.ambienceBus = null;
    /** @type {GainNode|null} */ this.fanBus = null;
    /** @type {AudioBufferSourceNode[]} */ this.ambienceSources = [];
    /** @type {AudioBuffer[]} */ this.fanBuffers = [];
    /** @type {{source:AudioBufferSourceNode,voiceId:number}[]} */ this.fanVoices = [];
    /** @type {Promise<boolean>|null} */ this.assetLoadPromise = null;
    this.assetLoadAttempted = false;
    /** @type {ReturnType<typeof setTimeout>|null} */ this.resumeTimer = null;
    /** @type {ReturnType<typeof setTimeout>|null} */ this.fanTimer = null;
    this.pendingFanTaps = 0;
    this.lastFanStartSeconds = -Infinity;
    this.nextFanIndex = 0;
    this.reducedMotion = false;
  }

  /** Must only be called from a trusted pointer/key gesture. */
  async unlock() {
    try {
      if (!this.context) this.buildGraph();
      if (this.context?.state !== 'running') await this.context?.resume();
      this.state.unlock();
      this.rampMaster(this.state.muted || this.state.pauseReasons.size > 0 ? 0 : 0.76, 0.05);
      await this.ensureAuthoredAudio();
      return true;
    } catch {
      return false;
    }
  }

  buildGraph() {
    const context = this.contextFactory();
    this.context = context;
    this.master = context.createGain();
    this.ambienceBus = context.createGain();
    this.fanBus = context.createGain();
    this.master.gain.value = 0;
    this.ambienceBus.gain.value = this.reducedMotion ? 0.18 : 0.27;
    this.fanBus.gain.value = this.reducedMotion ? 0.2 : 0.28;
    this.ambienceBus.connect(this.master);
    this.fanBus.connect(this.master);
    this.master.connect(context.destination);
  }

  /** Loads two authored beds plus three bounded fanning variants once. */
  async ensureAuthoredAudio() {
    const context = this.context;
    const ambienceBus = this.ambienceBus;
    if (!context || !ambienceBus) return false;
    if (this.ambienceSources.length > 0) return true;
    if (this.assetLoadAttempted && !this.assetLoadPromise) return false;
    if (!this.assetLoadPromise) {
      this.assetLoadAttempted = true;
      this.assetLoadPromise = (async () => {
        const [wood, crackle, ...fans] = await Promise.all([
          this.assetLoader(context, 'wood'),
          this.assetLoader(context, 'crackle'),
          this.assetLoader(context, 'fanA'),
          this.assetLoader(context, 'fanB'),
          this.assetLoader(context, 'fanC'),
        ]);
        if (this.context !== context || this.ambienceBus !== ambienceBus) return false;
        for (const [buffer, gainValue] of [[wood, 0.78], [crackle, 0.22]]) {
          if (!buffer) continue;
          const gain = context.createGain();
          gain.gain.value = /** @type {number} */ (gainValue);
          const source = context.createBufferSource();
          source.buffer = /** @type {AudioBuffer} */ (buffer);
          source.loop = true;
          source.connect(gain);
          gain.connect(ambienceBus);
          source.start();
          this.ambienceSources.push(source);
        }
        this.fanBuffers = fans.filter((buffer) => buffer !== null);
        return this.ambienceSources.length > 0;
      })().catch(() => false).finally(() => { this.assetLoadPromise = null; });
    }
    return this.assetLoadPromise;
  }

  /** Aggregate accepted taps in a 120 ms presentation window. */
  queueFan() {
    if (!this.state.canPlay() || this.fanBuffers.length === 0) return;
    this.pendingFanTaps += 1;
    if (this.fanTimer !== null) return;
    this.fanTimer = setTimeout(() => {
      this.fanTimer = null;
      this.flushFan();
    }, 120);
  }

  flushFan() {
    const context = this.context;
    const bus = this.fanBus;
    const tapCount = this.pendingFanTaps;
    this.pendingFanTaps = 0;
    if (!context || !bus || tapCount === 0 || !this.state.canPlay() || this.fanBuffers.length === 0) return;
    const sinceLast = context.currentTime - this.lastFanStartSeconds;
    if (sinceLast < 0.18) {
      this.pendingFanTaps = tapCount;
      this.fanTimer = setTimeout(() => { this.fanTimer = null; this.flushFan(); }, Math.ceil((0.18 - sinceLast) * 1_000));
      return;
    }
    if (this.fanVoices.length >= 2) return;
    const voiceId = this.state.beginVoice();
    if (voiceId === null) return;
    const source = context.createBufferSource();
    source.buffer = this.fanBuffers[this.nextFanIndex % this.fanBuffers.length];
    this.nextFanIndex += 1;
    const gain = context.createGain();
    const target = Math.min(0.46, 0.24 + Math.log2(Math.max(1, tapCount)) * 0.055);
    gain.gain.value = target;
    source.connect(gain);
    gain.connect(bus);
    const record = { source, voiceId };
    source.onended = () => {
      this.state.endVoice(voiceId);
      const index = this.fanVoices.indexOf(record);
      if (index >= 0) this.fanVoices.splice(index, 1);
    };
    this.fanVoices.push(record);
    this.lastFanStartSeconds = context.currentTime;
    source.start();
  }

  /** @param {number} stage */
  setStage(stage) {
    const previous = this.state.stage;
    this.state.setStage(stage);
    if (this.state.stage === previous || !this.context || !this.ambienceBus) return;
    const base = this.reducedMotion ? 0.16 : 0.24;
    const target = base + (this.state.stage - 1) * (this.reducedMotion ? 0.009 : 0.017);
    this.ambienceBus.gain.setTargetAtTime(target, this.context.currentTime, stage >= previous ? 0.9 : 0.45);
  }

  /** @param {boolean} muted */
  setMuted(muted) {
    if (this.state.muted === muted) return;
    this.state.setMuted(muted);
    this.rampMaster(muted || this.state.pauseReasons.size > 0 ? 0 : 0.76, 0.08);
  }

  /** @param {boolean} reduced */
  setReducedMotion(reduced) {
    if (this.reducedMotion === reduced) return;
    this.reducedMotion = reduced;
    if (!this.context || !this.ambienceBus || !this.fanBus) return;
    const base = reduced ? 0.16 : 0.24;
    const target = base + (this.state.stage - 1) * (reduced ? 0.009 : 0.017);
    this.ambienceBus.gain.setTargetAtTime(target, this.context.currentTime, 0.08);
    this.fanBus.gain.setTargetAtTime(reduced ? 0.2 : 0.28, this.context.currentTime, 0.08);
  }

  /** @param {string} reason */
  async pause(reason) {
    this.state.pause(reason);
    if (this.resumeTimer !== null) clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
    if (this.fanTimer !== null) clearTimeout(this.fanTimer);
    this.fanTimer = null;
    this.pendingFanTaps = 0;
    this.rampMaster(0, 0.095);
    const context = this.context;
    if (context) setTimeout(() => {
      if (this.state.pauseReasons.size === 0 || context.state !== 'running') return;
      try { void Promise.resolve(context.suspend()).catch(() => undefined); } catch { /* silent fallback */ }
    }, 100);
  }

  /** @param {string} reason */
  resume(reason) {
    this.state.resume(reason);
    if (this.state.pauseReasons.size > 0 || !this.context) return;
    if (this.resumeTimer !== null) clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(async () => {
      this.resumeTimer = null;
      if (this.state.pauseReasons.size > 0 || !this.context) return;
      try {
        await this.context.resume();
        this.rampMaster(this.state.muted ? 0 : 0.76, 0.25);
      } catch { /* next trusted gesture retries unlock */ }
    }, 0);
  }

  /** @param {number} target @param {number} seconds */
  rampMaster(target, seconds) {
    if (!this.context || !this.master) return;
    const parameter = this.master.gain;
    parameter.cancelScheduledValues(this.context.currentTime);
    parameter.setValueAtTime(parameter.value, this.context.currentTime);
    parameter.linearRampToValueAtTime(target, this.context.currentTime + seconds);
  }

  /** @param {import('../types.js').PresentationEvent} event */
  handleEvent(event) {
    if (event.type === 'tap-accepted') this.queueFan();
    else if (event.type === 'stage-changed') this.setStage(event.to);
    else if (event.type === 'boost-changed') this.state.setBoost(event.active);
    else if (event.type === 'pause') void this.pause(event.reason);
    else if (event.type === 'resume') this.resume(event.reason);
    else if (event.type === 'mute-changed') this.setMuted(event.muted);
  }

  getDiagnostics() {
    return Object.freeze({
      ...this.state.snapshot(),
      continuousSources: this.ambienceSources.length,
      authoredWoodActive: this.ambienceSources.length > 0,
      authoredAudioLoading: this.assetLoadPromise !== null,
      authoredAudioFailed: this.assetLoadAttempted && this.ambienceSources.length === 0 && this.assetLoadPromise === null,
      fanBuffers: this.fanBuffers.length,
      activeFanVoices: this.fanVoices.length,
      pendingFanTaps: this.pendingFanTaps,
      fanAggregationMs: 120,
      fanCooldownMs: 180,
    });
  }

  async destroy() {
    if (this.resumeTimer !== null) clearTimeout(this.resumeTimer);
    if (this.fanTimer !== null) clearTimeout(this.fanTimer);
    for (const source of this.ambienceSources) { try { source.stop(); } catch {} }
    for (const voice of this.fanVoices) {
      try { voice.source.stop(); } catch { /* already ended */ }
      this.state.endVoice(voice.voiceId);
    }
    this.ambienceSources.length = 0;
    this.fanVoices.length = 0;
    this.fanBuffers.length = 0;
    this.state.clearVoices();
    const context = this.context;
    this.context = null;
    this.master = null;
    this.ambienceBus = null;
    this.fanBus = null;
    if (context && context.state !== 'closed') await context.close();
  }
}
