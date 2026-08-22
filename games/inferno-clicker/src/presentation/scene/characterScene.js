// @ts-check

import { OptionalBitmap } from './optionalBitmap.js';
import { SpriteAnimator, drawSpriteFrame, gridFrames } from './spriteAnimator.js';
import { sceneTransform } from './infernoScene.js';
import { drawSteamStream, steamStreamGeometry } from './steamEmitter.js';

export const ASH_SERVANT_ATLAS_URLS = Object.freeze(Object.fromEntries(['idle', 'inhale', 'blow', 'recovery'].map((clip) => [clip,
  new URL(`../../../assets/characters/ash-servant/ash-servant-${clip}-v5.webp`, import.meta.url).href,
])));
export const DEMONESS_ATLAS_URLS = Object.freeze(Object.fromEntries(['idle', 'cast', 'hold', 'recovery'].map((clip) => [clip,
  new URL(`../../../assets/characters/demoness/demoness-${clip}-v6.webp`, import.meta.url).href,
])));
export const ASH_SERVANT_ATLAS_URL = ASH_SERVANT_ATLAS_URLS.idle;
export const DEMONESS_ATLAS_URL = DEMONESS_ATLAS_URLS.idle;
export const INFERNO_HOST_URLS = Object.freeze({
  main: new URL('../../../assets/characters/character-inferno-host-main-v4.webp', import.meta.url).href,
  sentinel: new URL('../../../assets/characters/character-inferno-host-sentinel-v4.webp', import.meta.url).href,
});
export const INFERNO_HOST_URL = INFERNO_HOST_URLS.main;

const SERVANT_CELL_WIDTH = 256;
const SERVANT_CELL_HEIGHT = 320;
const SERVANT_PIVOT = Object.freeze([0.5, 0.98125]);
const DEMONESS_CELL_WIDTH = 412;
const DEMONESS_CELL_HEIGHT = 664;
const DEMONESS_PIVOT = Object.freeze([0.5, 0.99]);
const eightFrames = gridFrames(4, 8, SERVANT_CELL_WIDTH, SERVANT_CELL_HEIGHT);
const demonessEightFrames = gridFrames(4, 8, DEMONESS_CELL_WIDTH, DEMONESS_CELL_HEIGHT);
const SERVANT_CLIPS = Object.freeze({
  appearance: Object.freeze({ fps: 10, loop: false, frames: eightFrames }),
  idle: Object.freeze({ fps: 6, loop: true, frames: eightFrames }),
  inhale: Object.freeze({ fps: 10, loop: false, frames: eightFrames }),
  blow: Object.freeze({ fps: 10, loop: true, frames: eightFrames }),
  recovery: Object.freeze({ fps: 10, loop: false, frames: eightFrames }),
});
const DEMONESS_CLIPS = Object.freeze({
  appearance: Object.freeze({ fps: 8, loop: false, frames: demonessEightFrames }),
  idle: Object.freeze({ fps: 1.2, loop: true, frames: demonessEightFrames }),
  disapproval: Object.freeze({ fps: 4, loop: false, frames: demonessEightFrames }),
  cast: Object.freeze({ fps: 8, loop: false, frames: demonessEightFrames }),
  hold: Object.freeze({ fps: 6, loop: true, frames: demonessEightFrames }),
  recovery: Object.freeze({ fps: 8, loop: false, frames: demonessEightFrames }),
});

const SERVANT_MOUTH_SOCKETS = Object.freeze({
  idle: Object.freeze([[0.72, 0.34], [0.72, 0.34], [0.73, 0.34], [0.73, 0.34], [0.72, 0.35], [0.72, 0.35], [0.71, 0.35], [0.71, 0.35]].map(Object.freeze)),
  inhale: Object.freeze([[0.7185, 0.2979], [0.7146, 0.2989], [0.7185, 0.2998], [0.7254, 0.2989], [0.7146, 0.2861], [0.7107, 0.2881], [0.7068, 0.2900], [0.7029, 0.2920]].map(Object.freeze)),
  blow: Object.freeze([[0.790, 0.515], [0.785, 0.515], [0.790, 0.520], [0.750, 0.565], [0.785, 0.530], [0.775, 0.520], [0.735, 0.560], [0.705, 0.560]].map(Object.freeze)),
  recovery: Object.freeze([[0.71, 0.45], [0.71, 0.43], [0.71, 0.41], [0.71, 0.39], [0.71, 0.37], [0.71, 0.36], [0.72, 0.35], [0.72, 0.34]].map(Object.freeze)),
});
const DEMONESS_CAST_HANDS = Object.freeze([
  [[0.2886, 0.5665], [0.6600, 0.5665]], [[0.1686, 0.5525], [0.6829, 0.5665]], [[0.0714, 0.3710], [0.7571, 0.4548]], [[0.0943, 0.3897], [0.5114, 0.4455]],
  [[0.1229, 0.3849], [0.3514, 0.4594]], [[0.1800, 0.3849], [0.3400, 0.4082]], [[0.1686, 0.3803], [0.3171, 0.4361]], [[0.1686, 0.3618], [0.3171, 0.3803]],
].map((pair) => Object.freeze(pair.map(Object.freeze))));
const DEMONESS_HOLD_HANDS = Object.freeze([
  [[0.0948, 0.3978], [0.3556, 0.4656]], [[0.1114, 0.3706], [0.2946, 0.4159]], [[0.0892, 0.3661], [0.3113, 0.4475]], [[0.1059, 0.3164], [0.3168, 0.4023]],
  [[0.1447, 0.3480], [0.3168, 0.4159]], [[0.1781, 0.3661], [0.3556, 0.4385]], [[0.1891, 0.4114], [0.3223, 0.4701]], [[0.0836, 0.3751], [0.3556, 0.4746]],
].map((pair) => Object.freeze(pair.map(Object.freeze))));
const DEMONESS_DISAPPROVAL_INTERVALS = Object.freeze([6.4, 8.2, 5.6, 7.3]);
const DEMONESS_PLACEMENT = Object.freeze({ anchorX: 850, anchorY: 1_235, width: 420, height: 700 });
const SERVANT_PLACEMENT = Object.freeze({ anchorX: 300, anchorY: 1_225, width: 540, height: 590 });
const SERVANT_APPEARANCE_DURATION = SERVANT_CLIPS.appearance.frames.length / SERVANT_CLIPS.appearance.fps;

