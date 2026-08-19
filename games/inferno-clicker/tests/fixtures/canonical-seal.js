// @ts-check

import { GameEngine } from '../../src/core/index.js';

/**
 * @typedef {object} CanonicalSealTraceConfig
 * @property {string} name
 * @property {3} version
 * @property {'no-boost'|'boosted'} mode
 * @property {number} firstTapMs
 * @property {number[]} intervalByRunHighestStageMs
 * @property {number} stopMs
 * @property {number} [rewardAtMs]
 * @property {string} [rewardRequestId]
 * @property {Record<string, number>} expectedStageReachedAtMs
 * @property {number} expectedFinalScore
 * @property {number} expectedAcceptedTaps
 * @property {number} expectedRunHighestStage
 * @property {number} expectedFinalHeat
 * @property {number} [expectedMaxHeat]
 * @property {number} expectedSealCapImpulses
 * @property {number|null} expectedFirstSealBlockedAtMs
 * @property {number} [expectedBoostMsLeft]
 * @property {number} [expectedCurrentInfernoHoldMs]
 */

/**
 * Replays either canonical V3 branch from the same stage-indexed input script.
 * Reward resolution is injected immediately before the scheduled 102000ms tap.
 * @param {CanonicalSealTraceConfig} config
 * @param {15|30|60} fps
 */
export function replayCanonicalSeal(config, fps) {
  const engine = new GameEngine();
  const frameMs = 1_000 / fps;
  let scheduledTapMs = config.firstTapMs;
  let tapQueued = false;
  let rewardResolved = false;
  /** @type {Record<string, number>} */
  const stageReachedAtMs = {};
  let acceptedTaps = 0;
  let sealBlockedCount = 0;
  /** @type {number|null} */
  let firstSealBlockedAtMs = null;
  let maxHeat = engine.state.heat;

  while (engine.state.simulationTimeMs < config.stopMs) {
    if (config.mode === 'boosted' && !rewardResolved && engine.state.simulationTimeMs >= (config.rewardAtMs ?? Number.POSITIVE_INFINITY)) {
      const requestId = config.rewardRequestId ?? 'canonical-seal-v3';
      if (!engine.openRewardSheet() || !engine.beginRewarded(requestId) || !engine.resolveRewarded(requestId, 'rewarded')) {
        throw new Error(`Canonical rewarded transition failed at ${engine.state.simulationTimeMs}ms`);
      }
      rewardResolved = true;
    }
    if (!tapQueued && scheduledTapMs < config.stopMs) {
      engine.queueTap(scheduledTapMs, `canonical-v3-${acceptedTaps + 1}`);
      tapQueued = true;
    }
    engine.advanceFrame(frameMs);
    const events = engine.drainEvents();
    for (const event of events) {
      if (event.type === 'stageChanged' && typeof event.data?.to === 'number' && event.data.to > (event.data.from ?? 0)) {
        stageReachedAtMs[String(event.data.to)] ??= event.atMs;
      }
      if (event.type === 'sealBlocked') {
        sealBlockedCount += 1;
        firstSealBlockedAtMs ??= event.atMs;
        if (typeof event.data?.appliedHeat === 'number') maxHeat = Math.max(maxHeat, event.data.appliedHeat);
      }
      if (event.type === 'tapAccepted') {
        acceptedTaps += 1;
        tapQueued = false;
        const interval = config.intervalByRunHighestStageMs[engine.state.runHighestStage - 1];
        if (!interval) throw new Error(`Missing canonical interval for stage ${engine.state.runHighestStage}`);
        scheduledTapMs += interval;
      }
    }
    maxHeat = Math.max(maxHeat, engine.state.heat);
  }

  return {
    state: engine.state,
    stageReachedAtMs,
    acceptedTaps,
    sealBlockedCount,
    firstSealBlockedAtMs,
    maxHeat,
  };
}
