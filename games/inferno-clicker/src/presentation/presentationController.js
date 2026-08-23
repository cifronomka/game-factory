// @ts-check

import { AudioMixer } from './audio/audioMixer.js';
import { SceneVisualStateMapper } from './sceneVisualStateMapper.js';
import { InfernoScene } from './scene/infernoScene.js';
import { DomHud } from './ui/domHud.js';
import { DEFAULT_PRESENTATION_CALLBACKS } from './types.js';
import { createI18n } from '../app/i18n.js';

export class PresentationController {
  /** @param {{host:HTMLElement,callbacks?:Partial<import('./types.js').PresentationCallbacks>,audio?:AudioMixer,i18n?:import('../app/i18n.js').I18n,onPerformanceSample?:(sample:{atMs:number,workMs:number,paused:boolean})=>void}} options */
  constructor(options) {
    const callbacks = Object.freeze({ ...DEFAULT_PRESENTATION_CALLBACKS, ...options.callbacks });
    const i18n = options.i18n ?? createI18n('ru');
    this.host = options.host;
    this.host.classList.add('inferno-presentation');
    this.canvas = options.host.ownerDocument.createElement('canvas');
    this.canvas.setAttribute('aria-label', i18n.t('aria.game'));
    options.host.prepend(this.canvas);
    this.mapper = new SceneVisualStateMapper(i18n);
    this.audio = options.audio ?? new AudioMixer();
    this.scene = new InfernoScene(this.canvas, (input) => {
      void this.audio.unlock();
      callbacks.onGameplayTap(input);
    }, options.onPerformanceSample);
    this.hud = new DomHud(options.host, callbacks, i18n);
    this.resizeHandler = () => {
      const viewport = globalThis.visualViewport;
      if (viewport) this.host.style.setProperty('--app-visible-height', `${Math.round(viewport.height)}px`);
      this.scene.resize();
    };
    globalThis.addEventListener('resize', this.resizeHandler);
    globalThis.addEventListener('orientationchange', this.resizeHandler);
    globalThis.visualViewport?.addEventListener('resize', this.resizeHandler);
    this.resizeHandler();
    this.scene.start();
  }

  /** @param {import('./types.js').PresentationViewModel} viewModel */
  update(viewModel) {
    const visual = this.mapper.map(viewModel);
    this.scene.setState(visual);
    this.hud.render(viewModel, visual);
    this.audio.setStage(viewModel.stage);
    this.audio.setMuted(viewModel.muted);
    this.audio.setReducedMotion(viewModel.reducedMotion);
  }

  /** @param {import('./types.js').PresentationEvent} event */
  dispatch(event) {
    this.scene.handleEvent(event);
    this.audio.handleEvent(event);
  }

  unlockAudio() { return this.audio.unlock(); }
  prepareCriticalAssets() { return this.scene.prepareCriticalAssets(); }
  retryCriticalAssets() { return this.scene.retryCriticalAssets(); }
  getDiagnostics() { return Object.freeze({ scene: this.scene.getDiagnostics(), audio: this.audio.getDiagnostics() }); }

  async destroy() {
    globalThis.removeEventListener('resize', this.resizeHandler);
    globalThis.removeEventListener('orientationchange', this.resizeHandler);
    globalThis.visualViewport?.removeEventListener('resize', this.resizeHandler);
    this.scene.destroy();
    this.hud.destroy();
    this.canvas.remove();
    this.host.classList.remove('inferno-presentation');
    await this.audio.destroy();
  }
}

/** @param {ConstructorParameters<typeof PresentationController>[0]} options */
export function createPresentation(options) { return new PresentationController(options); }
