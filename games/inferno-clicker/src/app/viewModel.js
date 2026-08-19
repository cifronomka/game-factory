// @ts-check

import {
  DEMONESS_EFFECT_MS,
  DEMONESS_TELEGRAPH_MS,
  HEAT_WINDOW_ACTIVE_MS,
  HEAT_WINDOW_TELEGRAPH_MS,
  SERVANT_EFFECT_MS,
  SERVANT_TELEGRAPH_MS,
  canOfferRewarded,
} from '../core/index.js';

/** @param {import('../core/contracts.js').EncounterState} encounter */
function encounterDuration(encounter) {
  if (encounter.kind === 'servant') return encounter.phase === 'telegraph' ? SERVANT_TELEGRAPH_MS : SERVANT_EFFECT_MS;
  if (encounter.kind === 'demoness') return encounter.phase === 'telegraph' ? DEMONESS_TELEGRAPH_MS : DEMONESS_EFFECT_MS;
  return encounter.phase === 'telegraph' ? HEAT_WINDOW_TELEGRAPH_MS : HEAT_WINDOW_ACTIVE_MS;
}

/** @param {import('../core/contracts.js').GameState} state */
export function toPresentationViewModel(state, settings, capabilities) {
  const encounter = state.encounter
    ? {
        kind: state.encounter.kind,
        phase: state.encounter.phase === 'effect' ? 'active' : 'telegraph',
        progress: Math.max(0, Math.min(1, 1 - state.encounter.msLeft / encounterDuration(state.encounter))),
        remainingMs: state.encounter.msLeft,
      }
    : null;
  return {
    stage: state.stage,
    stageProgress: state.stageProgress,
    heat: state.heat,
    score: state.score,
    bestScore: state.bestScore,
    multiplier: state.multiplier,
    infernoHoldMs: state.currentInfernoHoldMs,
    encounter,
    boost: state.boost ? { active: true, remainingMs: state.boost.msLeft } : null,
    sealBroken: state.sealBroken,
    sealLockedAtCap: !state.sealBroken && state.heat >= 559,
    paused: state.phase === 'PAUSED' || state.phase === 'AD_BREAK' || state.phase === 'RESULTS',
    muted: settings.muted,
    quality: settings.quality,
    reducedMotion: settings.reducedMotion,
    rewardedAvailable: capabilities.rewardedProvider !== 'unavailable' && canOfferRewarded(state),
    rewardedSupported: capabilities.rewardedProvider !== 'unavailable',
    rewardedProvider: capabilities.rewardedProvider,
    showTapHint: state.phase === 'READY',
  };
}

/** @param {import('../core/contracts.js').DomainEvent} event */
export function toPresentationEvent(event) {
  const data = event.data ?? {};
  if (event.type === 'tapAccepted') return { type: 'tap-accepted', critical: Number(data.heatWindowFactor) > 1 };
  if (event.type === 'stageChanged') return { type: 'stage-changed', from: data.from, to: data.to };
  if (event.type === 'encounterStarted') return { type: 'encounter-cue', kind: data.kind, phase: 'telegraph' };
  if (event.type === 'encounterEffect') return { type: 'encounter-cue', kind: data.kind, phase: 'active' };
  if (event.type === 'sealBlocked') return { type: 'seal-blocked' };
  if (event.type === 'sealBroken') return { type: 'seal-broken' };
  if (event.type === 'boostStarted') return { type: 'boost-changed', active: true };
  if (event.type === 'boostEnded') return { type: 'boost-changed', active: false };
  return null;
}
