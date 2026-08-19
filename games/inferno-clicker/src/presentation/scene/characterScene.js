// @ts-check

import { OptionalBitmap } from './optionalBitmap.js';
import { SpriteAnimator, drawSpriteFrame, gridFrames } from './spriteAnimator.js';

export const ASH_SERVANT_ATLAS_URL = new URL('../../../assets/characters/ash-servant/ash-servant-states-v2.webp', import.meta.url).href;
export const DEMONESS_ATLAS_URL = new URL('../../../assets/characters/demoness/demoness-states-v2.webp', import.meta.url).href;
export const INFERNO_HOST_URL = new URL('../../../assets/characters/character-inferno-host.webp', import.meta.url).href;

const ROW = Object.freeze({ appearance: 0, idle: 1, actionA: 2, actionB: 3 });
/** @param {number} row */
function rowFrames(row) { return gridFrames(6, 6, 256, 256).map((frame) => Object.freeze({ ...frame, y: row * 256 })); }

const SERVANT_CLIPS = Object.freeze({
  appearance: Object.freeze({ fps: 10, loop: false, frames: rowFrames(ROW.appearance) }),
  idle: Object.freeze({ fps: 8, loop: true, frames: rowFrames(ROW.idle) }),
  inhale: Object.freeze({ fps: 10, loop: false, frames: rowFrames(ROW.actionA) }),
  blow: Object.freeze({ fps: 10, loop: true, frames: rowFrames(ROW.actionB) }),
});
const DEMONESS_CLIPS = Object.freeze({
  appearance: Object.freeze({ fps: 10, loop: false, frames: rowFrames(ROW.appearance) }),
  idle: Object.freeze({ fps: 8, loop: true, frames: rowFrames(ROW.idle) }),
  cast: Object.freeze({ fps: 10, loop: false, frames: rowFrames(ROW.actionA) }),
  hold: Object.freeze({ fps: 10, loop: true, frames: rowFrames(ROW.actionB) }),
});

/** @param {CanvasRenderingContext2D} context @param {number} time @param {number} strength */
function drawDirectedAsh(context, time, strength) {
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  for (let index = 0; index < 18; index += 1) {
    const phase = time * (1.7 + (index % 4) * 0.11) + index * 1.91;
    const progress = ((phase % 1.8) + 1.8) % 1.8 / 1.8;
    const x = 350 + progress * 240;
    const y = 985 + Math.sin(phase * 5.1) * (18 + index * 0.7) + (index % 3) * 11;
    context.strokeStyle = `rgba(171,137,105,${(1 - progress) * 0.28 * strength})`;
    context.lineWidth = 2 + (index % 4);
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + 22, y - 9, x + 48, y + Math.sin(phase * 3) * 8);
    context.stroke();
  }
  context.restore();
}

/** @param {CanvasRenderingContext2D} context @param {number} time @param {number} strength */
function drawColdRibbon(context, time, strength) {
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  for (let pass = 0; pass < 3; pass += 1) {
    const wobble = Math.sin(time * 2.4 + pass * 1.7) * 18;
    context.strokeStyle = `rgba(${105 + pass * 18},${196 + pass * 12},${206 + pass * 12},${0.18 * strength})`;
    context.lineWidth = 9 - pass * 2;
    context.beginPath();
    context.moveTo(830, 710);
    context.bezierCurveTo(760, 800 + wobble, 690, 1_010 - wobble, 560, 1_170);
    context.stroke();
  }
  context.restore();
}

