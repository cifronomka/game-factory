// @ts-check

import { OptionalBitmap } from './optionalBitmap.js';
import { SpriteAnimator, drawSpriteFrame, gridFrames } from './spriteAnimator.js';

const HEARTH_X = 540;
const HEARTH_Y = 1225;

const FAMILY_DEFINITIONS = Object.freeze({
  low: Object.freeze({ columns: 4, frames: 8, width: 256, height: 512, coreFps: 10, outerFps: 10, outerPhase: 2 }),
  mid: Object.freeze({ columns: 5, frames: 10, width: 320, height: 640, coreFps: 10, outerFps: 10, outerPhase: 3 }),
  high: Object.freeze({ columns: 6, frames: 12, width: 256, height: 640, coreFps: 11, outerFps: 11, outerPhase: 4 }),
});

export const FLAME_ATLAS_URLS = Object.freeze({
  low: Object.freeze({
    core: new URL('../../../assets/flame/atlases/core-low-v2.webp', import.meta.url).href,
    outer: new URL('../../../assets/flame/atlases/outer-low-v2.webp', import.meta.url).href,
  }),
  mid: Object.freeze({
    core: new URL('../../../assets/flame/atlases/core-mid-v2.webp', import.meta.url).href,
    outer: new URL('../../../assets/flame/atlases/outer-mid-v2.webp', import.meta.url).href,
  }),
  high: Object.freeze({
    core: new URL('../../../assets/flame/atlases/core-high-v2.webp', import.meta.url).href,
    outer: new URL('../../../assets/flame/atlases/outer-high-v2.webp', import.meta.url).href,
  }),
});
export const STAGE_FLARE_URL = new URL('../../../assets/flame/transitions/stage-flare-v2.webp', import.meta.url).href;

/** @typedef {'low'|'mid'|'high'} FlameFamily */
/** @typedef {{x:number,y:number,vx:number,vy:number,age:number,life:number,size:number,kind:'ember'|'smoke'}} Particle */
/** @typedef {{x:number,y:number,age:number,life:number,kind:'tap'|'stage-up'|'stage-down'|'heat'}} Pulse */

class Random {
  constructor() { this.seed = 0x51f15e; }
  next() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
}

/** @param {number} value @param {number} low @param {number} high */
function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
/** @param {number} value */
function smoothstep(value) { const progress = clamp(value, 0, 1); return progress * progress * (3 - 2 * progress); }
/** @param {number} stage @returns {FlameFamily} */
function familyForStage(stage) { return stage >= 6 ? 'high' : stage >= 3 ? 'mid' : 'low'; }
/** @param {FlameFamily} family */
function positionForFamily(family) { return family === 'high' ? 2 : family === 'mid' ? 1 : 0; }
/** @param {number} position @returns {FlameFamily} */
function familyForPosition(position) { return position >= 1.5 ? 'high' : position >= 0.5 ? 'mid' : 'low'; }

/** Complementary weights ensure no family becomes a full-opacity ghost copy. */
export function familyWeights(position) {
  const value = clamp(position, 0, 2);
  if (value <= 1) return Object.freeze({ low: 1 - value, mid: value, high: 0 });
  return Object.freeze({ low: 0, mid: 2 - value, high: value - 1 });
}

/** Continuous heat mapping used by scale-adjacent flame presentation channels. */
export function heatVisualProfile(flameHeight) {
  const heat = clamp(Number(flameHeight) || 0, 0, 1);
  return Object.freeze({
    heat,
    brightness: 1.02 + heat * 0.2,
    glowAlpha: 0.22 + heat * 0.34,
    glowRadius: 1.35 + heat * 0.52,
    outerAlpha: 0.68 + heat * 0.14,
    emberRatio: 0.12 + heat * 0.76,
    smokeRatio: 0.35 + heat * 0.45,
  });
}

