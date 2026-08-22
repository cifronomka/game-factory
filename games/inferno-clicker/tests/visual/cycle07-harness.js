// @ts-check

import { SceneVisualStateMapper } from '../../src/presentation/sceneVisualStateMapper.js';
import { InfernoScene } from '../../src/presentation/scene/infernoScene.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('canvas'));
const params = new URLSearchParams(location.search);
const mode = params.get('mode') ?? 'servant';
const speed = params.get('speed') === 'slow' ? 0.25 : 1;
const reducedMotion = params.get('reduced') === '1';
const mapper = new SceneVisualStateMapper();
const scene = new InfernoScene(canvas, () => {});
const startedAt = performance.now();

function encounter(kind, elapsed) {
  const activeDuration = kind === 'servant' ? 2.5 : 4;
  const cycleDuration = kind === 'servant' ? 5 : 7;
  const local = (elapsed * speed) % cycleDuration;
  if (local < 1) return { kind, phase: 'telegraph', progress: local };
  if (local < 1 + activeDuration) return { kind, phase: 'active', progress: (local - 1) / activeDuration };
  return null;
}

function model(elapsed) {
  const encounters = [];
  if (mode === 'servant' || mode === 'combined') {
    const value = encounter('servant', elapsed);
    if (value) encounters.push(value);
  }
  if (mode === 'demoness' || mode === 'combined') {
    const value = encounter('demoness', elapsed);
    if (value) encounters.push(value);
  }
  const stage = mode === 'servant' ? 3 : 6;
  return {
    stage, stageProgress: 0.8, heat: stage === 3 ? 350 : 820, score: 0, bestScore: 0, multiplier: 1,
    infernoHoldMs: 0, encounters, debuffs: [], combinedDecayFactor: 1, boost: null,
    paused: false, muted: true, quality: 'high', reducedMotion,
    rewardedAvailable: false, rewardedSupported: false, rewardedProvider: 'none', showTapHint: false,
  };
}

function resize() { scene.resize(); }
addEventListener('resize', resize);
resize();

await scene.prepareCriticalAssets();
scene.setState(mapper.map(model(0)));
scene.start();

function update(now) {
  scene.setState(mapper.map(model((now - startedAt) / 1_000)));
  requestAnimationFrame(update);
}
requestAnimationFrame(update);

Object.defineProperty(globalThis, '__c07Diagnostics', { value: () => scene.getDiagnostics(), configurable: false });
document.documentElement.dataset.c07Ready = 'true';
setInterval(() => { document.documentElement.dataset.c07Diagnostics = JSON.stringify(scene.getDiagnostics()); }, 100);
