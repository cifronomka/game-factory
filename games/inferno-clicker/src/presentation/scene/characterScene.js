// @ts-check

import { OptionalBitmap } from './optionalBitmap.js';
import { SpriteAnimator, drawSpriteFrame, gridFrames } from './spriteAnimator.js';

export const ASH_SERVANT_ATLAS_URL = new URL('../../../assets/characters/ash-servant/ash-servant-states-v3.webp', import.meta.url).href;
export const DEMONESS_ATLAS_URL = new URL('../../../assets/characters/demoness/demoness-states-v3.webp', import.meta.url).href;
export const INFERNO_HOST_URL = new URL('../../../assets/characters/character-inferno-host.webp', import.meta.url).href;

const CELL_WIDTH = 256;
const CELL_HEIGHT = 280;
const CHARACTER_PIVOT = Object.freeze([0.5, 272 / CELL_HEIGHT]);
const ROW = Object.freeze({ appearance: 0, idle: 1, actionA: 2, actionB: 3 });
/** @param {number} row */
function rowFrames(row) { return gridFrames(6, 6, CELL_WIDTH, CELL_HEIGHT).map((frame) => Object.freeze({ ...frame, y: row * CELL_HEIGHT })); }
/** @param {readonly any[]} frames */
function reverseFrames(frames) { return Object.freeze([...frames].reverse()); }

const servantInhale = rowFrames(ROW.actionA);
const servantBlow = rowFrames(ROW.actionB);
const demonessCast = rowFrames(ROW.actionA);
const demonessIdle = rowFrames(ROW.idle);
const SERVANT_CLIPS = Object.freeze({
  appearance: Object.freeze({ fps: 10, loop: false, frames: rowFrames(ROW.appearance) }),
  idle: Object.freeze({ fps: 4, loop: true, frames: rowFrames(ROW.idle) }),
  inhale: Object.freeze({ fps: 10, loop: false, frames: servantInhale }),
  blow: Object.freeze({ fps: 10, loop: true, frames: servantBlow }),
  'inhale-settle': Object.freeze({ fps: 10, loop: false, frames: reverseFrames(servantInhale) }),
  'blow-settle': Object.freeze({ fps: 10, loop: false, frames: reverseFrames(servantBlow) }),
});
const DEMONESS_CLIPS = Object.freeze({
  appearance: Object.freeze({ fps: 10, loop: false, frames: rowFrames(ROW.appearance) }),
  idle: Object.freeze({ fps: 1.2, loop: true, frames: demonessIdle }),
  // Keep the body calm and stable. The readable "no" gesture is a restrained
  // head/gaze overlay, not a shuffled sequence of unrelated body poses.
  disapproval: Object.freeze({ fps: 3, loop: false, frames: Object.freeze([
    demonessIdle[0], demonessIdle[0], demonessIdle[0], demonessIdle[0], demonessIdle[0], demonessIdle[0],
  ]) }),
  cast: Object.freeze({ fps: 10, loop: false, frames: demonessCast }),
  hold: Object.freeze({ fps: 10, loop: true, frames: rowFrames(ROW.actionB) }),
  settle: Object.freeze({ fps: 10, loop: false, frames: reverseFrames(demonessCast) }),
});

const SERVANT_MOUTH = Object.freeze([0.65, 0.31]);
const DEMONESS_CAST_HAND = Object.freeze([
  Object.freeze([0.25, 0.32]), Object.freeze([0.24, 0.30]), Object.freeze([0.23, 0.28]),
  Object.freeze([0.22, 0.27]), Object.freeze([0.22, 0.26]), Object.freeze([0.22, 0.26]),
]);
const DEMONESS_HOLD_HAND = Object.freeze([
  Object.freeze([0.20, 0.29]), Object.freeze([0.20, 0.29]), Object.freeze([0.19, 0.29]),
  Object.freeze([0.19, 0.28]), Object.freeze([0.19, 0.28]), Object.freeze([0.20, 0.29]),
]);
const DEMONESS_DISAPPROVAL_INTERVALS = Object.freeze([6.4, 8.2, 5.6, 7.3]);