/** @param {CanvasRenderingContext2D} context @param {HTMLImageElement} image @param {SpriteAnimator} animator @param {any} placement */
function drawTemporalSample(context, image, sample, placement) {
  if (!sample.current) return;
  const alpha = placement.alpha ?? 1;
  if (!sample.next || sample.mix <= 0.001) {
    drawSpriteFrame(context, image, sample.current, placement);
    return;
  }
  if (sample.mix >= 0.999) {
    drawSpriteFrame(context, image, sample.next, placement);
    return;
  }
  drawSpriteFrame(context, image, sample.current, { ...placement, alpha: alpha * (1 - sample.mix) });
  drawSpriteFrame(context, image, sample.next, { ...placement, alpha: alpha * sample.mix });
}

/** @param {CanvasRenderingContext2D} context @param {HTMLImageElement} image @param {SpriteAnimator} animator @param {any} placement */
function drawTemporalSprite(context, image, animator, placement) {
  drawTemporalSample(context, image, animator.getBlendSample(), placement);
}

/** @param {SpriteAnimator} animator @param {number} direction */
function directionalSample(animator, direction) {
  const sample = animator.getBlendSample();
  if (direction >= 0) return sample;
  const frames = animator.clip.frames;
  const currentIndex = frames.length - 1 - sample.currentIndex;
  const nextIndex = frames.length - 1 - sample.nextIndex;
  return Object.freeze({
    ...sample,
    current: frames[currentIndex],
    next: frames[nextIndex],
    currentIndex,
    nextIndex,
  });
}

/** @param {FlameFamily} name @param {{imageFactory?:(()=>HTMLImageElement|null)}} options */
function createFamily(name, options) {
  const definition = FAMILY_DEFINITIONS[name];
  const frames = gridFrames(definition.columns, definition.frames, definition.width, definition.height);
  const outerAnimator = new SpriteAnimator({ loop: { fps: definition.outerFps, loop: true, frames } }, 'loop');
  outerAnimator.elapsed = definition.outerPhase / definition.outerFps;
  return {
    coreBitmap: new OptionalBitmap(FLAME_ATLAS_URLS[name].core, { ...options, autoLoad: name === 'low' }),
    outerBitmap: new OptionalBitmap(FLAME_ATLAS_URLS[name].outer, { ...options, autoLoad: name === 'low' }),
    coreAnimator: new SpriteAnimator({ loop: { fps: definition.coreFps, loop: true, frames } }, 'loop'),
    outerAnimator,
  };
}

/** Authored sprite flame plus bounded procedural particles/light. */
export class FlameRig {
  /** @param {{imageFactory?:(()=>HTMLImageElement|null)}=} options */
  constructor(options = {}) {
    this.families = Object.freeze({
      low: createFamily('low', options),
      mid: createFamily('mid', options),
      high: createFamily('high', options),
    });
    this.flareBitmap = new OptionalBitmap(STAGE_FLARE_URL, { ...options, autoLoad: false });
    const flareFrames = gridFrames(4, 8, 256, 512);
    this.flareAnimator = new SpriteAnimator({ flare: { fps: 8, loop: false, frames: flareFrames } }, 'flare');
    this.flareActive = false;
    this.flareDirection = 1;
    /** @type {FlameFamily} */ this.currentFamily = 'low';
    /** @type {FlameFamily|null} */ this.previousFamily = null;
    this.familyMix = 0;
    this.familyMixFrom = 0;
    this.familyMixTarget = 0;
    this.transitionAge = 0;
    this.transitionDuration = 1.05;
    this.boundaryAge = Number.POSITIVE_INFINITY;
    this.boundaryDuration = 1.05;
    this.boundaryFrom = 1;
    this.boundaryTo = 1;
    /** @type {any} */ this.state = null;
    /** @type {Particle[]} */ this.embers = [];
    /** @type {Particle[]} */ this.smoke = [];
    /** @type {Pulse[]} */ this.pulses = [];
    this.random = new Random();
    this.impulse = 0;
    this.stageFlash = 0;
    this.characterReaction = Object.freeze({ bend: 0, suppression: 0, emberDrift: 0, cold: 0, source: 'none' });
    this.infernoEntryAge = Number.POSITIVE_INFINITY;
  }

  async prepareCriticalAssets() {
    const low = this.families.low;
    const statuses = await Promise.all([low.coreBitmap, low.outerBitmap].map((bitmap) => bitmap.whenSettled()));
    return statuses.every((status) => status === 'ready' || status === 'unavailable');
  }

