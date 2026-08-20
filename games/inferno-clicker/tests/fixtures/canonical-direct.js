// @ts-check

import { GameEngine, canOfferRewarded } from '../../src/core/index.js';

/**
 * @typedef {object} ExpectedTrace
 * @property {Record<string, number>} stageReachedAtMs
 * @property {number} acceptedTaps
 * @property {number} score
 * @property {number} heat
 * @property {number} currentInfernoHoldMs
 * @property {number} runHighestStage
 */

/**
 * @typedef {object} DirectTraceConfig
 * @property {string} name
 * @property {5} version
 * @property {number} firstTapMs
 * @property {number[]} intervalByRunHighestStageMs
 * @property {number} stopMs
 * @property {number} [rewardAtMs]
 * @property {string} [rewardRequestId]
 * @property {ExpectedTrace} expected
 */

/**
 * @typedef {object} TapRateScenario
 * @property {string} name
 * @property {number} intervalMs
 * @property {number} stopMs
 * @property {number} [rewardAtMs]
 * @property {ExpectedTrace & {maxHeat:number,finalStage:number,score:number}} expected
 */

/**
 * @param {GameEngine} engine
 * @param {string} requestId
 */
function grantOptionalBoost(engine, requestId) {
  if (!engine.openRewardSheet() || !engine.beginRewarded(requestId) || !engine.resolveRewarded(requestId, 'rewarded')) {
    throw new Error(`Optional rewarded transition failed at ${engine.state.simulationTimeMs}ms`);
  }
}

/**
 * @param {DirectTraceConfig} config
 * @param {15|30|60} fps
 */
export function replayCanonicalDirect(config, fps) {
  const engine = new GameEngine();
  const frameMs = 1_000 / fps;
  let scheduledTapMs = config.firstTapMs;
  let tapQueued = false;
  let rewardResolved = false;
  /** @type {Record<string, number>} */
  const stageReachedAtMs = {};
  let acceptedTaps = 0;

  while (engine.state.simulationTimeMs < config.stopMs) {
    if (config.rewardAtMs !== undefined && !rewardResolved && engine.state.simulationTimeMs >= config.rewardAtMs) {
      grantOptionalBoost(engine, config.rewardRequestId ?? 'canonical-direct-v5');
      rewardResolved = true;
    }
    if (!tapQueued && scheduledTapMs < config.stopMs) {
      engine.queueTap(scheduledTapMs, `canonical-v5-${acceptedTaps + 1}`);
      tapQueued = true;
    }
    engine.advanceFrame(frameMs);
    for (const event of engine.drainEvents()) {
      if (event.type === 'stageChanged' && typeof event.data?.to === 'number' && event.data.to > (event.data.from ?? 0)) {
        stageReachedAtMs[String(event.data.to)] ??= event.atMs;
      }
      if (event.type === 'tapAccepted') {
        acceptedTaps += 1;
        tapQueued = false;
        const interval = config.intervalByRunHighestStageMs[engine.state.runHighestStage - 1];
        if (!interval) throw new Error(`Missing canonical interval for stage ${engine.state.runHighestStage}`);
        scheduledTapMs += interval;
      }
    }
  }
  return { state: engine.state, stageReachedAtMs, acceptedTaps };
}

/**
 * @param {TapRateScenario} scenario
 * @param {15|30|60} fps
 */
export function replayTapRateScenario(scenario, fps) {
  const engine = new GameEngine();
  const frameMs = 1_000 / fps;
  let scheduledTapMs = 0;
  let tapQueued = false;
  let rewardResolved = false;
  /** @type {Record<string, number>} */
  const stageReachedAtMs = {};
  let acceptedTaps = 0;
  let maxHeat = engine.state.heat;

  while (engine.state.simulationTimeMs < scenario.stopMs) {
    if (scenario.rewardAtMs !== undefined && !rewardResolved && engine.state.simulationTimeMs >= scenario.rewardAtMs) {
      grantOptionalBoost(engine, `tap-rate-${scenario.name}`);
      rewardResolved = true;
    }
    if (!tapQueued && scheduledTapMs < scenario.stopMs) {
      engine.queueTap(scheduledTapMs, `${scenario.name}-${acceptedTaps + 1}`);
      tapQueued = true;
    }
    engine.advanceFrame(frameMs);
    for (const event of engine.drainEvents()) {
      if (event.type === 'stageChanged' && typeof event.data?.to === 'number' && event.data.to > (event.data.from ?? 0)) {
        stageReachedAtMs[String(event.data.to)] ??= event.atMs;
      }
      if (event.type === 'tapAccepted') {
        acceptedTaps += 1;
        tapQueued = false;
        scheduledTapMs += scenario.intervalMs;
      }
    }
    maxHeat = Math.max(maxHeat, engine.state.heat);
  }
  return { state: engine.state, stageReachedAtMs, acceptedTaps, maxHeat };
}

