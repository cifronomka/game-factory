// @ts-check

import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types.js';
import { CharacterScene } from './characterScene.js';
import { EnvironmentScene } from './environmentScene.js';
import { FlameRig } from './flameRig.js';
import { SCENE_LAYER_ORDER } from './layerOrder.js';

/** Central target stays at least 96 CSS px wide at the 360px reference viewport. */
export function isGameplayPoint(x, y) {
  return x >= 260 && x <= 820 && y >= 400 && y <= 1_450;
}

function sceneTransform(width, height) {
  if (width > height) {
    const visibleLogicalHeight = height < 420 ? 700 : 1_300;
    const scale = Math.min(width / LOGICAL_WIDTH, height / visibleLogicalHeight);
    return { scale, left: (width - LOGICAL_WIDTH * scale) / 2, top: height * 0.72 - 1_225 * scale };
  }
  const scale = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
  return { scale, left: (width - LOGICAL_WIDTH * scale) / 2, top: 0 };
}

export class InfernoScene {
  /** @param {HTMLCanvasElement} canvas @param {(input:{x:number,y:number,timestampMs:number})=>void} onGameplayTap */
  constructor(canvas, onGameplayTap) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is unavailable');
    this.canvas = canvas;
    this.context = context;
    this.environment = new EnvironmentScene();
    this.characters = new CharacterScene();
    this.flame = new FlameRig();
    /** @type {any} */ this.state = null;
    this.onGameplayTap = onGameplayTap;
    this.running = false;
    this.frameId = 0;
    this.lastFrame = 0;
    this.elapsed = 0;
    this.screenImpulse = Object.freeze({ x: 0, y: 0 });
    this.pointerHandler = (/** @type {PointerEvent} */ event) => this.handlePointer(event);
    this.pointerReleaseHandler = (/** @type {PointerEvent} */ event) => this.activePointers.delete(event.pointerId);
    /** @type {Set<number>} */
    this.activePointers = new Set();
    this.contextMenuHandler = (/** @type {Event} */ event) => event.preventDefault();
    canvas.addEventListener('pointerdown', this.pointerHandler);
    canvas.addEventListener('pointerup', this.pointerReleaseHandler);
    canvas.addEventListener('pointercancel', this.pointerReleaseHandler);
    canvas.addEventListener('lostpointercapture', this.pointerReleaseHandler);
    canvas.addEventListener('contextmenu', this.contextMenuHandler);
    this.resize();
  }

  /** @param {any} state */
  setState(state) {
    this.state = state;
    this.characters.setState(state);
    this.flame.setState(state);
    this.flame.setCharacterReaction(this.characters.getFlameReaction());
  }

  async prepareCriticalAssets() {
    const results = await Promise.all([
      this.environment.prepareCriticalAssets(),
      this.characters.prepareCriticalAssets(),
      this.flame.prepareCriticalAssets(),
    ]);
    return results.every(Boolean);
  }

  async retryCriticalAssets() {
    const results = await Promise.all([
      this.environment.retryCriticalAssets(),
      this.characters.retryCriticalAssets(),
      this.flame.retryCriticalAssets(),
    ]);
    return results.every(Boolean);
  }

  /** @param {import('../types.js').PresentationEvent} event */
  handleEvent(event) { this.flame.handleEvent(event); }

  handlePointer(event) {
    if (this.state?.paused) return;
    const pointerType = event.pointerType || 'mouse';
    if (pointerType === 'mouse' && (!event.isPrimary || event.button !== 0)) return;
    if ((pointerType === 'touch' || pointerType === 'pen') && this.activePointers.has(event.pointerId)) return;
    if (pointerType === 'touch' || pointerType === 'pen') this.activePointers.add(event.pointerId);
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const transform = sceneTransform(rect.width, rect.height);
    const x = (event.clientX - rect.left - transform.left) / transform.scale;
    const y = (event.clientY - rect.top - transform.top) / transform.scale;
    if (isGameplayPoint(x, y)) {
      this.onGameplayTap({ x, y, timestampMs: performance.now() });
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.frameId = requestAnimationFrame((time) => this.frame(time));
  }

  /** @param {number} now */
  frame(now) {
    if (!this.running) return;
    const delta = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (!this.state?.paused) this.elapsed += delta;
    this.characters.update(delta);
    this.flame.setCharacterReaction(this.characters.getFlameReaction());
    this.flame.update(delta);
    this.render();
    this.frameId = requestAnimationFrame((time) => this.frame(time));
  }

  render() {
    const state = this.state;
    if (!state) return;
    const { context } = this;
    const ratioX = this.canvas.width / (this.canvas.clientWidth || 1);
    const ratioY = this.canvas.height / (this.canvas.clientHeight || 1);
    context.setTransform(ratioX, 0, 0, ratioY, 0, 0);
    context.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    context.fillStyle = '#050407';
    context.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    const transform = sceneTransform(this.canvas.clientWidth, this.canvas.clientHeight);
    const flameStats = this.flame.getStats();
    this.characters.setFlameTarget(flameStats.targetAnchor);
    const entry = flameStats.infernoEntryProgress;
    const impulseWindow = state.stage === 7 && !state.reducedMotion && entry < 0.32 ? 1 - entry / 0.32 : 0;
    this.screenImpulse = Object.freeze({
      x: Math.sin(entry * Math.PI * 24) * 6 * impulseWindow,
      y: Math.cos(entry * Math.PI * 18) * 3 * impulseWindow,
    });
    context.save();
    context.translate(transform.left + this.screenImpulse.x * transform.scale, transform.top + this.screenImpulse.y * transform.scale);
    context.scale(transform.scale, transform.scale);
    for (const layer of SCENE_LAYER_ORDER) {
      if (layer === 'far-chamber') this.environment.drawFar(context, state);
      else if (layer === 'midground-architecture') this.environment.drawMidground(context, state);
      else if (layer === 'ritual-plane') this.environment.drawRitual(context, state, this.elapsed, entry);
      else if (layer === 'characters') this.characters.draw(context, state, this.elapsed);
      else if (layer === 'flame-rig') this.flame.drawFlame(context, this.elapsed);
      else if (layer === 'lighting-fx') this.flame.drawFx(context, this.elapsed);
      else if (layer === 'foreground') this.environment.drawForeground(context, state, this.elapsed);
    }
    context.restore();
  }

  getDiagnostics() {
    const flame = this.flame.getStats();
    return Object.freeze({
      ...flame,
      characters: this.characters.getDiagnostics(),
      infernoPayoff: Object.freeze({ ...flame.infernoPayoff, screenImpulse: this.screenImpulse, screenImpulseEnabled: true }),
      layers: [...SCENE_LAYER_ORDER],
    });
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.canvas.removeEventListener('pointerdown', this.pointerHandler);
    this.canvas.removeEventListener('pointerup', this.pointerReleaseHandler);
    this.canvas.removeEventListener('pointercancel', this.pointerReleaseHandler);
    this.canvas.removeEventListener('lostpointercapture', this.pointerReleaseHandler);
    this.canvas.removeEventListener('contextmenu', this.contextMenuHandler);
    this.activePointers.clear();
    this.flame.destroy();
  }
}