  async retryCriticalAssets() {
    const low = this.families.low;
    const results = await Promise.all([low.coreBitmap, low.outerBitmap].map((bitmap) => bitmap.retry()));
    return results.every(Boolean);
  }

  /** @param {any} state */
  setState(state) {
    const targetFamily = familyForStage(state.stage);
    this.ensureFamilyLoaded(targetFamily);
    if ((state.stage === 1 && state.stageProgress >= 0.6) || state.stage > 1) this.flareBitmap.startLoad();
    if ((state.stage === 2 && state.stageProgress >= 0.6) || state.stage > 2) this.ensureFamilyLoaded('mid');
    if ((state.stage === 5 && state.stageProgress >= 0.6) || state.stage > 5) this.ensureFamilyLoaded('high');
    if (targetFamily !== this.currentFamily) {
      const source = this.families[this.currentFamily];
      const target = this.families[targetFamily];
      target.coreAnimator.setCycleProgress(source.coreAnimator.getCycleProgress());
      target.outerAnimator.setCycleProgress(source.outerAnimator.getCycleProgress());
      this.previousFamily = familyForPosition(this.familyMix);
      this.currentFamily = targetFamily;
      this.familyMixFrom = this.familyMix;
      this.familyMixTarget = positionForFamily(targetFamily);
      this.transitionAge = 0;
      this.transitionDuration = state.stage === 7 ? 1.5 : 1.05;
    }
    this.state = state;
    for (const family of Object.values(this.families)) {
      family.coreAnimator.setPaused(Boolean(state.paused));
      family.outerAnimator.setPaused(Boolean(state.paused));
    }
    this.flareAnimator.setPaused(Boolean(state.paused));
    if (this.embers.length > state.emberCap) this.embers.length = state.emberCap;
    if (this.smoke.length > state.smokeCap) this.smoke.length = state.smokeCap;
  }

  /** @param {FlameFamily} name */
  ensureFamilyLoaded(name) {
    const family = this.families[name];
    family.coreBitmap.startLoad();
    family.outerBitmap.startLoad();
  }

  /** At steady state only the active family remains decoded; a transition may keep two. */
  releaseInactiveFamilies() {
    for (const [name, family] of Object.entries(this.families)) {
      if (name === this.currentFamily) continue;
      family.coreBitmap.release();
      family.outerBitmap.release();
    }
  }

  /** @param {{bend?:number,suppression?:number,emberDrift?:number,cold?:number,source?:string}} reaction */
  setCharacterReaction(reaction) {
    this.characterReaction = Object.freeze({
      bend: clamp(Number(reaction.bend) || 0, -1, 1),
      suppression: clamp(Number(reaction.suppression) || 0, 0, 0.3),
      emberDrift: clamp(Number(reaction.emberDrift) || 0, 0, 1),
      cold: clamp(Number(reaction.cold) || 0, 0, 1),
      source: reaction.source ?? 'none',
    });
  }

  /** @param {import('../types.js').PresentationEvent} event */
  handleEvent(event) {
    if (event.type === 'tap-accepted') {
      if (!this.state?.reducedMotion) this.impulse = Math.min(1.55, this.impulse + (event.critical ? 0.52 : 0.31));
      this.addPulse({ x: event.x ?? HEARTH_X, y: event.y ?? HEARTH_Y, age: 0, life: 0.3, kind: 'tap' });
      const coldScale = 1 - this.characterReaction.cold * 0.65;
      this.spawnEmbers(Math.ceil((event.critical ? 14 : 7) * coldScale));
    } else if (event.type === 'stage-changed') {
      this.flareBitmap.startLoad();
      this.stageFlash = this.state?.flashesEnabled ? (event.to > event.from ? 1 : 0.32) : 0;
      this.flareDirection = event.to > event.from ? 1 : -1;
      this.flareAnimator.setClip('flare', true);
      this.flareActive = true;
      this.addPulse({ x: HEARTH_X, y: HEARTH_Y - 110, age: 0, life: 0.9, kind: event.to > event.from ? 'stage-up' : 'stage-down' });
      this.spawnEmbers(event.to === 7 ? 28 : 15);
      if (event.from === 6 && event.to === 7) this.infernoEntryAge = 0;
      this.boundaryAge = 0;
      this.boundaryDuration = event.from === 6 && event.to === 7 ? 1.5 : 1.05;
      this.boundaryFrom = event.from;
      this.boundaryTo = event.to;
    } else if (event.type === 'encounter-cue' && event.kind === 'heat-window' && event.phase === 'active') {
      this.addPulse({ x: HEARTH_X, y: HEARTH_Y - 100, age: 0, life: 1.1, kind: 'heat' });
    }
  }