/** Worst-axis source upscale for the fixed 1080×1920 scene contained in a viewport. */
export function demonessEffectiveUpscale(viewportWidth, viewportHeight, dpr = 2) {
  const sceneScale = sceneTransform(viewportWidth, viewportHeight).scale;
  return Math.max(
    DEMONESS_PLACEMENT.width * sceneScale * dpr / DEMONESS_CELL_WIDTH,
    DEMONESS_PLACEMENT.height * sceneScale * dpr / DEMONESS_CELL_HEIGHT,
  );
}

export const INFERNO_HOST_REGIONS = Object.freeze([
  Object.freeze({ id: 'inferno-sentinel', phase: 0, period: 2.5, amplitude: 3, role: 'sentinel' }),
  Object.freeze({ id: 'crowned-host', phase: 1.1, period: 3.4, amplitude: 2, role: 'main' }),
]);

/** @param {typeof INFERNO_HOST_REGIONS[number]} region @param {number} time @param {boolean} reducedMotion */
export function hostMotionForRegion(region, time, reducedMotion) {
  const motionTime = reducedMotion ? time * 0.55 : time;
  const motionScale = reducedMotion ? 0.22 : 1;
  const wave = Math.sin(motionTime * Math.PI * 2 / region.period + region.phase);
  const breath = Math.sin(motionTime * Math.PI * 2 / (region.period * 1.37) + region.phase * 0.61);
  return Object.freeze({
    hover: wave * region.amplitude * motionScale,
    scaleX: 1 + breath * (region.role === 'sentinel' ? 0.009 : 0.004) * motionScale,
    scaleY: 1 + breath * (region.role === 'main' ? 0.006 : 0.003) * motionScale,
    rotation: !reducedMotion && region.role === 'sentinel' ? wave * -0.005 : 0,
  });
}

/** A quiet, ordered look-left → look-right → return gesture. */
export function demonessDisapprovalGesture(elapsed) {
  const progress = clamp(elapsed / 2, 0, 1);
  if (progress < 0.2) return Object.freeze({ phase: 'look-left', headOffset: -ramp(progress, 0, 0.2), headTilt: -0.012 });
  if (progress < 0.4) return Object.freeze({ phase: 'hold-left', headOffset: -1, headTilt: -0.012 });
  if (progress < 0.65) return Object.freeze({ phase: 'look-right', headOffset: -1 + ramp(progress, 0.4, 0.65) * 2, headTilt: 0.012 });
  if (progress < 0.82) return Object.freeze({ phase: 'hold-right', headOffset: 1, headTilt: 0.012 });
  return Object.freeze({ phase: 'return', headOffset: 1 - ramp(progress, 0.82, 1), headTilt: 0 });
}

/** @param {string} clip @param {number} frame */
export function servantMouthSocket(clip, frame) {
  const sockets = SERVANT_MOUTH_SOCKETS[clip] ?? SERVANT_MOUTH_SOCKETS.idle;
  return sockets[Math.max(0, Math.min(sockets.length - 1, frame))];
}

/** @param {string} clip @param {number} frame */
export function demonessHandSockets(clip, frame) {
  const sockets = clip === 'hold' ? DEMONESS_HOLD_HANDS : DEMONESS_CAST_HANDS;
  const pair = sockets[Math.max(0, Math.min(sockets.length - 1, frame))];
  return Object.freeze({ leftHand: pair[0], rightHand: pair[1] });
}

/** @param {{anchorX:number,anchorY:number,width:number,height:number}} placement @param {readonly number[]} socket @param {readonly number[]} pivot */
function socketWorld(placement, socket, pivot) {
  return {
    x: placement.anchorX + (socket[0] - pivot[0]) * placement.width,
    y: placement.anchorY + (socket[1] - pivot[1]) * placement.height,
  };
}

