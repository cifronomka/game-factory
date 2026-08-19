// @ts-check

/** @typedef {import('./types.js').PresentationViewModel} PresentationViewModel */
/** @typedef {import('./types.js').StageId} StageId */
/** @typedef {import('./types.js').QualityTier} QualityTier */

export const STAGE_NAMES = Object.freeze({
  1: 'Тьма',
  2: 'Искра',
  3: 'Пепельный слуга',
  4: 'Алый порог',
  5: 'Демонесса угасания',
  6: 'Круг Инферно',
  7: 'Инферно',
});

/** @param {number} value */
function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** @param {StageId} stage @param {StageId} threshold @param {number} progress */
function opacityAfter(stage, threshold, progress) {
  if (stage < threshold) return 0;
  if (stage > threshold) return 1;
  return 0.35 + progress * 0.65;
}

/** @param {StageId} stage @param {PresentationViewModel['encounter']} encounter */
function mapServant(stage, encounter) {
  if (stage < 3) return 'hidden';
  if (encounter?.kind !== 'servant') return stage === 3 ? 'emerge' : 'idle';
  if (encounter.phase === 'telegraph') return 'inhale';
  if (encounter.phase === 'active') return 'blow';
  return 'idle';
}

/** @param {StageId} stage @param {PresentationViewModel['encounter']} encounter */
function mapDemoness(stage, encounter) {
  if (stage < 4) return 'hidden';
  if (stage === 4) return 'silhouette';
  if (encounter?.kind !== 'demoness') return stage === 5 ? 'reveal' : 'idle';
  if (encounter.phase === 'telegraph') return 'cast';
  if (encounter.phase === 'active') return 'hold';
  return 'idle';
}

/** @param {QualityTier} quality @param {boolean} reducedMotion */
function qualityCaps(quality, reducedMotion) {
  if (quality === 'off') return { ember: 0, smoke: 0 };
  const base = quality === 'high' ? { ember: 80, smoke: 24 } : { ember: 28, smoke: 8 };
  if (!reducedMotion) return base;
  return { ember: Math.floor(base.ember * 0.4), smoke: Math.floor(base.smoke * 0.4) };
}

/**
 * Pure mapping from core-owned view-model to render targets. It deliberately
 * contains no gameplay thresholds, timers, DOM, audio or Canvas dependencies.
 */
export class SceneVisualStateMapper {
  /** @param {PresentationViewModel} viewModel */
  map(viewModel) {
    const stageProgress = clamp01(viewModel.stageProgress);
    const heatRatio = clamp01(viewModel.heat / 1_000);
    const reveal = 0.025 + heatRatio * 0.975;
    const lightRadius = 0.07 + Math.pow(heatRatio, 0.76) * 0.76;
    const flameHeight = 0.045 + Math.pow(heatRatio, 0.82) * 0.91;
    const caps = qualityCaps(viewModel.quality, viewModel.reducedMotion);
    const stageEmberLimit = viewModel.stage === 7 ? 80 : viewModel.stage === 6 ? 60 : viewModel.stage * 7;
    const demonessSuppression = viewModel.encounter?.kind === 'demoness' && viewModel.encounter.phase === 'active';

    return Object.freeze({
      stage: viewModel.stage,
      stageName: STAGE_NAMES[viewModel.stage],
      stageProgress,
      reveal,
      lightRadius,
      flameHeight,
      flameWidth: 0.06 + flameHeight * 0.31,
      coreColor: viewModel.boost?.active ? '#ffe38a' : demonessSuppression ? '#9ed9d1' : '#fff0c2',
      outerColor: viewModel.boost?.active ? '#9a5cff' : '#f05a24',
      environment: Object.freeze({
        far: 1,
        midground: Math.max(0.08, reveal),
        ritual: Math.max(0.08, reveal),
        gate: opacityAfter(viewModel.stage, 4, stageProgress),
        chains: opacityAfter(viewModel.stage, 4, stageProgress),
        runes: opacityAfter(viewModel.stage, 2, stageProgress),
        pylons: opacityAfter(viewModel.stage, 6, stageProgress),
        foreground: 0.32 + reveal * 0.68,
      }),
      servant: mapServant(viewModel.stage, viewModel.encounter),
      demoness: mapDemoness(viewModel.stage, viewModel.encounter),
      hostLevel: viewModel.stage >= 7 ? 2 : viewModel.stage >= 6 ? 1 : 0,
      encounter: viewModel.encounter,
      boostActive: viewModel.boost?.active ?? false,
      boostEnding: (viewModel.boost?.active ?? false) && (viewModel.boost?.remainingMs ?? 0) <= 3_000,
      emberCap: Math.min(caps.ember, stageEmberLimit),
      smokeCap: Math.min(caps.smoke, Math.max(1, viewModel.stage * 3)),
      distortionEnabled: viewModel.quality === 'high' && viewModel.stage >= 6 && !viewModel.reducedMotion,
      parallaxEnabled: viewModel.quality !== 'off' && !viewModel.reducedMotion,
      animatedEyes: viewModel.quality !== 'off' && !viewModel.reducedMotion,
      flashesEnabled: !viewModel.reducedMotion,
      reducedMotion: viewModel.reducedMotion,
      paused: viewModel.paused,
      quality: viewModel.quality,
    });
  }
}