  /** @param {Pulse} pulse */
  addPulse(pulse) {
    const cap = this.state?.quality === 'high' && !this.state?.reducedMotion ? 2 : this.state?.quality === 'off' ? 0 : 1;
    if (cap === 0) return;
    this.pulses.push(pulse);
    if (this.pulses.length > cap) this.pulses.splice(0, this.pulses.length - cap);
  }

  /** @param {number} count */
  spawnEmbers(count) {
    if (!this.state) return;
    for (let index = 0; index < count && this.embers.length < this.state.emberCap; index += 1) {
      this.embers.push({
        x: HEARTH_X + (this.random.next() - 0.5) * 135,
        y: HEARTH_Y - this.random.next() * 125,
        vx: (this.random.next() - 0.5) * 92,
        vy: -135 - this.random.next() * 250,
        age: 0,
        life: 0.65 + this.random.next() * 1.2,
        size: 2.5 + this.random.next() * 7,
        kind: 'ember',
      });
    }
  }

  /** @param {number} dt */
  update(dt) {
    if (!this.state || this.state.paused) return;
    const step = clamp(dt, 0, 0.05);
    const weights = familyWeights(this.familyMix);
    const activeFamilies = new Set(Object.entries(weights).filter(([, weight]) => weight > 0.0001).map(([name]) => name));
    activeFamilies.add(this.currentFamily);
    for (const name of activeFamilies) {
      const family = this.families[/** @type {FlameFamily} */ (name)];
      family.coreAnimator.update(step);
      family.outerAnimator.update(step);
    }
    if (this.flareActive) {
      this.flareAnimator.update(step);
      if (this.flareAnimator.isComplete()) this.flareActive = false;
    }
    if (this.previousFamily) {
      this.transitionAge += step;
      const progress = clamp(this.transitionAge / this.transitionDuration, 0, 1);
      this.familyMix = this.familyMixFrom + (this.familyMixTarget - this.familyMixFrom) * smoothstep(progress);
      if (progress >= 1) {
        this.familyMix = this.familyMixTarget;
        this.previousFamily = null;
        this.releaseInactiveFamilies();
      }
    }
    if (this.boundaryAge < this.boundaryDuration) this.boundaryAge = Math.min(this.boundaryDuration, this.boundaryAge + step);
    this.impulse = Math.max(0, this.impulse - step * 2.65);
    this.stageFlash = Math.max(0, this.stageFlash - step * 1.75);
    if (this.infernoEntryAge < 1.5) {
      this.infernoEntryAge = Math.min(1.5, this.infernoEntryAge + step);
      if (this.random.next() < step * 30) this.spawnEmbers(2);
    }
    const profile = heatVisualProfile(this.state.flameHeight);
    const coldEmberScale = 1 - this.characterReaction.cold * 0.68;
    const targetEmbers = Math.floor(this.state.emberCap * profile.emberRatio * coldEmberScale);
    const targetSmoke = Math.floor(this.state.smokeCap * profile.smokeRatio);
    if (this.random.next() < step * (8 + profile.heat * 14) * (1 - this.characterReaction.cold * 0.8) && this.embers.length < targetEmbers) this.spawnEmbers(1);
    if (this.random.next() < step * 4.2 && this.smoke.length < targetSmoke) {
      this.smoke.push({ x: HEARTH_X + (this.random.next() - 0.5) * 125, y: HEARTH_Y - 155, vx: (this.random.next() - 0.5) * 26, vy: -34 - this.random.next() * 48, age: 0, life: 2.2 + this.random.next() * 1.8, size: 32 + this.random.next() * 58, kind: 'smoke' });
    }
    for (const collection of [this.embers, this.smoke]) {
      for (const particle of collection) {
        particle.age += step;
        particle.x += particle.vx * step;
        particle.y += particle.vy * step;
        if (particle.kind === 'ember') {
          particle.vx += Math.sin(particle.age * 8.2) * step * 19;
          particle.vx += this.characterReaction.emberDrift * step * 210;
        }
      }
    }
    this.embers = this.embers.filter((particle) => particle.age < particle.life);
    this.smoke = this.smoke.filter((particle) => particle.age < particle.life);
    for (const pulse of this.pulses) pulse.age += step;
    this.pulses = this.pulses.filter((pulse) => pulse.age < pulse.life);
  }