/** @param {CanvasRenderingContext2D} context @param {number} time @param {{anchorX:number,anchorY:number,width:number,height:number}} placement @param {{phase:string,headOffset:number,headTilt:number}} gesture */
function drawDisapprovalCue(context, time, placement, gesture) {
  const headX = placement.anchorX + gesture.headOffset * 5;
  const headY = placement.anchorY - placement.height * 0.77;
  const pulse = 0.7 + Math.sin(time * 4.1) * 0.12;
  context.save();
  context.globalCompositeOperation = 'screen';
  context.translate(headX, headY);
  context.rotate(gesture.headTilt);
  context.fillStyle = `rgba(168,227,219,${pulse})`;
  context.shadowColor = 'rgba(96,220,213,.8)';
  context.shadowBlur = 9;
  context.beginPath();
  context.ellipse(-10, 0, 3.5, 2, 0, 0, Math.PI * 2);
  context.ellipse(10, 0, 3.5, 2, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/** @param {CanvasRenderingContext2D} context @param {HTMLImageElement} image @param {SpriteAnimator} animator @param {any} placement */
function drawTemporalCharacter(context, image, frame, placement) {
  drawSpriteFrame(context, image, frame, placement);
}

/** @param {CanvasRenderingContext2D} context @param {number} time @param {number} strength @param {{x:number,y:number}} target */
function drawInhaleAir(context, time, strength, target) {
  const source = { x: 510, y: 1_130 };
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  for (let index = 0; index < 10; index += 1) {
    const progress = ((time * (0.62 + index * 0.013) + index * 0.17) % 1 + 1) % 1;
    const x = source.x + (target.x - source.x) * progress;
    const y = source.y + (target.y - source.y) * progress + Math.sin(progress * Math.PI * 2 + index) * 7;
    context.strokeStyle = `rgba(205,174,141,${Math.sin(progress * Math.PI) * 0.18 * strength})`;
    context.lineWidth = 1.5 + index % 3;
    context.beginPath();
    context.moveTo(x - 18, y + 3);
    context.quadraticCurveTo(x - 7, y - 5, x + 5, y);
    context.stroke();
  }
  context.restore();
}

function requestedServantClip(requested) { return requested === 'inhale' ? 'inhale' : requested === 'blow' ? 'blow' : 'idle'; }
function requestedDemonessClip(requested) { return requested === 'cast' ? 'cast' : requested === 'hold' ? 'hold' : 'idle'; }

/** @param {number} value @param {number} low @param {number} high */
function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
/** @param {number} value @param {number} from @param {number} to */
function ramp(value, from, to) { return clamp((value - from) / (to - from), 0, 1); }
/** @param {number} value */
function smoothstep(value) { const progress = clamp(value, 0, 1); return progress * progress * (3 - 2 * progress); }

const DEMONESS_STAGE_EXIT_DURATION = 0.9;

/** Stage-exit begins at the exact normal rendered profile and converges to the silhouette profile. */
function demonessExitVisual(progress) {
  const shade = smoothstep(progress);
  return Object.freeze({
    opacity: 0.97 - shade * 0.47,
    brightness: 1.08 - shade * 0.96,
    contrast: 1.1 - shade * 0.1,
    saturation: 1.04 - shade * 0.59,
    shadowBlur: Math.round(7 + shade * 5),
    shadowAlpha: 0.3 * (1 - shade),
  });
}

/** Authoritative Cycle 04 telegraph/effect phase mapper. */
export function servantTemporalPhase(encounter) {
  if (!encounter) return Object.freeze({ phase: 'idle', strength: 0, frame: 0, framePosition: 0 });
  const progress = clamp(Number(encounter.progress) || 0, 0, 1);
  if (encounter.phase === 'telegraph') {
    const framePosition = progress * 7;
    if (progress < 0.15) return Object.freeze({ phase: 'prepare', strength: 0, frame: Math.floor(framePosition), framePosition });
    if (progress < 0.7) return Object.freeze({ phase: 'inhale-ramp', strength: 0, frame: Math.floor(framePosition), framePosition });
    return Object.freeze({ phase: 'inhale-hold', strength: 0, frame: Math.min(7, Math.floor(framePosition)), framePosition });
  }
  const framePosition = progress * 7;
  if (progress < 0.1) return Object.freeze({ phase: 'exhale-start', strength: ramp(progress, 0, 0.1) * 0.3, frame: Math.floor(framePosition), framePosition });
  if (progress < 0.36) return Object.freeze({ phase: 'exhale-ramp', strength: 0.3 + ramp(progress, 0.1, 0.36) * 0.7, frame: Math.floor(framePosition), framePosition });
  if (progress < 0.68) return Object.freeze({ phase: 'exhale-peak', strength: 1, frame: Math.floor(framePosition), framePosition });
  if (progress < 0.9) return Object.freeze({ phase: 'exhale-fade', strength: 1 - ramp(progress, 0.68, 0.9) * 0.8, frame: Math.floor(framePosition), framePosition });
  return Object.freeze({ phase: 'exhale-end', strength: 0.2 * (1 - ramp(progress, 0.9, 1)), frame: Math.min(7, Math.floor(framePosition)), framePosition });
}

/** Authoritative Cycle 07 Demoness telegraph/steam phase mapper. */
export function demonessTemporalPhase(encounter) {
  if (!encounter) return Object.freeze({ phase: 'idle', strength: 0, impactStrength: 0, reach: 0, frame: 0, framePosition: 0 });
  const progress = clamp(Number(encounter.progress) || 0, 0, 1);
  if (encounter.phase === 'telegraph') {
    const framePosition = progress * 7;
    if (progress < 0.15) return Object.freeze({ phase: 'cast-look', strength: 0, impactStrength: 0, reach: 0, frame: Math.floor(framePosition), framePosition });
    if (progress < 0.65) return Object.freeze({ phase: 'arms-rise', strength: ramp(progress, 0.15, 0.65) * 0.2, impactStrength: 0, reach: 0, frame: Math.floor(framePosition), framePosition });
    return Object.freeze({ phase: 'cast-gather', strength: 0.2 + ramp(progress, 0.65, 1) * 0.25, impactStrength: 0, reach: 0, frame: Math.min(7, Math.floor(framePosition)), framePosition });
  }
  if (progress < 0.2) {
    const reach = ramp(progress, 0, 0.2);
    const framePosition = reach * 7;
    return Object.freeze({
      phase: 'steam-ramp',
      strength: 0.45 + reach * 0.55,
      impactStrength: ramp(reach, 0.97, 1),
      reach,
      frame: Math.min(7, Math.floor(framePosition)),
      framePosition,
    });
  }
  if (progress < 0.8) {
    const framePosition = ramp(progress, 0.2, 0.8) * 7.999;
    return Object.freeze({ phase: 'steam-hold', strength: 1, impactStrength: 1, reach: 1, frame: Math.min(7, Math.floor(framePosition)), framePosition });
  }
  const release = ramp(progress, 0.8, 1);
  const framePosition = 7 * (1 - release);
  return Object.freeze({ phase: 'steam-release', strength: 1 - release, impactStrength: 1 - release, reach: 1, frame: Math.max(0, Math.floor(framePosition)), framePosition });
}

/** Authored character state atlases with stable root anchors and spatially independent Inferno host regions. */
export class CharacterScene {
  /** @param {{imageFactory?:(()=>HTMLImageElement|null)}=} options */
  constructor(options = {}) {
    this.servantBitmaps = Object.fromEntries(Object.entries(ASH_SERVANT_ATLAS_URLS).map(([clip, url]) => [clip, new OptionalBitmap(url, { ...options, autoLoad: false })]));
    this.demonessBitmaps = Object.fromEntries(Object.entries(DEMONESS_ATLAS_URLS).map(([clip, url]) => [clip, new OptionalBitmap(url, { ...options, autoLoad: false })]));
    this.servantBitmap = this.servantBitmaps.idle;
    this.demonessBitmap = this.demonessBitmaps.idle;
    this.hostBitmaps = Object.fromEntries(Object.entries(INFERNO_HOST_URLS).map(([part, url]) => [part, new OptionalBitmap(url, { ...options, autoLoad: false })]));
    this.hostBitmap = this.hostBitmaps.main;
    this.servantAnimator = new SpriteAnimator(SERVANT_CLIPS, 'appearance');
    this.demonessAnimator = new SpriteAnimator(DEMONESS_CLIPS, 'appearance');
    this.hostAnimators = {
      main: new SpriteAnimator({ ambient: { fps: 2, loop: true, frames: gridFrames(3, 5, 304, 256) } }, 'ambient'),
      sentinel: new SpriteAnimator({ ambient: { fps: 2, loop: true, frames: gridFrames(3, 5, 304, 256) } }, 'ambient'),
    };
    this.hostAnimators.sentinel.elapsed = 0.67;
    this.hostAnimator = this.hostAnimators.main;
    this.servantAssetKey = 'idle';
    this.servantReadyKey = 'idle';
    this.demonessAssetKey = 'idle';
    this.demonessReadyKey = 'idle';
    this.servantPendingFrame = 0;
    this.demonessPendingFrame = 0;
    this.servantVisible = false;
    this.demonessVisible = false;
    this.demonessRevealed = false;
    this.servantRequested = 'hidden';
    this.demonessRequested = 'hidden';
    this.servantDisplay = 'hidden';
    this.demonessDisplay = 'hidden';
    this.paused = false;
    this.servantStrength = 0;
    this.servantInhaleStrength = 0;
    this.demonessStrength = 0;
    this.demonessImpactStrength = 0;
    this.demonessSpellReach = 0;
    this.flameTarget = Object.freeze({ x: 540, y: 1_050 });
    this.spellGeometry = Object.freeze({ origins: null, target: this.flameTarget, leading: null, contact: false });
    this.servantSteamOptions = null;
    this.demonessSteamOptions = null;
    this.servantRecoveryRemaining = 0;
    this.demonessRecoveryRemaining = 0;
    this.demonessExitRemaining = 0;
    this.servantWasActive = false;
    this.demonessWasActive = false;
    this.demonessIdleTime = 0;
    this.demonessDisapprovalCount = 0;
    this.demonessNextDisapproval = DEMONESS_DISAPPROVAL_INTERVALS[0];
    this.hostEntryAge = Number.POSITIVE_INFINITY;
    this.previousHostLevel = 0;
  }

  async prepareCriticalAssets() { return true; }
  async retryCriticalAssets() { return true; }

  /** Decode an upcoming clip without changing the currently rendered atlas. */
  /** @param {'servant'|'demoness'} kind @param {string} key */
  warmClipAsset(kind, key) {
    const bitmaps = kind === 'servant' ? this.servantBitmaps : this.demonessBitmaps;
    bitmaps[key].startLoad();
  }

  /** @param {'servant'|'demoness'} kind @param {string} key */
  requestClipAsset(kind, key) {
    const bitmaps = kind === 'servant' ? this.servantBitmaps : this.demonessBitmaps;
    const assetKey = `${kind}AssetKey`;
    const readyKey = `${kind}ReadyKey`;
    const bitmap = bitmaps[key];
    if (this[assetKey] === key && this[readyKey] === key && bitmap.isReady()) return;
    if (this[assetKey] !== key) {
      const animator = kind === 'servant' ? this.servantAnimator : this.demonessAnimator;
      this[`${kind}PendingFrame`] = animator.getFrameIndex();
      this[assetKey] = key;
    }
    const settle = bitmap.startLoad();
    const commit = () => {
      if (!bitmap.isReady() || this[assetKey] !== key) return;
      this[readyKey] = key;
      for (const [otherKey, other] of Object.entries(bitmaps)) if (otherKey !== key) other.release();
    };
    if (bitmap.isReady()) commit();
    else settle.then(commit);
  }

  /** @param {'servant'|'demoness'} kind */
  activeBitmap(kind) {
    const bitmaps = kind === 'servant' ? this.servantBitmaps : this.demonessBitmaps;
    return bitmaps[this[`${kind}ReadyKey`]];
  }

  clearDemonessSteam() {
    this.spellGeometry = Object.freeze({ origins: null, target: this.flameTarget, leading: null, contact: false });
  }

  /** Keep the previous atlas on a stable authored frame while a requested clip decodes. */
  activeFrame(kind) {
    const animator = kind === 'servant' ? this.servantAnimator : this.demonessAnimator;
    if (this[`${kind}ReadyKey`] === this[`${kind}AssetKey`]) return animator.getFrame();
    const frames = kind === 'servant' ? eightFrames : demonessEightFrames;
    return frames[this[`${kind}PendingFrame`] % frames.length];
  }

  /** @param {any} state */
  setState(state) {
    if (this.servantAssetKey === 'idle' && ((state.stage === 2 && state.stageProgress >= 0.6) || state.stage > 2)) this.requestClipAsset('servant', 'idle');
    if (this.demonessAssetKey === 'idle' && ((state.stage === 3 && state.stageProgress >= 0.6) || state.stage > 3)) this.requestClipAsset('demoness', 'idle');
    if ((state.stage === 5 && state.stageProgress >= 0.6) || state.stage > 5) for (const bitmap of Object.values(this.hostBitmaps)) bitmap.startLoad();
    this.paused = Boolean(state.paused);
    if (state.hostLevel === 2 && this.previousHostLevel < 2) this.hostEntryAge = 0;
    this.previousHostLevel = state.hostLevel;
    this.servantAnimator.setPaused(this.paused);
    this.demonessAnimator.setPaused(this.paused);
    for (const animator of Object.values(this.hostAnimators)) animator.setPaused(this.paused);
    const encounters = Array.isArray(state.encounters) ? state.encounters : [];
    const servantEncounter = encounters.find((item) => item.kind === 'servant') ?? null;
    const demonessEncounter = encounters.find((item) => item.kind === 'demoness') ?? null;
    if (state.stage >= 3 && !servantEncounter) this.warmClipAsset('servant', 'inhale');
    if (servantEncounter?.phase === 'telegraph') this.warmClipAsset('servant', 'blow');
    if (servantEncounter?.phase === 'active' && servantEncounter.progress >= 0.35) this.warmClipAsset('servant', 'recovery');
    if (state.stage >= 5 && !demonessEncounter) this.warmClipAsset('demoness', 'cast');
    if (demonessEncounter?.phase === 'telegraph') this.warmClipAsset('demoness', 'hold');
    if (demonessEncounter?.phase === 'active' && demonessEncounter.progress >= 0.35) this.warmClipAsset('demoness', 'recovery');
    const servantRequested = state.stage < 3 ? 'hidden' : servantEncounter ? servantEncounter.phase === 'telegraph' ? 'inhale' : 'blow' : 'idle';
    const demonessRequested = state.stage < 4
      ? 'hidden'
      : demonessEncounter
        ? demonessEncounter.phase === 'telegraph' ? 'cast' : 'hold'
        : state.stage === 4 ? 'silhouette' : 'idle';
    this.servantRequested = servantRequested;
    this.demonessRequested = demonessRequested;
    const servantEnding = this.servantWasActive && !servantEncounter;
    const demonessEnding = this.demonessWasActive && !demonessEncounter;
    const demonessExitActive = this.demonessExitRemaining > 0;
    const demonessStageExit = !demonessEnding
      && !demonessExitActive
      && demonessRequested === 'silhouette'
      && this.demonessRevealed;
    if (!servantEnding && this.servantRecoveryRemaining <= 0) this.setServantState(servantRequested);
    if (!demonessEnding && !demonessExitActive && !demonessStageExit && this.demonessRecoveryRemaining <= 0) this.setDemonessState(demonessRequested);
    this.servantInhaleStrength = servantEncounter?.phase === 'telegraph'
      ? servantEncounter.progress < 0.15 ? 0 : servantEncounter.progress < 0.7 ? ramp(servantEncounter.progress, 0.15, 0.7) : 0.35
      : 0;

    if (servantEnding) {
      this.requestClipAsset('servant', 'recovery');
      this.servantRecoveryRemaining = 0.8;
      this.servantVisible = true;
      this.servantDisplay = 'recovery';
      this.servantStrength = 0;
      this.servantAnimator.setClip('recovery', true);
    }
    if (demonessEnding) {
      this.requestClipAsset('demoness', 'recovery');
      this.demonessRecoveryRemaining = 1;
      this.demonessVisible = true;
      this.demonessRevealed = true;
      this.demonessDisplay = 'recovery';
      this.demonessStrength = 0;
      this.demonessImpactStrength = 0;
      this.demonessSpellReach = 0;
      this.clearDemonessSteam();
      this.demonessAnimator.setClip('recovery', true);
    } else if (demonessStageExit) {
      this.demonessExitRemaining = DEMONESS_STAGE_EXIT_DURATION;
      this.demonessVisible = true;
      this.demonessRevealed = true;
      this.demonessDisplay = 'stage-exit';
      this.demonessStrength = 0;
      this.demonessImpactStrength = 0;
      this.demonessSpellReach = 0;
      this.clearDemonessSteam();
    }
    this.servantWasActive = Boolean(servantEncounter?.phase === 'active');
    this.demonessWasActive = Boolean(demonessEncounter?.phase === 'active');

    if (this.servantDisplay !== 'appearance' && servantEncounter) {
      const temporal = servantTemporalPhase(servantEncounter);
      const clip = servantEncounter.phase === 'telegraph' ? 'inhale' : 'blow';
      this.requestClipAsset('servant', clip);
      this.servantDisplay = temporal.phase;
      this.servantStrength = temporal.strength;
      this.servantAnimator.setClip(clip);
      this.servantAnimator.elapsed = temporal.framePosition / this.servantAnimator.clip.fps;
    } else if (!servantEncounter && this.servantRecoveryRemaining <= 0 && this.servantDisplay !== 'appearance') {
      this.servantStrength = 0;
    }

    if (this.demonessDisplay !== 'appearance' && this.demonessDisplay !== 'silhouette' && demonessEncounter) {
      const temporal = demonessTemporalPhase(demonessEncounter);
      const clip = demonessEncounter.phase === 'telegraph' ? 'cast' : 'hold';
      this.requestClipAsset('demoness', clip);
      this.demonessDisplay = temporal.phase;
      this.demonessStrength = temporal.strength;
      this.demonessImpactStrength = temporal.impactStrength;
      this.demonessSpellReach = temporal.reach;
      this.demonessAnimator.setClip(clip);
      this.demonessAnimator.elapsed = temporal.framePosition / this.demonessAnimator.clip.fps;
    } else if (!demonessEncounter && this.demonessRecoveryRemaining <= 0 && this.demonessDisplay !== 'appearance' && this.demonessDisplay !== 'silhouette') {
      this.demonessStrength = 0;
      this.demonessImpactStrength = 0;
      this.demonessSpellReach = 0;
      this.clearDemonessSteam();
    }
  }

  /** @param {string} requested */
  setServantState(requested) {
    this.servantRequested = requested;
    if (requested === 'hidden') {
      this.servantVisible = false;
      this.servantDisplay = 'hidden';
      return;
    }
    if (!this.servantVisible) {
      this.requestClipAsset('servant', 'idle');
      this.servantVisible = true;
      this.servantDisplay = 'appearance';
      this.servantAnimator.setClip('appearance', true);
      return;
    }
    if (this.servantDisplay === 'appearance' || this.servantDisplay === 'recovery') return;
    if (this.servantDisplay === 'inhale' && requested === 'blow') return;
    if (this.servantDisplay.startsWith('exhale') || this.servantDisplay.startsWith('inhale') || this.servantDisplay === 'prepare') return;
    const clip = requestedServantClip(requested);
    if (this.servantDisplay !== clip) {
      const next = clip === 'blow' && this.servantDisplay === 'idle' ? 'inhale' : clip;
      this.servantDisplay = next;
      this.servantAnimator.setClip(next, true);
    }
  }

  /** @param {string} requested */
  setDemonessState(requested) {
    this.demonessRequested = requested;
    if (requested === 'hidden') {
      this.demonessVisible = false;
      this.demonessRevealed = false;
      this.demonessDisplay = 'hidden';
      this.demonessIdleTime = 0;
      this.demonessDisapprovalCount = 0;
      this.demonessNextDisapproval = DEMONESS_DISAPPROVAL_INTERVALS[0];
      this.demonessStrength = 0;
      this.demonessImpactStrength = 0;
      this.demonessSpellReach = 0;
      this.clearDemonessSteam();
      return;
    }
    if (requested === 'silhouette') {
      const preserveExitPose = this.demonessDisplay === 'stage-exit';
      this.demonessVisible = true;
      this.demonessRevealed = false;
      this.demonessDisplay = 'silhouette';
      this.clearDemonessSteam();
      if (!preserveExitPose) this.demonessAnimator.setClip('appearance', true);
      return;
    }
    this.demonessVisible = true;
    if (!this.demonessRevealed) {
      this.requestClipAsset('demoness', 'idle');
      this.demonessRevealed = true;
      this.demonessDisplay = 'appearance';
      this.demonessAnimator.setClip('appearance', true);
      return;
    }
    if (this.demonessDisplay === 'appearance' || this.demonessDisplay === 'recovery') return;
    if (this.demonessDisplay === 'disapproval' && requested === 'idle') return;
    if (this.demonessDisplay === 'cast' && requested === 'hold') return;
    if (this.demonessDisplay.startsWith('cast') || this.demonessDisplay === 'arms-rise' || this.demonessDisplay.startsWith('steam')) return;
    const clip = requestedDemonessClip(requested);
    if (this.demonessDisplay !== clip) {
      const next = clip === 'hold' && this.demonessDisplay === 'idle' ? 'cast' : clip;
      this.demonessDisplay = next;
      this.demonessAnimator.setClip(next, true);
    }
  }

  /** @param {number} dt */
  update(dt) {
    if (this.paused) return;
    const step = clamp(dt, 0, 0.05);
    if (this.servantDisplay !== 'hidden') this.servantAnimator.update(step);
    if (this.demonessDisplay !== 'hidden' && this.demonessDisplay !== 'silhouette' && this.demonessDisplay !== 'stage-exit') this.demonessAnimator.update(step);
    if (this.previousHostLevel > 0) for (const animator of Object.values(this.hostAnimators)) animator.update(step);
    if (this.servantDisplay === 'appearance' && this.servantAnimator.isComplete()) {
      this.servantDisplay = 'idle';
      this.servantAnimator.setClip(this.servantDisplay, true);
    }
    if (this.demonessDisplay === 'appearance' && this.demonessAnimator.isComplete()) {
      this.demonessDisplay = 'idle';
      this.demonessAnimator.setClip(this.demonessDisplay, true);
    }
    if (this.servantRecoveryRemaining > 0) {
      this.servantRecoveryRemaining = Math.max(0, this.servantRecoveryRemaining - step);
      this.servantStrength = 0;
      if (this.servantRecoveryRemaining > 0) {
        this.servantDisplay = 'recovery';
        this.servantAnimator.setClip('recovery');
      } else {
        // Capture the final recovery frame before switching the animator. If
        // idle is not decoded yet, activeFrame() keeps this exact pose stable.
        this.requestClipAsset('servant', 'idle');
        this.servantDisplay = 'idle';
        this.servantAnimator.setClip('idle');
        this.setServantState(this.servantRequested);
      }
    }
    if (this.demonessRecoveryRemaining > 0) {
      this.demonessRecoveryRemaining = Math.max(0, this.demonessRecoveryRemaining - step);
      this.demonessStrength = 0;
      this.demonessImpactStrength = 0;
      this.demonessSpellReach = 0;
      this.clearDemonessSteam();
      if (this.demonessRecoveryRemaining > 0) {
        this.demonessDisplay = 'recovery';
        this.demonessAnimator.setClip('recovery');
      } else {
        this.requestClipAsset('demoness', 'idle');
        this.demonessDisplay = 'idle';
        this.demonessAnimator.setClip('idle');
        this.setDemonessState(this.demonessRequested);
      }
    }
    if (this.demonessExitRemaining > 0) {
      this.demonessExitRemaining = Math.max(0, this.demonessExitRemaining - step);
      this.demonessStrength = 0;
      this.demonessImpactStrength = 0;
      this.demonessSpellReach = 0;
      this.clearDemonessSteam();
      if (this.demonessExitRemaining === 0) this.setDemonessState(this.demonessRequested);
    }
    if (this.demonessDisplay === 'disapproval' && this.demonessAnimator.isComplete()) {
      this.demonessDisplay = 'idle';
      this.requestClipAsset('demoness', 'idle');
      this.demonessAnimator.setClip('idle', true);
      this.demonessDisapprovalCount += 1;
      this.demonessNextDisapproval = DEMONESS_DISAPPROVAL_INTERVALS[this.demonessDisapprovalCount % DEMONESS_DISAPPROVAL_INTERVALS.length];
    }
    if (this.demonessDisplay === 'idle' && this.demonessRevealed) {
      this.demonessIdleTime += step;
      this.demonessNextDisapproval -= step;
      if (this.demonessNextDisapproval <= 0) {
        this.demonessDisplay = 'disapproval';
        this.demonessAnimator.setClip('disapproval', true);
      }
    }
    if (this.hostEntryAge < 1.5) this.hostEntryAge = Math.min(1.5, this.hostEntryAge + step);
  }

  getFlameReaction() {
    const servant = this.servantStrength;
    const inhale = this.servantInhaleStrength;
    const demoness = this.demonessImpactStrength;
    return Object.freeze({
      bend: clamp(servant - inhale * 0.18 - demoness * 0.58, -0.58, 1),
      suppression: clamp(servant * 0.08 + inhale * 0.03 + demoness * 0.2, 0, 0.24),
      emberDrift: servant,
      inhalePull: inhale,
      cold: demoness,
      source: servant > 0 && demoness > 0 ? 'combined' : servant > 0 ? 'servant-steam' : inhale > 0 ? 'servant-inhale' : demoness > 0 ? 'demoness-steam' : 'none',
    });
  }

  /** @param {{x:number,y:number}} target */
  setFlameTarget(target) {
    this.flameTarget = Object.freeze({ x: Number(target.x) || 540, y: Number(target.y) || 1_050 });
    this.spellGeometry = Object.freeze({ ...this.spellGeometry, target: this.flameTarget });
  }

  /** @param {CanvasRenderingContext2D} context @param {any} state @param {number} timeSeconds */
  draw(context, state, timeSeconds) {
    this.servantSteamOptions = null;
    this.demonessSteamOptions = null;
    if (state.hostLevel > 0) {
      context.save();
      const entryLinear = state.hostLevel === 2 && this.hostEntryAge < 1.5 ? clamp(this.hostEntryAge / 1.5, 0, 1) : 1;
      const entry = entryLinear * entryLinear * (3 - 2 * entryLinear);
      context.globalAlpha = state.hostLevel === 1 ? 0.58 : 0.24 + entry * 0.76;
      context.filter = state.hostLevel === 1 ? 'brightness(.78) contrast(1.08) saturate(.9) drop-shadow(0 0 16px rgba(175,49,23,.46))' : 'brightness(1.34) contrast(1.16) saturate(1.2) drop-shadow(0 0 28px rgba(255,103,42,.82))';
      if (state.hostLevel === 1) { context.beginPath(); context.rect(0, 720, 1080, 620); context.clip(); }
      const hostParts = [
        { key: 'sentinel', region: INFERNO_HOST_REGIONS[0], anchorX: 540, anchorY: 900, width: 330, height: 360 },
        { key: 'main', region: INFERNO_HOST_REGIONS[1], anchorX: 655, anchorY: 1_285, width: 720, height: 650 },
      ];
      for (const part of hostParts) {
        const bitmap = this.hostBitmaps[part.key];
        if (!bitmap.image || !bitmap.isReady()) continue;
        const motion = hostMotionForRegion(part.region, timeSeconds, Boolean(state.reducedMotion));
        drawSpriteFrame(context, bitmap.image, this.hostAnimators[part.key].getFrame(), {
          anchorX: part.anchorX,
          anchorY: part.anchorY + (1 - entry) * 32 + motion.hover,
          width: part.width,
          height: part.height,
          pivot: [0.5, 1],
          scaleX: (0.94 + entry * 0.06) * motion.scaleX,
          scaleY: (0.94 + entry * 0.06) * motion.scaleY,
          rotation: motion.rotation,
        });
      }
      context.restore();
    }

    const demonessBitmap = this.activeBitmap('demoness');
    if (this.demonessVisible && demonessBitmap.image && demonessBitmap.isReady()) {
      const active = this.demonessStrength > 0 || this.demonessDisplay === 'arms-rise' || this.demonessDisplay.startsWith('cast');
      const silhouette = this.demonessDisplay === 'silhouette';
      const placement = DEMONESS_PLACEMENT;
      const disapproval = this.demonessDisplay === 'disapproval' ? demonessDisapprovalGesture(this.demonessAnimator.elapsed) : null;
      const exitVisual = demonessExitVisual(this.getDemonessExitProgress());
      const demonessFilter = silhouette
        ? 'brightness(.12) saturate(.45)'
        : this.demonessDisplay === 'stage-exit'
          ? `brightness(${exitVisual.brightness.toFixed(3)}) contrast(${exitVisual.contrast.toFixed(3)}) saturate(${exitVisual.saturation.toFixed(3)}) drop-shadow(0 0 ${exitVisual.shadowBlur}px rgba(192,55,28,${exitVisual.shadowAlpha.toFixed(3)}))`
          : active ? 'brightness(1.08) contrast(1.14) saturate(1.02) drop-shadow(0 0 5px rgba(230,176,136,.35))' : 'brightness(1.08) contrast(1.1) saturate(1.04) drop-shadow(0 0 7px rgba(192,55,28,.3))';
      if (active) {
        context.save();
        context.globalCompositeOperation = 'screen';
        const castRim = context.createRadialGradient(placement.anchorX - 54, placement.anchorY - placement.height * 0.56, 24, placement.anchorX - 54, placement.anchorY - placement.height * 0.56, 310);
        castRim.addColorStop(0, `rgba(229,214,200,${0.07 + this.demonessStrength * 0.05})`);
        castRim.addColorStop(0.46, `rgba(184,157,138,${0.03 + this.demonessStrength * 0.03})`);
        castRim.addColorStop(1, 'rgba(90,72,64,0)');
        context.fillStyle = castRim;
        context.fillRect(placement.anchorX - 380, placement.anchorY - placement.height - 90, 660, placement.height + 120);
        context.restore();
      }
      drawTemporalCharacter(context, demonessBitmap.image, this.activeFrame('demoness'), {
        ...placement, pivot: DEMONESS_PIVOT, alpha: this.getDemonessOpacity(), filter: demonessFilter,
      });
      if (disapproval) drawDisapprovalCue(context, timeSeconds, placement, disapproval);
      if (this.demonessStrength > 0) {
        const snapshot = this.demonessAnimator.snapshot();
        const sockets = demonessHandSockets(snapshot.clip, snapshot.frame);
        const origins = Object.freeze({
          leftHand: Object.freeze(socketWorld(placement, sockets.leftHand, DEMONESS_PIVOT)),
          rightHand: Object.freeze(socketWorld(placement, sockets.rightHand, DEMONESS_PIVOT)),
        });
        const effectStrength = this.demonessStrength * (state.reducedMotion ? 0.6 : 1);
        const leftOptions = Object.freeze({
          time: timeSeconds, strength: effectStrength, source: origins.leftHand, target: this.flameTarget,
          reach: this.demonessSpellReach, reducedMotion: Boolean(state.reducedMotion), seed: 2,
          laneScale: 0.3, particleScale: 0.55, opacityScale: 1.35, sourceScale: 1.25,
        });
        const rightOptions = Object.freeze({
          time: timeSeconds, strength: effectStrength, source: origins.rightHand, target: this.flameTarget,
          reach: this.demonessSpellReach, reducedMotion: Boolean(state.reducedMotion), seed: 7,
          laneScale: 0.3, particleScale: 0.55, opacityScale: 1.35, sourceScale: 1.25,
        });
        this.demonessSteamOptions = Object.freeze({ left: leftOptions, right: rightOptions });
        const leftStream = steamStreamGeometry(leftOptions.source, leftOptions.target, leftOptions.reach);
        const rightStream = steamStreamGeometry(rightOptions.source, rightOptions.target, rightOptions.reach);
        const contact = leftStream.contact && rightStream.contact;
        this.spellGeometry = Object.freeze({
          origins,
          target: this.flameTarget,
          leading: Object.freeze({ leftHand: leftStream.leading, rightHand: rightStream.leading }),
          contact,
          contactPoint: contact ? this.flameTarget : null,
        });
      } else {
        this.spellGeometry = Object.freeze({ origins: null, target: this.flameTarget, leading: null, contact: false });
      }
    }

    const servantBitmap = this.activeBitmap('servant');
    if (this.servantVisible && servantBitmap.image && servantBitmap.isReady()) {
      const active = this.servantStrength > 0;
      const placement = SERVANT_PLACEMENT;
      context.save();
      context.globalCompositeOperation = 'screen';
      const rim = context.createRadialGradient(285, 920, 16, 285, 920, 260);
      rim.addColorStop(0, 'rgba(255,130,53,.2)');
      rim.addColorStop(1, 'rgba(255,76,20,0)');
      context.fillStyle = rim;
      context.fillRect(20, 610, 540, 650);
      context.restore();
      const appearanceOpacity = this.servantDisplay === 'appearance'
        ? smoothstep(this.servantAnimator.elapsed / SERVANT_APPEARANCE_DURATION)
        : 1;
      drawTemporalCharacter(context, servantBitmap.image, this.activeFrame('servant'), {
        ...placement, pivot: SERVANT_PIVOT, alpha: 0.98 * appearanceOpacity,
        filter: active ? 'brightness(1.28) contrast(1.08) saturate(1.12) drop-shadow(12px 0 24px rgba(255,132,52,.72))' : 'brightness(1.24) contrast(1.08) saturate(1.08) drop-shadow(0 0 22px rgba(255,126,45,.62))',
      });
      const snapshot = this.servantAnimator.snapshot();
      const mouth = socketWorld(placement, servantMouthSocket(snapshot.clip, snapshot.frame), SERVANT_PIVOT);
      if (this.servantInhaleStrength > 0) drawInhaleAir(context, timeSeconds, this.servantInhaleStrength * (state.reducedMotion ? 0.55 : 1), mouth);
      if (active) this.servantSteamOptions = Object.freeze({
        time: timeSeconds,
        strength: this.servantStrength * (state.reducedMotion ? 0.55 : 1),
        source: mouth,
        target: this.flameTarget,
        reducedMotion: Boolean(state.reducedMotion),
        tint: 'warm',
        seed: 11,
      });
    }
  }

  /** Draw vapor above the authored flame so anatomical sources remain Human-Eye readable. */
  drawSteamFx(context) {
    if (this.servantSteamOptions) drawSteamStream(context, this.servantSteamOptions);
    if (this.demonessSteamOptions) {
      drawSteamStream(context, this.demonessSteamOptions.left);
      drawSteamStream(context, this.demonessSteamOptions.right);
    }
  }

  /** Contact vapor starts only after both hand streams reach the live flame anchor. */
  /** @param {CanvasRenderingContext2D} context @param {number} timeSeconds @param {boolean=} reducedMotion */
  drawImpactFx(context, timeSeconds, reducedMotion = false) {
    if (this.demonessImpactStrength <= 0 || !this.spellGeometry.contact) return;
    const impactPoint = this.spellGeometry.contactPoint ?? this.flameTarget;
    const count = reducedMotion ? 3 : 5;
    context.save();
    context.globalCompositeOperation = 'screen';
    for (let index = 0; index < count; index += 1) {
      const age = ((timeSeconds * (0.38 + index * 0.009) + index * 0.137) % 1 + 1) % 1;
      const spread = Math.sin(index * 4.17) * (5 + age * 10);
      const x = impactPoint.x + spread;
      const y = impactPoint.y - age * (56 + index % 3 * 10);
      const radius = 4 + age * 7;
      context.fillStyle = `rgba(${218 + index % 3 * 5},${215 + index % 2 * 6},${208 + index % 2 * 7},${Math.pow(1 - age, 0.9) * 0.11 * this.demonessImpactStrength})`;
      context.shadowColor = 'rgba(232,226,218,.12)';
      context.shadowBlur = 7;
      context.beginPath();
      context.ellipse(x, y, radius * 1.25, radius, Math.sin(index) * 0.3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  getDiagnostics() {
    const disapproval = this.demonessDisplay === 'disapproval' ? demonessDisapprovalGesture(this.demonessAnimator.elapsed) : null;
    return Object.freeze({
      servant: Object.freeze({
        visible: this.servantVisible,
        state: this.servantDisplay,
        opacity: this.servantDisplay === 'appearance' ? 0.98 * smoothstep(this.servantAnimator.elapsed / SERVANT_APPEARANCE_DURATION) : this.servantVisible ? 0.98 : 0,
        temporal: this.servantAnimator.getBlendSample(),
        strength: this.servantStrength,
        inhaleStrength: this.servantInhaleStrength,
        recoveryMs: Math.round(this.servantRecoveryRemaining * 1_000),
        anchor: [SERVANT_PLACEMENT.anchorX, SERVANT_PLACEMENT.anchorY],
        size: [SERVANT_PLACEMENT.width, SERVANT_PLACEMENT.height],
        effect: this.servantStrength > 0 ? 'steam' : 'none',
        mouthSocket: servantMouthSocket(this.servantAnimator.clipName, this.servantAnimator.getFrameIndex()),
        ...this.servantAnimator.snapshot(),
        asset: this.activeBitmap('servant').status,
        assetClip: this.servantReadyKey,
        residentClips: Object.entries(this.servantBitmaps).filter(([, bitmap]) => bitmap.isReady()).map(([clip]) => clip),
      }),
      demoness: Object.freeze({
        visible: this.demonessVisible,
        revealed: this.demonessRevealed,
        state: this.demonessDisplay,
        steamStrength: this.demonessStrength,
        impactStrength: this.demonessImpactStrength,
        spellReach: this.demonessSpellReach,
        recoveryMs: Math.round(this.demonessRecoveryRemaining * 1_000),
        exitMs: Math.round(this.demonessExitRemaining * 1_000),
        opacity: this.getDemonessOpacity(),
        exitVisual: demonessExitVisual(this.getDemonessExitProgress()),
        temporal: this.demonessAnimator.getBlendSample(),
        idleTime: this.demonessIdleTime,
        disapprovalCount: this.demonessDisapprovalCount,
        nextDisapprovalMs: Math.max(0, Math.round(this.demonessNextDisapproval * 1_000)),
        disapprovalPhase: disapproval?.phase ?? null,
        headOffset: disapproval?.headOffset ?? 0,
        effect: this.demonessStrength > 0 ? 'steam' : 'none',
        handSockets: demonessHandSockets(this.demonessAnimator.clipName, this.demonessAnimator.getFrameIndex()),
        anchor: [DEMONESS_PLACEMENT.anchorX, DEMONESS_PLACEMENT.anchorY],
        size: [DEMONESS_PLACEMENT.width, DEMONESS_PLACEMENT.height],
        spell: this.spellGeometry,
        ...this.demonessAnimator.snapshot(),
        asset: this.activeBitmap('demoness').status,
        assetClip: this.demonessReadyKey,
        residentClips: Object.entries(this.demonessBitmaps).filter(([, bitmap]) => bitmap.isReady()).map(([clip]) => clip),
      }),
      host: Object.freeze({
        asset: Object.values(this.hostBitmaps).every((bitmap) => bitmap.isReady()) ? 'ready' : Object.values(this.hostBitmaps).some((bitmap) => bitmap.status === 'loading') ? 'loading' : 'idle',
        regions: INFERNO_HOST_REGIONS.length,
        authoredFrames: 5,
        frames: Object.freeze(Object.fromEntries(Object.entries(this.hostAnimators).map(([key, animator]) => [key, animator.getFrameIndex()]))),
        parts: Object.freeze(Object.fromEntries(Object.entries(this.hostBitmaps).map(([key, bitmap]) => [key, bitmap.status]))),
        wholePlateOnly: false,
        entryProgress: this.hostEntryAge < 1.5 ? this.hostEntryAge / 1.5 : 1,
        entryDurationMs: 1_500,
      }),
      reaction: this.getFlameReaction(),
    });
  }

  getDemonessExitProgress() {
    return this.demonessExitRemaining > 0
      ? clamp(1 - this.demonessExitRemaining / DEMONESS_STAGE_EXIT_DURATION, 0, 1)
      : this.demonessDisplay === 'silhouette' ? 1 : 0;
  }

  getDemonessOpacity() {
    if (!this.demonessVisible) return 0;
    if (this.demonessDisplay === 'silhouette') return 0.5;
    if (this.demonessDisplay === 'stage-exit') return demonessExitVisual(this.getDemonessExitProgress()).opacity;
    return 0.97;
  }
}