/**
 * @typedef {{kind:'continuous',intervalsMs:number[]}|{kind:'burst-rest',intervalsMs:number[],activeMs:number,restMs:number}|{kind:'phased',phases:{durationMs:number,intervalsMs:number[]}[]}} HumanTapPattern
 * @typedef {object} HumanInputProfile
 * @property {string} name
 * @property {number} stopMs
 * @property {HumanTapPattern} tapPattern
 * @property {number} [rewardAfterMs]
 */

/** @param {number} startMs @param {number} endMs @param {number[]} intervalsMs */
function timestampsForRange(startMs, endMs, intervalsMs) {
  if (intervalsMs.length === 0 || intervalsMs.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError('Human input intervals must be finite positive milliseconds');
  }
  const result = [];
  let atMs = startMs;
  let index = 0;
  while (atMs < endMs) {
    result.push(atMs);
    atMs += /** @type {number} */ (intervalsMs[index % intervalsMs.length]);
    index += 1;
  }
  return result;
}

/** @param {HumanInputProfile} profile */
export function buildHumanTapTimestamps(profile) {
  const pattern = profile.tapPattern;
  if (pattern.kind === 'continuous') return timestampsForRange(0, profile.stopMs, pattern.intervalsMs);
  if (pattern.kind === 'phased') {
    const timestamps = [];
    let startMs = 0;
    for (const phase of pattern.phases) {
      const endMs = Math.min(profile.stopMs, startMs + phase.durationMs);
      timestamps.push(...timestampsForRange(startMs, endMs, phase.intervalsMs));
      startMs = endMs;
      if (startMs >= profile.stopMs) break;
    }
    return timestamps;
  }
  const timestamps = [];
  for (let cycleStartMs = 0; cycleStartMs < profile.stopMs; cycleStartMs += pattern.activeMs + pattern.restMs) {
    timestamps.push(...timestampsForRange(
      cycleStartMs,
      Math.min(profile.stopMs, cycleStartMs + pattern.activeMs),
      pattern.intervalsMs,
    ));
  }
  return timestamps;
}

/** @param {HumanInputProfile} profile @param {15|30|60} fps */
export function replayHumanInputProfile(profile, fps) {
  const engine = new GameEngine();
  const frameMs = 1_000 / fps;
  const timestamps = buildHumanTapTimestamps(profile);
  let tapIndex = 0;
  let tapQueued = false;
  let rewardResolvedAtMs = null;
  let acceptedTaps = 0;
  let maxHeat = engine.state.heat;
  let maxConcurrentEnemyDebuffs = 0;
  /** @type {Record<string, number>} */
  const stageReachedAtMs = {};

  while (engine.state.simulationTimeMs < profile.stopMs) {
    if (profile.rewardAfterMs !== undefined && rewardResolvedAtMs === null
      && engine.state.simulationTimeMs >= profile.rewardAfterMs && canOfferRewarded(engine.state)) {
      grantOptionalBoost(engine, `human-profile-${profile.name}`);
      rewardResolvedAtMs = engine.state.simulationTimeMs;
    }
    const scheduledTapMs = timestamps[tapIndex];
    if (!tapQueued && scheduledTapMs !== undefined && scheduledTapMs < profile.stopMs) {
      engine.queueTap(scheduledTapMs, `${profile.name}-${tapIndex + 1}`);
      tapQueued = true;
    }
    engine.advanceFrame(frameMs);
    for (const event of engine.drainEvents()) {
      if (event.type === 'stageChanged' && typeof event.data?.to === 'number' && event.data.to > (event.data.from ?? 0)) {
        stageReachedAtMs[String(event.data.to)] ??= event.atMs;
      }
      if (event.type === 'tapAccepted') {
        acceptedTaps += 1;
        tapIndex += 1;
        tapQueued = false;
      }
    }
    const enemyEffects = engine.state.encounters.filter((encounter) => encounter.phase === 'effect' && encounter.kind !== 'heat-window').length;
    maxConcurrentEnemyDebuffs = Math.max(maxConcurrentEnemyDebuffs, enemyEffects);
    maxHeat = Math.max(maxHeat, engine.state.heat);
  }

  return { state: engine.state, stageReachedAtMs, acceptedTaps, maxHeat, maxConcurrentEnemyDebuffs, rewardResolvedAtMs };
}