  /** @param {CanvasRenderingContext2D} context @param {FlameFamily} name @param {number} alpha @param {{x:number,y:number,width:number,height:number}} box */
  drawFamily(context, name, alpha, box) {
    const family = this.families[name];
    const outerImage = family.outerBitmap.image;
    const coreImage = family.coreBitmap.image;
    const reaction = this.characterReaction;
    const reactionHeight = 1 - reaction.suppression;
    const anchorShift = reaction.bend * box.width * 0.14;
    const rotation = reaction.bend * 0.13;
    const profile = heatVisualProfile(this.state.flameHeight);
    const coldFilter = reaction.cold > 0.02 ? `saturate(${(1 - reaction.cold * 0.18).toFixed(2)}) brightness(${((1 - reaction.cold * 0.16) * profile.brightness).toFixed(3)})` : null;
    if (outerImage && family.outerBitmap.isReady()) drawTemporalSprite(context, outerImage, family.outerAnimator, {
      anchorX: HEARTH_X + anchorShift, anchorY: HEARTH_Y, width: box.width * 1.18, height: box.height * 1.03 * reactionHeight, pivot: [0.5, 0.965], alpha: alpha * (profile.outerAlpha - reaction.cold * 0.12), rotation, skewX: reaction.bend * 0.1,
      filter: this.state.boostActive ? `hue-rotate(245deg) saturate(1.28) brightness(${(profile.brightness * 1.05).toFixed(3)})` : coldFilter ?? `saturate(1.08) brightness(${profile.brightness.toFixed(3)})`,
    });
    if (coreImage && family.coreBitmap.isReady()) drawTemporalSprite(context, coreImage, family.coreAnimator, {
      anchorX: HEARTH_X + anchorShift * 0.72, anchorY: HEARTH_Y, width: box.width * 0.72, height: box.height * 0.94 * reactionHeight, pivot: [0.5, 0.965], alpha: alpha * (0.94 - reaction.cold * 0.18), rotation: rotation * 0.72, skewX: reaction.bend * 0.07,
      filter: this.state.boostActive ? `hue-rotate(275deg) saturate(1.15) brightness(${(profile.brightness * 1.16).toFixed(3)})` : coldFilter ?? `brightness(${(profile.brightness * 1.05).toFixed(3)})`,
    });
    if (this.impulse > 0.02 && coreImage && family.coreBitmap.isReady()) drawTemporalSprite(context, coreImage, family.coreAnimator, {
      anchorX: HEARTH_X, anchorY: HEARTH_Y - box.height * this.impulse * 0.025, width: box.width * 0.82, height: box.height * (0.98 + this.impulse * 0.04), pivot: [0.5, 0.965], alpha: alpha * Math.min(0.38, this.impulse * 0.25), filter: 'brightness(1.34) saturate(1.1)',
    });
  }

  /** Current rendered flame aim point, including tap impulse and character bend/suppression. */
  getTargetAnchor() {
    if (!this.state) return Object.freeze({ x: HEARTH_X, y: HEARTH_Y - 180 });
    const baseHeight = 72 + 1170 * this.state.flameHeight;
    const height = baseHeight * (1 + this.impulse * 0.105) * (1 - this.characterReaction.suppression);
    const width = height * (0.42 + this.state.flameHeight * 0.12) * (1 + this.impulse * 0.06);
    const anchorShift = this.characterReaction.bend * width * 0.14;
    return Object.freeze({
      x: HEARTH_X + anchorShift * 0.82,
      y: HEARTH_Y - height * 0.3,
    });
  }