/** Authored character state atlases; no transform-only cutout fallback. */
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
    this.servantRequested = 'hidden';
    this.demonessRequested = 'hidden';
    this.servantDisplay = 'hidden';
    this.demonessDisplay = 'hidden';
    this.paused = false;
  }

  async prepareCriticalAssets() {
    return true;
  }

  async retryCriticalAssets() {
    return true;
  }

  /** @param {any} state */
  setState(state) {
    if ((state.stage === 2 && state.stageProgress >= 0.6) || state.stage > 2) this.servantBitmap.startLoad();
    if ((state.stage === 3 && state.stageProgress >= 0.6) || state.stage > 3) this.demonessBitmap.startLoad();
    if ((state.stage === 5 && state.stageProgress >= 0.6) || state.stage > 5) this.hostBitmap.startLoad();
    this.paused = Boolean(state.paused);
    this.servantAnimator.setPaused(this.paused);
    this.demonessAnimator.setPaused(this.paused);
    this.setServantState(state.servant);
    this.setDemonessState(state.demoness);
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
    const clip = requested === 'inhale' ? 'inhale' : requested === 'blow' ? 'blow' : 'idle';
    if (this.servantDisplay !== clip && this.servantDisplay !== 'appearance') {
      this.servantDisplay = clip;
      this.servantAnimator.setClip(clip, true);
    }
  }

  /** @param {string} requested */
  setDemonessState(requested) {
    this.demonessRequested = requested;
    if (requested === 'hidden') {
      this.demonessVisible = false;
      this.demonessDisplay = 'hidden';
      return;
    }
    if (!this.demonessVisible) {
      this.demonessVisible = true;
      this.demonessDisplay = 'appearance';
      this.demonessAnimator.setClip('appearance', true);
      return;
    }
    const clip = requested === 'cast' ? 'cast' : requested === 'hold' ? 'hold' : 'idle';
    if (this.demonessDisplay !== clip && this.demonessDisplay !== 'appearance') {
      this.demonessDisplay = clip;
      this.demonessAnimator.setClip(clip, true);
    }
  }

  /** @param {number} dt */
  update(dt) {
    if (this.paused) return;
    this.servantAnimator.update(dt);
    this.demonessAnimator.update(dt);
    if (this.servantDisplay === 'appearance' && this.servantAnimator.isComplete()) {
      this.servantDisplay = this.servantRequested === 'inhale' ? 'inhale' : this.servantRequested === 'blow' ? 'blow' : 'idle';
      this.servantAnimator.setClip(this.servantDisplay, true);
    }
    if (this.demonessDisplay === 'appearance' && this.demonessAnimator.isComplete()) {
      this.demonessDisplay = this.demonessRequested === 'cast' ? 'cast' : this.demonessRequested === 'hold' ? 'hold' : 'idle';
      this.demonessAnimator.setClip(this.demonessDisplay, true);
    }
    if (this.servantDisplay === 'inhale' && this.servantAnimator.isComplete() && this.servantRequested !== 'inhale') {
      this.servantDisplay = this.servantRequested === 'blow' ? 'blow' : 'idle';
      this.servantAnimator.setClip(this.servantDisplay, true);
    }
    if (this.demonessDisplay === 'cast' && this.demonessAnimator.isComplete() && this.demonessRequested !== 'cast') {
      this.demonessDisplay = this.demonessRequested === 'hold' ? 'hold' : 'idle';
      this.demonessAnimator.setClip(this.demonessDisplay, true);
    }
  }

  /** @param {CanvasRenderingContext2D} context @param {any} state @param {number} timeSeconds */
  draw(context, state, timeSeconds) {
    if (state.hostLevel > 0 && this.hostBitmap.isReady()) {
      context.save();
      context.globalAlpha = state.hostLevel === 1 ? 0.58 : 1;
      context.filter = state.hostLevel === 1 ? 'brightness(.78) contrast(1.08) saturate(.9) drop-shadow(0 0 16px rgba(175,49,23,.46))' : 'brightness(1.34) contrast(1.16) saturate(1.2) drop-shadow(0 0 28px rgba(255,103,42,.82))';
      if (state.hostLevel === 1) { context.beginPath(); context.rect(0, 720, 1080, 620); context.clip(); }
      const drift = state.reducedMotion ? 0 : Math.sin(timeSeconds * 0.45) * 8;
      this.hostBitmap.drawContain(context, 0, 215 + drift, 1080, 1_020);
      context.restore();
    }

    if (this.demonessVisible && this.demonessBitmap.image && this.demonessBitmap.isReady()) {
      const active = this.demonessDisplay === 'cast' || this.demonessDisplay === 'hold';
      const silhouette = this.demonessRequested === 'silhouette';
      drawSpriteFrame(context, this.demonessBitmap.image, this.demonessAnimator.getFrame(), {
        anchorX: 825, anchorY: 1_235, width: 520, height: 900, pivot: [0.5, 0.965], alpha: silhouette ? 0.5 : 0.97,
        filter: silhouette ? 'brightness(.12) saturate(.45)' : active ? 'brightness(.96) saturate(.92) drop-shadow(0 0 24px rgba(70,190,180,.55))' : 'brightness(1.12) saturate(1.05) drop-shadow(0 0 22px rgba(192,55,28,.5))',
      });
      if (this.demonessDisplay === 'hold') drawColdRibbon(context, timeSeconds, state.reducedMotion ? 0.6 : 1);
    }

    if (this.servantVisible && this.servantBitmap.image && this.servantBitmap.isReady()) {
      const active = this.servantDisplay === 'blow';
      context.save();
      context.globalCompositeOperation = 'screen';
      const rim = context.createRadialGradient(285, 920, 16, 285, 920, 260);
      rim.addColorStop(0, 'rgba(255,130,53,.2)');
      rim.addColorStop(1, 'rgba(255,76,20,0)');
      context.fillStyle = rim;
      context.fillRect(20, 610, 540, 650);
      context.restore();
      drawSpriteFrame(context, this.servantBitmap.image, this.servantAnimator.getFrame(), {
        anchorX: 300, anchorY: 1_225, width: 540, height: 590, pivot: [0.52, 0.92], alpha: 0.98,
        filter: active ? 'brightness(1.28) contrast(1.08) saturate(1.12) drop-shadow(12px 0 24px rgba(255,132,52,.72))' : 'brightness(1.24) contrast(1.08) saturate(1.08) drop-shadow(0 0 22px rgba(255,126,45,.62))',
      });
      if (active) drawDirectedAsh(context, timeSeconds, state.reducedMotion ? 0.55 : 1);
    }
  }

  getDiagnostics() {
    return Object.freeze({
      servant: Object.freeze({ visible: this.servantVisible, state: this.servantDisplay, ...this.servantAnimator.snapshot(), asset: this.servantBitmap.status }),
      demoness: Object.freeze({ visible: this.demonessVisible, state: this.demonessDisplay, ...this.demonessAnimator.snapshot(), asset: this.demonessBitmap.status }),
      host: this.hostBitmap.status,
    });
  }
}