export const INFERNO_HOST_REGIONS = Object.freeze([
  Object.freeze({ id: 'left-wing', x: 0, y: 0, w: 340, h: 360, phase: 0.0, period: 7.7, amplitude: 5, role: 'wing' }),
  Object.freeze({ id: 'left-watchers', x: 0, y: 360, w: 340, h: 323, phase: 1.2, period: 6.1, amplitude: 3.5, role: 'watchers' }),
  Object.freeze({ id: 'crown', x: 340, y: 0, w: 344, h: 683, phase: 2.4, period: 8.9, amplitude: 3, role: 'crown' }),
  Object.freeze({ id: 'right-wing', x: 684, y: 0, w: 340, h: 360, phase: 3.6, period: 7.1, amplitude: 5, role: 'wing' }),
  Object.freeze({ id: 'right-watchers', x: 684, y: 360, w: 340, h: 323, phase: 4.8, period: 5.5, amplitude: 3.5, role: 'watchers' }),
]);

/** @param {typeof INFERNO_HOST_REGIONS[number]} region @param {number} time @param {boolean} reducedMotion */
export function hostMotionForRegion(region, time, reducedMotion) {
  const motionTime = reducedMotion ? time * 0.55 : time;
  const motionScale = reducedMotion ? 0.22 : 1;
  const wave = Math.sin(motionTime * Math.PI * 2 / region.period + region.phase);
  const breath = Math.sin(motionTime * Math.PI * 2 / (region.period * 1.37) + region.phase * 0.61);
  return Object.freeze({
    hover: wave * region.amplitude * motionScale,
    scaleX: 1 + breath * (region.role === 'wing' ? 0.009 : 0.004) * motionScale,
    scaleY: 1 + breath * (region.role === 'crown' ? 0.006 : 0.003) * motionScale,
    rotation: !reducedMotion && region.role === 'wing' ? wave * (region.id.startsWith('left') ? -0.007 : 0.007) : 0,
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
export function demonessHandSocket(clip, frame) {
  const sockets = clip === 'hold' ? DEMONESS_HOLD_HAND : DEMONESS_CAST_HAND;
  return sockets[Math.max(0, Math.min(sockets.length - 1, frame))];
}

/** @param {{anchorX:number,anchorY:number,width:number,height:number}} placement @param {readonly number[]} socket */
function socketWorld(placement, socket) {
  return {
    x: placement.anchorX + (socket[0] - CHARACTER_PIVOT[0]) * placement.width,
    y: placement.anchorY + (socket[1] - CHARACTER_PIVOT[1]) * placement.height,
  };
}

/** @param {CanvasRenderingContext2D} context @param {number} time @param {number} strength @param {{x:number,y:number}} start */
function drawDirectedAsh(context, time, strength, start) {
  const target = { x: 540, y: 1_145 };
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  context.shadowColor = `rgba(244,155,83,${0.4 * strength})`;
  context.shadowBlur = 8;
  for (let index = 0; index < 24; index += 1) {
    const phase = time * (1.7 + (index % 4) * 0.11) + index * 1.91;
    const progress = ((phase % 1.8) + 1.8) % 1.8 / 1.8;
    const x = start.x + (target.x - start.x) * progress;
    const y = start.y + (target.y - start.y) * progress + Math.sin(phase * 5.1) * (8 + index * 0.45);
    context.strokeStyle = index % 3 === 0
      ? `rgba(245,178,107,${(1 - progress) * 0.48 * strength})`
      : `rgba(171,137,105,${(1 - progress) * 0.38 * strength})`;
    context.lineWidth = 2.5 + (index % 5);
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + 22, y - 9, x + 42, y + Math.sin(phase * 3) * 7);
    context.stroke();
  }
  context.restore();
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

/**
 * Renders a local head/crown crop while the rest of the body stays fixed.
 * This avoids a whole-body transform masquerading as a head gesture.
 * @param {CanvasRenderingContext2D} context
 * @param {HTMLImageElement} image
 * @param {{x:number,y:number,w:number,h:number}} frame
 * @param {{anchorX:number,anchorY:number,width:number,height:number}} placement
 * @param {{phase:string,headOffset:number,headTilt:number}} gesture
 * @param {string} filter
 */
function renderCrownGesture(context, image, frame, placement, gesture, filter) {
  const source = { x: frame.x + 88, y: frame.y, w: 80, h: 88 };
  const fullX = placement.anchorX - placement.width * CHARACTER_PIVOT[0];
  const fullY = placement.anchorY - placement.height * CHARACTER_PIVOT[1];
  const scaleX = placement.width / frame.w;
  const scaleY = placement.height / frame.h;
  const head = {
    x: fullX + 88 * scaleX,
    y: fullY,
    w: source.w * scaleX,
    h: source.h * scaleY,
  };
  context.save();
  context.beginPath();
  context.rect(-2_000, -2_000, 5_000, 6_000);
  context.rect(head.x, head.y, head.w, head.h);
  context.clip('evenodd');
  drawSpriteFrame(context, image, frame, { ...placement, pivot: CHARACTER_PIVOT, alpha: 0.97, filter });
  context.restore();

  context.save();
  context.globalAlpha *= 0.97;
  context.filter = filter;
  context.translate(head.x + head.w / 2 + gesture.headOffset * 6, head.y + head.h / 2);
  context.rotate(gesture.headTilt);
  context.drawImage(image, source.x, source.y, source.w, source.h, -head.w / 2, -head.h / 2, head.w, head.h);
  context.restore();
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

/** @param {CanvasRenderingContext2D} context @param {number} time @param {number} strength @param {{x:number,y:number}} start */
function drawColdRibbon(context, time, strength, start) {
  const target = { x: 560, y: 1_165 };
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  for (let pass = 0; pass < 3; pass += 1) {
    const wobble = Math.sin(time * 2.4 + pass * 1.7) * 18;
    context.strokeStyle = `rgba(${105 + pass * 18},${196 + pass * 12},${206 + pass * 12},${0.18 * strength})`;
    context.lineWidth = 9 - pass * 2;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.bezierCurveTo(start.x - 70, start.y + 90 + wobble, 690, 1_010 - wobble, target.x, target.y);
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

/** Authoritative Cycle 04 telegraph/effect phase mapper. */
export function servantTemporalPhase(encounter) {
  if (!encounter) return Object.freeze({ phase: 'idle', strength: 0, frame: 0 });
  const progress = clamp(Number(encounter.progress) || 0, 0, 1);
  if (encounter.phase === 'telegraph') {
    if (progress < 0.15) return Object.freeze({ phase: 'prepare', strength: 0, frame: 0 });
    if (progress < 0.7) return Object.freeze({ phase: 'inhale-ramp', strength: 0, frame: Math.min(4, 1 + Math.floor(ramp(progress, 0.15, 0.7) * 4)) });
    return Object.freeze({ phase: 'inhale-hold', strength: 0, frame: 5 });
  }
  if (progress < 0.1) return Object.freeze({ phase: 'exhale-start', strength: ramp(progress, 0, 0.1) * 0.3, frame: 0 });
  if (progress < 0.36) return Object.freeze({ phase: 'exhale-ramp', strength: 0.3 + ramp(progress, 0.1, 0.36) * 0.7, frame: Math.min(4, 1 + Math.floor(ramp(progress, 0.1, 0.36) * 4)) });
  if (progress < 0.68) return Object.freeze({ phase: 'exhale-peak', strength: 1, frame: 5 });
  if (progress < 0.9) return Object.freeze({ phase: 'exhale-fade', strength: 1 - ramp(progress, 0.68, 0.9) * 0.8, frame: Math.max(1, 5 - Math.floor(ramp(progress, 0.68, 0.9) * 4)) });
  return Object.freeze({ phase: 'exhale-end', strength: 0.2 * (1 - ramp(progress, 0.9, 1)), frame: 0 });
}

/** Authoritative Cycle 04 Demoness telegraph/effect phase mapper. */
export function demonessTemporalPhase(encounter) {
  if (!encounter) return Object.freeze({ phase: 'idle', strength: 0, frame: 0 });
  const progress = clamp(Number(encounter.progress) || 0, 0, 1);
  if (encounter.phase === 'telegraph') {
    if (progress < 0.175) return Object.freeze({ phase: 'cast-look', strength: 0, frame: 0 });
    if (progress < 0.675) return Object.freeze({ phase: 'arms-rise', strength: ramp(progress, 0.175, 0.675) * 0.2, frame: Math.min(4, 1 + Math.floor(ramp(progress, 0.175, 0.675) * 4)) });
    return Object.freeze({ phase: 'cast-gather', strength: 0.2 + ramp(progress, 0.675, 1) * 0.25, frame: 5 });
  }
  if (progress < 0.125) return Object.freeze({ phase: 'cold-ramp', strength: 0.45 + ramp(progress, 0, 0.125) * 0.55, frame: Math.min(4, Math.floor(ramp(progress, 0, 0.125) * 5)) });
  if (progress < 0.8) return Object.freeze({ phase: 'cold-hold', strength: 1, frame: 5 });
  return Object.freeze({ phase: 'cold-release', strength: 1 - ramp(progress, 0.8, 1), frame: Math.max(0, 5 - Math.floor(ramp(progress, 0.8, 1) * 6)) });
}

/** Authored character state atlases with stable root anchors and spatially independent Inferno host regions. */
export class CharacterScene {
  /** @param {{imageFactory?:(()=>HTMLImageElement|null)}=} options */
  constructor(options = {}) {
    this.servantBitmap = new OptionalBitmap(ASH_SERVANT_ATLAS_URL, { ...options, autoLoad: false });
    this.demonessBitmap = new OptionalBitmap(DEMONESS_ATLAS_URL, { ...options, autoLoad: false });
    this.hostBitmap = new OptionalBitmap(INFERNO_HOST_URL, { ...options, autoLoad: false });
    this.servantAnimator = new SpriteAnimator(SERVANT_CLIPS, 'appearance');
    this.demonessAnimator = new SpriteAnimator(DEMONESS_CLIPS, 'appearance');
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
    this.servantRecoveryRemaining = 0;
    this.demonessRecoveryRemaining = 0;
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

  /** @param {any} state */
  setState(state) {
    if ((state.stage === 2 && state.stageProgress >= 0.6) || state.stage > 2) this.servantBitmap.startLoad();
    if ((state.stage === 3 && state.stageProgress >= 0.6) || state.stage > 3) this.demonessBitmap.startLoad();
    if ((state.stage === 5 && state.stageProgress >= 0.6) || state.stage > 5) this.hostBitmap.startLoad();
    this.paused = Boolean(state.paused);
    if (state.hostLevel === 2 && this.previousHostLevel < 2) this.hostEntryAge = 0;
    this.previousHostLevel = state.hostLevel;
    this.servantAnimator.setPaused(this.paused);
    this.demonessAnimator.setPaused(this.paused);
    const encounters = Array.isArray(state.encounters) ? state.encounters : [];
    const servantEncounter = encounters.find((item) => item.kind === 'servant') ?? null;
    const demonessEncounter = encounters.find((item) => item.kind === 'demoness') ?? null;
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
    if (!servantEnding && this.servantRecoveryRemaining <= 0) this.setServantState(servantRequested);
    if (!demonessEnding && this.demonessRecoveryRemaining <= 0) this.setDemonessState(demonessRequested);
    this.servantInhaleStrength = servantEncounter?.phase === 'telegraph'
      ? servantEncounter.progress < 0.15 ? 0 : servantEncounter.progress < 0.7 ? ramp(servantEncounter.progress, 0.15, 0.7) : 0.35
      : 0;

    if (servantEnding) {
      this.servantRecoveryRemaining = 0.45;
      this.servantVisible = true;
      this.servantDisplay = 'recovery';
      this.servantStrength = 0;
      this.servantAnimator.setClip('blow-settle', true);
    }
    if (demonessEnding) {
      this.demonessRecoveryRemaining = 0.8;
      this.demonessVisible = true;
      this.demonessRevealed = true;
      this.demonessDisplay = 'recovery';
      this.demonessStrength = 0;
      this.demonessAnimator.setClip('settle', true);
    }
    this.servantWasActive = Boolean(servantEncounter?.phase === 'active');
    this.demonessWasActive = Boolean(demonessEncounter?.phase === 'active');

    if (this.servantDisplay !== 'appearance' && servantEncounter) {
      const temporal = servantTemporalPhase(servantEncounter);
      const clip = servantEncounter.phase === 'telegraph' ? 'inhale' : 'blow';
      this.servantDisplay = temporal.phase;
      this.servantStrength = temporal.strength;
      this.servantAnimator.setClip(clip);
      this.servantAnimator.elapsed = temporal.frame / this.servantAnimator.clip.fps;
    } else if (!servantEncounter && this.servantRecoveryRemaining <= 0 && this.servantDisplay !== 'appearance') {
      this.servantStrength = 0;
    }

    if (this.demonessDisplay !== 'appearance' && this.demonessDisplay !== 'silhouette' && demonessEncounter) {
      const temporal = demonessTemporalPhase(demonessEncounter);
      const clip = demonessEncounter.phase === 'telegraph' ? 'cast' : 'hold';
      this.demonessDisplay = temporal.phase;
      this.demonessStrength = temporal.strength;
      this.demonessAnimator.setClip(clip);
      this.demonessAnimator.elapsed = temporal.frame / this.demonessAnimator.clip.fps;
    } else if (!demonessEncounter && this.demonessRecoveryRemaining <= 0 && this.demonessDisplay !== 'appearance' && this.demonessDisplay !== 'silhouette') {
      this.demonessStrength = 0;
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
      return;
    }
    if (requested === 'silhouette') {
      this.demonessVisible = true;
      this.demonessRevealed = false;
      this.demonessDisplay = 'silhouette';
      this.demonessAnimator.setClip('appearance', true);
      return;
    }
    this.demonessVisible = true;
    if (!this.demonessRevealed) {
      this.demonessRevealed = true;
      this.demonessDisplay = 'appearance';
      this.demonessAnimator.setClip('appearance', true);
      return;
    }
    if (this.demonessDisplay === 'appearance' || this.demonessDisplay === 'recovery') return;
    if (this.demonessDisplay === 'disapproval' && requested === 'idle') return;
    if (this.demonessDisplay === 'cast' && requested === 'hold') return;
    if (this.demonessDisplay.startsWith('cast') || this.demonessDisplay === 'arms-rise' || this.demonessDisplay.startsWith('cold')) return;
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
    if (this.demonessDisplay !== 'hidden' && this.demonessDisplay !== 'silhouette') this.demonessAnimator.update(step);
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
      this.servantDisplay = this.servantRecoveryRemaining > 0 ? 'recovery' : 'idle';
      this.servantStrength = 0;
      this.servantAnimator.setClip(this.servantRecoveryRemaining > 0 ? 'blow-settle' : 'idle');
      if (this.servantRecoveryRemaining === 0) this.setServantState(this.servantRequested);
    }
    if (this.demonessRecoveryRemaining > 0) {
      this.demonessRecoveryRemaining = Math.max(0, this.demonessRecoveryRemaining - step);
      this.demonessDisplay = this.demonessRecoveryRemaining > 0 ? 'recovery' : 'idle';
      this.demonessStrength = 0;
      this.demonessAnimator.setClip(this.demonessRecoveryRemaining > 0 ? 'settle' : 'idle');
      if (this.demonessRecoveryRemaining === 0) this.setDemonessState(this.demonessRequested);
    }
    if (this.demonessDisplay === 'disapproval' && this.demonessAnimator.isComplete()) {
      this.demonessDisplay = 'idle';
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
    const demoness = this.demonessStrength;
    return Object.freeze({
      bend: clamp(servant - inhale * 0.18 - demoness * 0.58, -0.58, 1),
      suppression: clamp(servant * 0.08 + inhale * 0.03 + demoness * 0.2, 0, 0.24),
      emberDrift: servant,
      inhalePull: inhale,
      cold: demoness,
      source: servant > 0 && demoness > 0 ? 'combined' : servant > 0 ? 'servant-blow' : inhale > 0 ? 'servant-inhale' : demoness > 0 ? 'demoness-hold' : 'none',
    });
  }

  /** @param {CanvasRenderingContext2D} context @param {any} state @param {number} timeSeconds */
  draw(context, state, timeSeconds) {
    if (state.hostLevel > 0 && this.hostBitmap.image && this.hostBitmap.isReady()) {
      const image = this.hostBitmap.image;
      const scale = 1080 / 1024;
      const originY = 515;
      context.save();
      const entryLinear = state.hostLevel === 2 && this.hostEntryAge < 1.5 ? clamp(this.hostEntryAge / 1.5, 0, 1) : 1;
      const entry = entryLinear * entryLinear * (3 - 2 * entryLinear);
      context.globalAlpha = state.hostLevel === 1 ? 0.58 : 0.24 + entry * 0.76;
      context.filter = state.hostLevel === 1 ? 'brightness(.78) contrast(1.08) saturate(.9) drop-shadow(0 0 16px rgba(175,49,23,.46))' : 'brightness(1.34) contrast(1.16) saturate(1.2) drop-shadow(0 0 28px rgba(255,103,42,.82))';
      if (state.hostLevel === 1) { context.beginPath(); context.rect(0, 720, 1080, 620); context.clip(); }
      for (const region of INFERNO_HOST_REGIONS) {
        const motion = hostMotionForRegion(region, timeSeconds, Boolean(state.reducedMotion));
        const width = region.w * scale;
        const height = region.h * scale;
        const side = region.id.startsWith('left') ? -1 : region.id.startsWith('right') ? 1 : 0;
        const centerX = region.x * scale + width / 2 + side * (1 - entry) * 36;
        const centerY = originY + region.y * scale + height / 2 + motion.hover + (1 - entry) * (region.role === 'crown' ? -24 : 18);
        context.save();
        context.translate(centerX, centerY);
        context.rotate(motion.rotation);
        const entryScale = 0.94 + entry * 0.06;
        context.scale(motion.scaleX * entryScale, motion.scaleY * entryScale);
        context.drawImage(image, region.x, region.y, region.w, region.h, -width / 2, -height / 2, width, height);
        context.restore();
      }
      context.restore();
    }

    if (this.demonessVisible && this.demonessBitmap.image && this.demonessBitmap.isReady()) {
      const active = this.demonessStrength > 0 || this.demonessDisplay === 'arms-rise' || this.demonessDisplay.startsWith('cast');
      const silhouette = this.demonessDisplay === 'silhouette';
      const placement = { anchorX: 825, anchorY: 1_235, width: 600, height: 656 };
      const disapproval = this.demonessDisplay === 'disapproval' ? demonessDisapprovalGesture(this.demonessAnimator.elapsed) : null;
      const demonessFilter = silhouette ? 'brightness(.12) saturate(.45)' : active ? 'brightness(.96) saturate(.92) drop-shadow(0 0 24px rgba(70,190,180,.55))' : 'brightness(1.12) saturate(1.05) drop-shadow(0 0 22px rgba(192,55,28,.5))';
      if (disapproval) renderCrownGesture(context, this.demonessBitmap.image, this.demonessAnimator.getFrame(), placement, disapproval, demonessFilter);
      else drawSpriteFrame(context, this.demonessBitmap.image, this.demonessAnimator.getFrame(), {
        ...placement, pivot: CHARACTER_PIVOT, alpha: silhouette ? 0.5 : 0.97, filter: demonessFilter,
      });
      if (disapproval) drawDisapprovalCue(context, timeSeconds, placement, disapproval);
      if (this.demonessStrength > 0) {
        const snapshot = this.demonessAnimator.snapshot();
        drawColdRibbon(context, timeSeconds, this.demonessStrength * (state.reducedMotion ? 0.6 : 1), socketWorld(placement, demonessHandSocket(snapshot.clip, snapshot.frame)));
      }
    }

    if (this.servantVisible && this.servantBitmap.image && this.servantBitmap.isReady()) {
      const active = this.servantStrength > 0;
      const placement = { anchorX: 300, anchorY: 1_225, width: 540, height: 590 };
      context.save();
      context.globalCompositeOperation = 'screen';
      const rim = context.createRadialGradient(285, 920, 16, 285, 920, 260);
      rim.addColorStop(0, 'rgba(255,130,53,.2)');
      rim.addColorStop(1, 'rgba(255,76,20,0)');
      context.fillStyle = rim;
      context.fillRect(20, 610, 540, 650);
      context.restore();
      drawSpriteFrame(context, this.servantBitmap.image, this.servantAnimator.getFrame(), {
        ...placement, pivot: CHARACTER_PIVOT, alpha: 0.98,
        filter: active ? 'brightness(1.28) contrast(1.08) saturate(1.12) drop-shadow(12px 0 24px rgba(255,132,52,.72))' : 'brightness(1.24) contrast(1.08) saturate(1.08) drop-shadow(0 0 22px rgba(255,126,45,.62))',
      });
      if (this.servantInhaleStrength > 0) drawInhaleAir(context, timeSeconds, this.servantInhaleStrength * (state.reducedMotion ? 0.55 : 1), socketWorld(placement, SERVANT_MOUTH));
      if (active) drawDirectedAsh(context, timeSeconds, this.servantStrength * (state.reducedMotion ? 0.55 : 1), socketWorld(placement, SERVANT_MOUTH));
    }
  }

  getDiagnostics() {
    const disapproval = this.demonessDisplay === 'disapproval' ? demonessDisapprovalGesture(this.demonessAnimator.elapsed) : null;
    return Object.freeze({
      servant: Object.freeze({ visible: this.servantVisible, state: this.servantDisplay, strength: this.servantStrength, inhaleStrength: this.servantInhaleStrength, recoveryMs: Math.round(this.servantRecoveryRemaining * 1_000), anchor: [300, 1_225], ...this.servantAnimator.snapshot(), asset: this.servantBitmap.status }),
      demoness: Object.freeze({ visible: this.demonessVisible, revealed: this.demonessRevealed, state: this.demonessDisplay, coldStrength: this.demonessStrength, recoveryMs: Math.round(this.demonessRecoveryRemaining * 1_000), idleTime: this.demonessIdleTime, disapprovalCount: this.demonessDisapprovalCount, nextDisapprovalMs: Math.max(0, Math.round(this.demonessNextDisapproval * 1_000)), disapprovalPhase: disapproval?.phase ?? null, headOffset: disapproval?.headOffset ?? 0, handSocket: demonessHandSocket(this.demonessAnimator.clipName, this.demonessAnimator.getFrameIndex()), anchor: [825, 1_235], size: [600, 656], ...this.demonessAnimator.snapshot(), asset: this.demonessBitmap.status }),
      host: Object.freeze({ asset: this.hostBitmap.status, regions: INFERNO_HOST_REGIONS.length, wholePlateOnly: false, entryProgress: this.hostEntryAge < 1.5 ? this.hostEntryAge / 1.5 : 1, entryDurationMs: 1_500 }),
      reaction: this.getFlameReaction(),
    });
  }
}