  /** @param {CanvasRenderingContext2D} context @param {number} _time */
  drawFlame(context, _time) {
    if (!this.state) return;
    const baseHeight = 72 + 1170 * this.state.flameHeight;
    const height = baseHeight * (1 + this.impulse * 0.105);
    const width = height * (0.42 + this.state.flameHeight * 0.12) * (1 + this.impulse * 0.06);
    const box = { x: HEARTH_X - width / 2, y: HEARTH_Y - height, width, height };
    const profile = heatVisualProfile(this.state.flameHeight);
    const boundaryProgress = this.boundaryAge < this.boundaryDuration ? clamp(this.boundaryAge / this.boundaryDuration, 0, 1) : 1;
    const boundaryEnvelope = boundaryProgress < 1 ? Math.sin(boundaryProgress * Math.PI) : 0;

    context.save();
    context.globalCompositeOperation = 'screen';
    const glow = context.createRadialGradient(HEARTH_X, HEARTH_Y - height * 0.3, 10, HEARTH_X, HEARTH_Y - height * 0.25, width * profile.glowRadius);
    glow.addColorStop(0, this.state.boostActive ? 'rgba(188,113,255,.34)' : `rgba(255,111,35,${profile.glowAlpha + boundaryEnvelope * 0.08})`);
    glow.addColorStop(0.45, 'rgba(255,72,20,.15)');
    glow.addColorStop(1, 'rgba(255,45,8,0)');
    context.fillStyle = glow;
    context.fillRect(0, 210, 1080, 1280);

    const weights = familyWeights(this.familyMix);
    for (const [name, weight] of Object.entries(weights)) {
      if (weight > 0.0001) this.drawFamily(context, /** @type {FlameFamily} */ (name), weight, box);
    }
    context.restore();
  }

  /** @param {CanvasRenderingContext2D} context @param {number} _time */
  drawFx(context, _time) {
    if (!this.state) return;
    context.save();
    for (const smoke of this.smoke) {
      const life = 1 - smoke.age / smoke.life;
      const radius = smoke.size * (1.25 - life * 0.25);
      const haze = context.createRadialGradient(smoke.x, smoke.y, 0, smoke.x, smoke.y, radius);
      haze.addColorStop(0, `rgba(112,92,92,${life * 0.11})`);
      haze.addColorStop(1, 'rgba(55,43,48,0)');
      context.fillStyle = haze;
      context.fillRect(smoke.x - radius, smoke.y - radius, radius * 2, radius * 2);
    }
    context.globalCompositeOperation = 'screen';
    for (const ember of this.embers) {
      const life = 1 - ember.age / ember.life;
      context.save();
      context.translate(ember.x, ember.y);
      context.rotate(Math.atan2(ember.vy, ember.vx) + Math.PI / 2);
      const coldAlpha = 1 - this.characterReaction.cold * 0.45;
      context.fillStyle = this.state.boostActive ? `rgba(255,221,121,${life * coldAlpha})` : `rgba(255,119,39,${life * coldAlpha})`;
      context.fillRect(-ember.size * 0.35, -ember.size * 1.5, ember.size * 0.7, ember.size * 3);
      context.restore();
    }

    for (const pulse of this.pulses) {
      const progress = pulse.age / pulse.life;
      const radius = (pulse.kind === 'tap' ? 60 : 170) * (0.5 + progress * 1.2);
      const alpha = (1 - progress) * (pulse.kind === 'heat' ? 0.55 : 0.42);
      const color = pulse.kind === 'stage-down' ? '90,170,180' : pulse.kind === 'heat' ? '255,204,91' : '255,137,49';
      const flare = context.createRadialGradient(pulse.x, pulse.y, 0, pulse.x, pulse.y, radius);
      flare.addColorStop(0, `rgba(${color},${alpha})`);
      flare.addColorStop(0.35, `rgba(${color},${alpha * 0.45})`);
      flare.addColorStop(1, `rgba(${color},0)`);
      context.fillStyle = flare;
      context.fillRect(pulse.x - radius, pulse.y - radius, radius * 2, radius * 2);
    }

    if (this.infernoEntryAge < 1.5) {
      const progress = this.infernoEntryAge / 1.5;
      const alpha = Math.sin(progress * Math.PI) * (this.state.flashesEnabled ? 0.48 : 0.24);
      context.strokeStyle = `rgba(255,171,76,${alpha})`;
      context.lineWidth = 8 + progress * 18;
      context.beginPath();
      context.arc(HEARTH_X, HEARTH_Y - 45, 120 + progress * 610, 0, Math.PI * 2);
      context.stroke();
    }

    if (this.flareActive && this.flareBitmap.image && this.flareBitmap.isReady()) {
      drawTemporalSample(context, this.flareBitmap.image, directionalSample(this.flareAnimator, this.flareDirection), {
        anchorX: HEARTH_X, anchorY: HEARTH_Y, width: 560, height: 920, pivot: [0.5, 0.965], alpha: 0.62 + this.stageFlash * 0.2,
        filter: this.flareDirection > 0 ? 'brightness(1.18) saturate(1.08)' : 'brightness(.8) hue-rotate(145deg) saturate(.72)',
      });
    }

    if (this.state.stage === 7) {
      const high = this.families.high;
      const entry = smoothstep(this.infernoEntryAge < 1.5 ? this.infernoEntryAge / 1.5 : 1);
      if (high.coreBitmap.image && high.coreBitmap.isReady()) drawTemporalSprite(context, high.coreBitmap.image, high.coreAnimator, {
        anchorX: HEARTH_X, anchorY: HEARTH_Y, width: 430 + entry * 110, height: 1_180 + entry * 190, pivot: [0.5, 0.965], alpha: entry * (0.38 + this.stageFlash * 0.12),
        filter: this.state.boostActive ? 'hue-rotate(258deg) saturate(1.18) brightness(1.08)' : 'brightness(1.35)',
      });
    }
    context.restore();
  }

  getStats() {
    const familyAssets = Object.fromEntries(Object.entries(this.families).map(([name, family]) => [name, Object.freeze({
      core: family.coreBitmap.status,
      outer: family.outerBitmap.status,
      coreFrame: family.coreAnimator.getFrameIndex(),
      outerFrame: family.outerAnimator.getFrameIndex(),
      coreTemporal: family.coreAnimator.getBlendSample(),
      outerTemporal: family.outerAnimator.getBlendSample(),
    })]));
    const boundaryProgress = this.boundaryAge < this.boundaryDuration ? clamp(this.boundaryAge / this.boundaryDuration, 0, 1) : 1;
    return Object.freeze({
      embers: this.embers.length,
      smoke: this.smoke.length,
      pulses: this.pulses.length,
      family: this.currentFamily,
      previousFamily: this.previousFamily,
      transitionProgress: this.previousFamily ? clamp(this.transitionAge / this.transitionDuration, 0, 1) : 1,
      familyMix: this.familyMix,
      familyWeights: familyWeights(this.familyMix),
      boundaryTransition: Object.freeze({
        active: boundaryProgress < 1,
        from: this.boundaryFrom,
        to: this.boundaryTo,
        durationMs: Math.round(this.boundaryDuration * 1_000),
        progress: Math.round(boundaryProgress * 1_000_000) / 1_000_000,
      }),
      heatVisuals: heatVisualProfile(this.state?.flameHeight ?? 0),
      targetAnchor: this.getTargetAnchor(),
      characterReaction: this.characterReaction,
      infernoEntryProgress: this.infernoEntryAge < 1.5 ? Math.round(this.infernoEntryAge / 1.5 * 1_000_000) / 1_000_000 : 1,
      infernoPayoff: Object.freeze({ durationMs: 1_500, highFlameExpansion: true, emberBurst: true, runeWave: true, lightingPulse: true }),
      flareActive: this.flareActive,
      flareTemporal: directionalSample(this.flareAnimator, this.flareDirection),
      assets: Object.freeze({ ...familyAssets, flare: this.flareBitmap.status }),
    });
  }

  destroy() {
    this.embers.length = 0;
    this.smoke.length = 0;
    this.pulses.length = 0;
  }
}
