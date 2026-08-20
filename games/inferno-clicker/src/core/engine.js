// @ts-check

import {
  BASE_TAP_POWER,
  DEMONESS_DECAY_FACTOR,
  DEMONESS_EFFECT_MS,
  DEMONESS_FIRST_MS,
  DEMONESS_REPEAT_MS,
  DEMONESS_TELEGRAPH_MS,
  ENEMY_DECAY_FACTOR_CAP,
  FAIL_GRACE_MS,
  FIXED_STEP_MS,
  HEAT_MAX,
  HEAT_WINDOW_ACTIVE_MS,
  HEAT_WINDOW_FIRST_MS,
  HEAT_WINDOW_REPEAT_MS,
  HEAT_WINDOW_TELEGRAPH_MS,
  INITIAL_HEAT,
  MAX_FRAME_DELTA_MS,
  MAX_SCORE,
  MAX_TAPS_PER_FIXED_STEP,
  REWARDED_DURATION_MS,
  REWARDED_ELIGIBLE_RUN_MS,
  REWARDED_SESSION_COOLDOWN_MS,
  SERVANT_DECAY_FACTOR,
  SERVANT_EFFECT_MS,
  SERVANT_FIRST_MS,
  SERVANT_REPEAT_MS,
  SERVANT_TELEGRAPH_MS,
  STAGES,
  configForStage,
  progressForStage,
  stageForHeat,
} from './config.js';

/** @typedef {import('./contracts.js').GameState} GameState */
/** @typedef {import('./contracts.js').PersistentRecords} PersistentRecords */
/** @typedef {import('./contracts.js').DomainEvent} DomainEvent */
/** @typedef {import('./contracts.js').TapCommand} TapCommand */
/** @typedef {import('./contracts.js').PauseReason} PauseReason */
/** @typedef {import('./contracts.js').RewardedOutcome} RewardedOutcome */
/** @typedef {import('./config.js').Stage} Stage */

/** @returns {PersistentRecords} */
export function createDefaultRecords() {
  return {
    schemaVersion: 1,
    bestScore: 0,
    highestStageReached: 1,
    longestInfernoHoldMs: 0,
    maxMultiplier: 1,
    runsPlayed: 0,
  };
}

/** @param {Partial<PersistentRecords>} [input] @returns {PersistentRecords} */
export function sanitizeRecords(input = {}) {
  const source = { ...createDefaultRecords(), ...input };
  const stage = /** @type {Stage} */ (clampInteger(source.highestStageReached, 1, 7));
  return {
    schemaVersion: 1,
    bestScore: clampInteger(source.bestScore, 0, MAX_SCORE),
    highestStageReached: stage,
    longestInfernoHoldMs: clampFinite(source.longestInfernoHoldMs, 0, Number.MAX_SAFE_INTEGER),
    maxMultiplier: clampFinite(source.maxMultiplier, 1, 5),
    runsPlayed: clampInteger(source.runsPlayed, 0, Number.MAX_SAFE_INTEGER),
  };
}

/** @param {PersistentRecords} [records] @param {number} [runId] @param {number} [sessionRewardCooldownMs] @returns {GameState} */
export function createInitialState(records = createDefaultRecords(), runId = 1, sessionRewardCooldownMs = 0) {
  const safeRecords = sanitizeRecords(records);
  return {
    phase: 'READY',
    simulationTimeMs: 0,
    heat: INITIAL_HEAT,
    scoreAcc: 0,
    score: 0,
    bestScore: safeRecords.bestScore,
    multiplier: 1,
    stage: 1,
    stageProgress: progressForStage(INITIAL_HEAT, 1),
    decayRate: 0.5,
    decayFactor: 1,
    tapPower: BASE_TAP_POWER,
    encounters: [],
    encounterClocks: {
      servantMs: null,
      demonessMs: null,
      heatWindowMs: null,
      heatWindowSequenceIndex: 0,
    },
    boost: null,
    queuedBoost: false,
    activeRunTimeMs: 0,
    currentInfernoHoldMs: 0,
    runLongestInfernoHoldMs: 0,
    runHighestStage: 1,
    maxMultiplier: 1,
    grantedStageBonuses: [],
    pauseReasons: [],
    failGraceMsLeft: null,
    reachedStageTwo: false,
    rewardedUsedThisRun: false,
    rewardSheetOpen: false,
    activeRewardRequestId: null,
    sessionRewardCooldownMs: Math.max(0, sessionRewardCooldownMs),
    boostUsed: false,
    abandoned: false,
    runId,
    records: safeRecords,
  };
}

/** @param {GameState} state @returns {GameState} */
function cloneState(state) {
  const encounters = state.encounters.map((encounter) => ({ ...encounter }));
  return {
    ...state,
    encounters,
    encounterClocks: { ...state.encounterClocks },
    boost: state.boost ? { ...state.boost } : null,
    grantedStageBonuses: [...state.grantedStageBonuses],
    pauseReasons: [...state.pauseReasons],
    records: { ...state.records },
  };
}

/** @param {unknown} value @param {number} min @param {number} max */
function clampFinite(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

/** @param {unknown} value @param {number} min @param {number} max */
function clampInteger(value, min, max) {
  return Math.floor(clampFinite(value, min, max));
}

/** @param {number} value */
function capScore(value) {
  return Math.max(0, Math.min(MAX_SCORE, value));
}

/** @param {GameState} state */
function currentMultiplier(state) {
  return configForStage(state.stage).multiplier;
}

/** @param {GameState} state */
function enemyDecayFactor(state) {
  let factor = 1;
  for (const encounter of state.encounters) {
    if (encounter.phase !== 'effect') continue;
    if (encounter.kind === 'servant') factor *= SERVANT_DECAY_FACTOR;
    if (encounter.kind === 'demoness') factor *= DEMONESS_DECAY_FACTOR;
  }
  return Math.min(ENEMY_DECAY_FACTOR_CAP, factor);
}

/** @param {GameState} state */
function isHeatWindowActive(state) {
  return state.encounters.some((encounter) => encounter.kind === 'heat-window' && encounter.phase === 'effect');
}

/** @param {GameState} state */
function derivedDecayRate(state) {
  return configForStage(state.stage).decayPerSecond * enemyDecayFactor(state);
}

/** @param {GameState} state @param {import('./contracts.js').EncounterKind} kind */
function encounterFor(state, kind) {
  return state.encounters.find((encounter) => encounter.kind === kind) ?? null;
}

/** @param {GameState} state */
function refreshDerived(state) {
  state.stage = stageForHeat(state.heat).stage;
  state.stageProgress = progressForStage(state.heat, state.stage);
  state.multiplier = currentMultiplier(state);
  state.decayFactor = enemyDecayFactor(state);
  state.decayRate = derivedDecayRate(state);
  state.scoreAcc = capScore(state.scoreAcc);
  state.score = Math.floor(state.scoreAcc);
  state.bestScore = Math.max(state.records.bestScore, state.score);
  state.maxMultiplier = Math.max(state.maxMultiplier, state.multiplier);
}

/** @param {DomainEvent[]} events @param {GameState} state @param {import('./contracts.js').DomainEventType} type @param {Record<string, unknown>} [data] */
function emit(events, state, type, data) {
  events.push(data ? { type, atMs: state.activeRunTimeMs, data } : { type, atMs: state.activeRunTimeMs });
}

/** @param {GameState} state @param {Stage} stage */
function ensureEncounterEligibility(state, stage) {
  const clocks = state.encounterClocks;
  if (stage >= 3 && clocks.servantMs === null && !encounterFor(state, 'servant')) clocks.servantMs = SERVANT_FIRST_MS;
  if (stage < 3) clocks.servantMs = null;
  if (stage >= 5 && clocks.demonessMs === null && !encounterFor(state, 'demoness')) clocks.demonessMs = DEMONESS_FIRST_MS;
  if (stage < 5) clocks.demonessMs = null;
  if (stage >= 6 && clocks.heatWindowMs === null && !encounterFor(state, 'heat-window')) clocks.heatWindowMs = HEAT_WINDOW_FIRST_MS;
  if (stage < 6) {
    clocks.heatWindowMs = null;
    clocks.heatWindowSequenceIndex = 0;
  }
}

/** @param {GameState} state @param {DomainEvent[]} events @param {Stage} previousStage */
function applyStageChange(state, events, previousStage) {
  const nextStage = stageForHeat(state.heat).stage;
  if (nextStage === previousStage) {
    ensureEncounterEligibility(state, nextStage);
    return;
  }

  emit(events, state, 'stageChanged', { from: previousStage, to: nextStage });
  if (previousStage < 7 && nextStage === 7) emit(events, state, 'infernoEntered');
  if (previousStage === 7 && nextStage < 7) emit(events, state, 'infernoExited');

  if (nextStage < previousStage) {
    if (nextStage < 3) cancelEncounter(state, events, 'servant');
    if (nextStage < 5 && encounterFor(state, 'demoness')?.phase === 'telegraph') cancelEncounter(state, events, 'demoness');
    if (nextStage < 6) cancelEncounter(state, events, 'heat-window');
  }

  state.stage = nextStage;
  ensureEncounterEligibility(state, nextStage);
}

/** @param {GameState} state @param {DomainEvent[]} events @param {import('./contracts.js').EncounterKind} kind */
function cancelEncounter(state, events, kind) {
  if (!encounterFor(state, kind)) return;
  state.encounters = state.encounters.filter((encounter) => encounter.kind !== kind);
  if (kind === 'servant') state.encounterClocks.servantMs = null;
  if (kind === 'demoness') state.encounterClocks.demonessMs = null;
  if (kind === 'heat-window') state.encounterClocks.heatWindowMs = null;
  emit(events, state, 'encounterEnded', { kind, cancelled: true });
}

/** @param {GameState} state @param {DomainEvent[]} events @param {import('./contracts.js').EncounterKind} kind */
function finishEncounter(state, events, kind) {
  state.encounters = state.encounters.filter((encounter) => encounter.kind !== kind);
  if (kind === 'servant') state.encounterClocks.servantMs = state.stage >= 3 ? SERVANT_REPEAT_MS : null;
  if (kind === 'demoness') state.encounterClocks.demonessMs = state.stage >= 5 ? DEMONESS_REPEAT_MS : null;
  if (kind === 'heat-window') {
    const index = state.encounterClocks.heatWindowSequenceIndex;
    state.encounterClocks.heatWindowMs = state.stage >= 6 ? HEAT_WINDOW_REPEAT_MS[index] ?? HEAT_WINDOW_REPEAT_MS[0] : null;
    state.encounterClocks.heatWindowSequenceIndex = (index + 1) % HEAT_WINDOW_REPEAT_MS.length;
  }
  emit(events, state, 'encounterEnded', { kind, cancelled: false });
}

/** @param {GameState} state @param {DomainEvent[]} events */
function startDueEncounters(state, events) {
  const clocks = state.encounterClocks;
  /** @type {readonly import('./contracts.js').EncounterKind[]} */
  const order = ['demoness', 'servant', 'heat-window'];
  for (const kind of order) {
    const clock = kind === 'servant' ? clocks.servantMs : kind === 'demoness' ? clocks.demonessMs : clocks.heatWindowMs;
    const eligible = kind === 'servant' ? state.stage >= 3 : kind === 'demoness' ? state.stage >= 5 : state.stage >= 6;
    if (clock === null || clock > 0 || !eligible || encounterFor(state, kind)) continue;
    if (kind === 'servant') clocks.servantMs = null;
    if (kind === 'demoness') clocks.demonessMs = null;
    if (kind === 'heat-window') clocks.heatWindowMs = null;
    const msLeft = kind === 'servant' ? SERVANT_TELEGRAPH_MS : kind === 'demoness' ? DEMONESS_TELEGRAPH_MS : HEAT_WINDOW_TELEGRAPH_MS;
    state.encounters.push({ kind, phase: 'telegraph', msLeft });
    emit(events, state, 'encounterStarted', { kind });
  }
}

/** @param {GameState} state */
function nextTimerBoundaryMs(state) {
  /** @type {number[]} */
  const values = [];
  if (state.boost) values.push(state.boost.msLeft);
  for (const encounter of state.encounters) values.push(encounter.msLeft);
  const clocks = state.encounterClocks;
  if (clocks.servantMs !== null && state.stage >= 3) values.push(clocks.servantMs);
  if (clocks.demonessMs !== null && state.stage >= 5) values.push(clocks.demonessMs);
  if (clocks.heatWindowMs !== null && state.stage >= 6) values.push(clocks.heatWindowMs);
  return values.length > 0 ? Math.max(0, Math.min(...values)) : Number.POSITIVE_INFINITY;
}

/** Decrements active clocks without changing phases; transitions happen at the slice endpoint. @param {GameState} state @param {number} elapsedMs */
function decrementTimers(state, elapsedMs) {
  if (state.boost) state.boost.msLeft = Math.max(0, state.boost.msLeft - elapsedMs);
  state.sessionRewardCooldownMs = Math.max(0, state.sessionRewardCooldownMs - elapsedMs);

  const clocks = state.encounterClocks;
  for (const encounter of state.encounters) encounter.msLeft = Math.max(0, encounter.msLeft - elapsedMs);
  if (clocks.servantMs !== null && state.stage >= 3) clocks.servantMs -= elapsedMs;
  if (clocks.demonessMs !== null && state.stage >= 5) clocks.demonessMs -= elapsedMs;
  if (clocks.heatWindowMs !== null && state.stage >= 6) clocks.heatWindowMs -= elapsedMs;
}

/** Applies all transitions whose clocks reached zero at the current active timestamp. @param {GameState} state @param {DomainEvent[]} events */
function settleTimers(state, events) {
  if (state.boost && state.boost.msLeft <= 0) {
    state.boost = null;
    emit(events, state, 'boostEnded');
  }
  for (const encounter of [...state.encounters]) {
    if (encounter.msLeft > 0 || encounter.phase !== 'effect') continue;
    finishEncounter(state, events, encounter.kind);
  }
  for (const encounter of state.encounters) {
    if (encounter.msLeft > 0 || encounter.phase !== 'telegraph') continue;
    const effectMs = encounter.kind === 'servant' ? SERVANT_EFFECT_MS : encounter.kind === 'demoness' ? DEMONESS_EFFECT_MS : HEAT_WINDOW_ACTIVE_MS;
    encounter.phase = 'effect';
    encounter.msLeft = effectMs;
    emit(events, state, 'encounterEffect', { kind: encounter.kind });
  }
  startDueEncounters(state, events);
}

/**
 * Applies piecewise stage decay for one active segment.
 * @param {GameState} state
 * @param {number} elapsedMs
 * @returns {{infernoMs:number, zeroMs:number}}
 */
function applyDecay(state, elapsedMs) {
  let remainingSeconds = elapsedMs / 1_000;
  let infernoSeconds = 0;
  let zeroSeconds = 0;
  const enemyFactor = enemyDecayFactor(state);

  while (remainingSeconds > 1e-12) {
    const config = stageForHeat(state.heat);
    const rate = config.decayPerSecond * enemyFactor;
    if (state.heat <= 0 || rate <= 0) {
      zeroSeconds += remainingSeconds;
      remainingSeconds = 0;
      break;
    }
    const lower = config.lowerHeat;
    const timeToLower = (state.heat - lower) / rate;
    const slice = timeToLower > 1e-12 ? Math.min(remainingSeconds, timeToLower) : Math.min(remainingSeconds, 1e-9);
    if (config.stage === 7) infernoSeconds += slice;
    state.heat = Math.max(lower, state.heat - rate * slice);
    remainingSeconds -= slice;
    if (timeToLower <= slice + 1e-12 && lower > 0) state.heat = Math.max(0, lower - 1e-9);
  }
  return { infernoMs: infernoSeconds * 1_000, zeroMs: zeroSeconds * 1_000 };
}

/** @param {GameState} state @param {DomainEvent[]} events @param {number} elapsedMs */
function addInfernoHold(state, events, elapsedMs) {
  if (elapsedMs <= 0) {
    if (state.heat < 900) state.currentInfernoHoldMs = 0;
    return;
  }
  const previousRecordBucket = Math.floor(Math.max(
    state.records.longestInfernoHoldMs,
    state.runLongestInfernoHoldMs,
  ) / 500);
  state.currentInfernoHoldMs += elapsedMs;
  state.runLongestInfernoHoldMs = Math.max(state.runLongestInfernoHoldMs, state.currentInfernoHoldMs);
  state.scoreAcc = capScore(state.scoreAcc + 50 * currentMultiplier(state) * (elapsedMs / 1_000));
  const nextRecordBucket = Math.floor(Math.max(
    state.records.longestInfernoHoldMs,
    state.runLongestInfernoHoldMs,
  ) / 500);
  if (nextRecordBucket > previousRecordBucket) emit(events, state, 'recordsChanged');
}

/** @param {GameState} state @param {DomainEvent[]} events @param {number} zeroMs */
function updateFailGrace(state, events, zeroMs) {
  if (state.heat > 0) {
    state.failGraceMsLeft = null;
    return;
  }
  if (!state.reachedStageTwo) {
    const from = state.phase;
    const reset = createInitialState(state.records, state.runId, state.sessionRewardCooldownMs);
    Object.assign(state, reset);
    emit(events, state, 'phaseChanged', { from, to: 'READY', reason: 'pre-stage-two-zero' });
    return;
  }
  if (state.failGraceMsLeft === null) state.failGraceMsLeft = FAIL_GRACE_MS;
  state.failGraceMsLeft = Math.max(0, state.failGraceMsLeft - zeroMs);
  if (state.failGraceMsLeft === 0) finishRun(state, events, false);
}

/** @param {GameState} state @param {DomainEvent[]} events @param {number} elapsedMs */
function advancePlayingSegment(state, events, elapsedMs) {
  if (elapsedMs <= 0 || state.phase !== 'PLAYING') return;
  let remainingMs = elapsedMs;
  while (remainingMs > 1e-9 && state.phase === 'PLAYING') {
    settleTimers(state, events);
    const boundaryMs = nextTimerBoundaryMs(state);
    const sliceMs = Math.min(remainingMs, boundaryMs > 1e-9 ? boundaryMs : remainingMs);
    const previousStage = state.stage;
    const { infernoMs, zeroMs } = applyDecay(state, sliceMs);
    state.activeRunTimeMs += sliceMs;
    addInfernoHold(state, events, infernoMs);
    if (state.heat < 900 && infernoMs < sliceMs) state.currentInfernoHoldMs = 0;
    decrementTimers(state, sliceMs);
    settleTimers(state, events);
    applyStageChange(state, events, previousStage);
    updateFailGrace(state, events, zeroMs);
    remainingMs -= sliceMs;
  }
  refreshDerived(state);
}

/** @param {GameState} state @param {DomainEvent[]} events @param {number} atMs */
function processTap(state, events, atMs) {
  if (state.phase !== 'READY' && state.phase !== 'PLAYING') {
    emit(events, state, 'tapRejected', { reason: 'phase' });
    return;
  }
  if (state.phase === 'READY') {
    const from = state.phase;
    state.phase = 'PLAYING';
    emit(events, state, 'phaseChanged', { from, to: state.phase });
  }

  const heatWindowFactor = isHeatWindowActive(state) ? 2 : 1;
  const rewardedFactor = state.boost ? 2 : 1;
  const tapPower = BASE_TAP_POWER * heatWindowFactor * rewardedFactor;
  state.tapPower = tapPower;
  const previousStage = state.stage;
  state.heat = Math.min(HEAT_MAX, state.heat + tapPower);
  applyStageChange(state, events, previousStage);

  if (state.stage > state.runHighestStage) state.runHighestStage = state.stage;
  state.reachedStageTwo ||= state.stage >= 2;
  for (const config of STAGES) {
    if (config.stage <= state.stage && config.stage >= 2 && !state.grantedStageBonuses.includes(config.stage)) {
      state.grantedStageBonuses.push(config.stage);
      state.scoreAcc = capScore(state.scoreAcc + config.firstEntryBonus);
      emit(events, state, 'stageBonus', { stage: config.stage, amount: config.firstEntryBonus });
    }
  }

  refreshDerived(state);
  const scoreTapPower = tapPower / rewardedFactor;
  const scoreAwarded = 10 * scoreTapPower * state.multiplier;
  state.scoreAcc = capScore(state.scoreAcc + scoreAwarded);
  state.failGraceMsLeft = null;
  refreshDerived(state);
  emit(events, state, 'tapAccepted', { tapPower, heatWindowFactor, rewardedFactor, scoreAwarded });
}

/** @param {GameState} state @param {DomainEvent[]} events @param {boolean} abandoned */
function finishRun(state, events, abandoned) {
  if (state.phase === 'RESULTS') return;
  const from = state.phase;
  refreshDerived(state);
  const records = sanitizeRecords({
    ...state.records,
    bestScore: Math.max(state.records.bestScore, state.score),
    highestStageReached: /** @type {Stage} */ (Math.max(state.records.highestStageReached, state.runHighestStage)),
    longestInfernoHoldMs: Math.max(state.records.longestInfernoHoldMs, state.runLongestInfernoHoldMs),
    maxMultiplier: Math.max(state.records.maxMultiplier, state.maxMultiplier),
    runsPlayed: state.records.runsPlayed + 1,
  });
  state.records = records;
  state.bestScore = records.bestScore;
  state.phase = 'RESULTS';
  state.pauseReasons = [];
  state.abandoned = abandoned;
  state.rewardSheetOpen = false;
  state.activeRewardRequestId = null;
  state.boost = null;
  state.queuedBoost = false;
  emit(events, state, 'phaseChanged', { from, to: 'RESULTS' });
  emit(events, state, 'runEnded', { abandoned, score: state.score });
  emit(events, state, 'recordsChanged');
}

/**
 * Pure fixed-step transition. Every unique tap is processed in timestamp/order sequence.
 * @param {GameState} source
 * @param {readonly TapCommand[]} commands
 * @returns {{state:GameState,events:DomainEvent[]}}
 */
export function reduceFixedStep(source, commands) {
  const state = cloneState(source);
  /** @type {DomainEvent[]} */
  const events = [];
  const stepStart = state.simulationTimeMs;
  const stepEnd = stepStart + FIXED_STEP_MS;
  const sortedTaps = commands
    .filter((command) => command.type === 'tap' && command.atMs >= stepStart && command.atMs < stepEnd)
    .sort((a, b) => a.atMs - b.atMs);
  /** @type {TapCommand[]} */
  const uniqueTaps = [];
  const inputIds = new Set();
  for (const tap of sortedTaps) {
    if (tap.inputId && inputIds.has(tap.inputId)) {
      emit(events, state, 'tapRejected', { reason: 'duplicate-input', inputId: tap.inputId });
      continue;
    }
    if (tap.inputId) inputIds.add(tap.inputId);
    uniqueTaps.push(tap);
  }
  const taps = uniqueTaps.slice(0, MAX_TAPS_PER_FIXED_STEP);
  for (let index = taps.length; index < uniqueTaps.length; index += 1) {
    emit(events, state, 'tapRejected', { reason: 'input-overflow' });
  }

  let cursorMs = stepStart;
  for (const tap of taps) {
    advancePlayingSegment(state, events, Math.max(0, tap.atMs - cursorMs));
    if (state.phase === 'READY' || state.phase === 'PLAYING') processTap(state, events, tap.atMs);
    else emit(events, state, 'tapRejected', { reason: 'phase' });
    cursorMs = tap.atMs;
  }
  advancePlayingSegment(state, events, Math.max(0, stepEnd - cursorMs));
  state.simulationTimeMs = stepEnd;
  refreshDerived(state);
  return { state, events };
}

/** @param {GameState} state */
export function canOfferRewarded(state) {
  return state.phase === 'PLAYING'
    && state.runHighestStage >= 4
    && state.activeRunTimeMs >= REWARDED_ELIGIBLE_RUN_MS
    && state.sessionRewardCooldownMs <= 0
    && !state.rewardedUsedThisRun
    && !state.boost
    && state.encounters.length === 0
    && !state.activeRewardRequestId;
}

export class GameEngine {
  /** @type {GameState} */ #state;
  /** @type {TapCommand[]} */ #tapQueue = [];
  /** @type {DomainEvent[]} */ #events = [];
  #accumulatorMs = 0;

  /** @param {GameState} [initialState] */
  constructor(initialState = createInitialState()) {
    this.#state = cloneState(initialState);
  }

  /** @returns {GameState} */
  get state() {
    return cloneState(this.#state);
  }

  /** @returns {readonly DomainEvent[]} */
  drainEvents() {
    const events = this.#events;
    this.#events = [];
    return events;
  }

  /** @param {number} atMs @param {string} [inputId] */
  queueTap(atMs, inputId) {
    if (!Number.isFinite(atMs) || atMs < 0) throw new RangeError('tap timestamp must be finite and non-negative');
    if (this.#state.phase !== 'READY' && this.#state.phase !== 'PLAYING') {
      emit(this.#events, this.#state, 'tapRejected', { reason: 'phase' });
      return;
    }
    this.#tapQueue.push(inputId ? { type: 'tap', atMs, inputId } : { type: 'tap', atMs });
    this.#tapQueue.sort((a, b) => a.atMs - b.atMs);
  }

  /** @param {number} frameDeltaMs */
  advanceFrame(frameDeltaMs) {
    if (!Number.isFinite(frameDeltaMs) || frameDeltaMs < 0) throw new RangeError('frame delta must be finite and non-negative');
    if (this.#state.phase === 'PAUSED' || this.#state.phase === 'AD_BREAK' || this.#state.phase === 'RESULTS' || this.#state.phase === 'ERROR') return;
    this.#accumulatorMs += Math.min(MAX_FRAME_DELTA_MS, frameDeltaMs);
    while (this.#accumulatorMs + 1e-9 >= FIXED_STEP_MS) {
      const stepEnd = this.#state.simulationTimeMs + FIXED_STEP_MS;
      const commands = this.#tapQueue.filter((tap) => tap.atMs < stepEnd);
      this.#tapQueue = this.#tapQueue.filter((tap) => tap.atMs >= stepEnd);
      const result = reduceFixedStep(this.#state, commands);
      this.#state = result.state;
      this.#events.push(...result.events);
      this.#accumulatorMs -= FIXED_STEP_MS;
      if (this.#state.phase === 'RESULTS' || this.#state.phase === 'ERROR' || this.#state.phase === 'PAUSED' || this.#state.phase === 'AD_BREAK') break;
    }
  }

  /** Advances an exact number of fixed steps, useful for headless tests. @param {number} count */
  advanceSteps(count) {
    for (let index = 0; index < count; index += 1) this.advanceFrame(FIXED_STEP_MS);
  }

  /** @param {PauseReason} reason */
  pause(reason) {
    if (this.#state.phase === 'RESULTS' || this.#state.phase === 'ERROR') return;
    const added = !this.#state.pauseReasons.includes(reason);
    if (added) this.#state.pauseReasons.push(reason);
    if (added) emit(this.#events, this.#state, 'pauseReasonsChanged', { reasons: [...this.#state.pauseReasons] });
    const from = this.#state.phase;
    this.#state.phase = this.#state.pauseReasons.includes('ad') ? 'AD_BREAK' : 'PAUSED';
    if (from !== this.#state.phase) emit(this.#events, this.#state, 'phaseChanged', { from, to: this.#state.phase });
  }

  /** @param {PauseReason} reason */
  resume(reason) {
    const hadReason = this.#state.pauseReasons.includes(reason);
    this.#state.pauseReasons = this.#state.pauseReasons.filter((item) => item !== reason);
    if (hadReason) emit(this.#events, this.#state, 'pauseReasonsChanged', { reasons: [...this.#state.pauseReasons] });
    if (this.#state.phase === 'RESULTS' || this.#state.phase === 'ERROR') return;
    const from = this.#state.phase;
    if (this.#state.pauseReasons.length > 0) this.#state.phase = this.#state.pauseReasons.includes('ad') ? 'AD_BREAK' : 'PAUSED';
    else this.#state.phase = this.#state.activeRunTimeMs > 0 ? 'PLAYING' : 'READY';
    if (this.#state.phase === 'PLAYING' && this.#state.queuedBoost) this.#startQueuedBoost();
    if (from !== this.#state.phase) emit(this.#events, this.#state, 'phaseChanged', { from, to: this.#state.phase });
  }

  openRewardSheet() {
    if (!canOfferRewarded(this.#state)) return false;
    this.#state.rewardSheetOpen = true;
    this.pause('menu');
    return true;
  }

  cancelRewardSheet() {
    if (!this.#state.rewardSheetOpen || this.#state.phase !== 'PAUSED' || !this.#state.pauseReasons.includes('menu')) return false;
    this.#state.rewardSheetOpen = false;
    this.resume('menu');
    return true;
  }

  /** @param {string} requestId */
  beginRewarded(requestId) {
    if (!requestId || this.#state.phase !== 'PAUSED' || !this.#state.rewardSheetOpen) return false;
    if (this.#state.pauseReasons.some((reason) => reason !== 'menu')) return false;
    this.#state.rewardSheetOpen = false;
    this.#state.pauseReasons = this.#state.pauseReasons.filter((reason) => reason !== 'menu');
    this.#state.activeRewardRequestId = requestId;
    this.pause('ad');
    emit(this.#events, this.#state, 'rewardRequested', { requestId });
    return true;
  }

  /** @param {string} requestId @param {RewardedOutcome} outcome */
  resolveRewarded(requestId, outcome) {
    if (this.#state.activeRewardRequestId !== requestId) return false;
    this.#state.activeRewardRequestId = null;
    if (outcome === 'rewarded' && !this.#state.rewardedUsedThisRun) {
      this.#state.rewardedUsedThisRun = true;
      this.#state.boostUsed = true;
      this.#state.queuedBoost = true;
      this.#state.sessionRewardCooldownMs = REWARDED_SESSION_COOLDOWN_MS;
    }
    emit(this.#events, this.#state, 'rewardResolved', { requestId, outcome });
    this.resume('ad');
    return true;
  }

  #startQueuedBoost() {
    if (!this.#state.queuedBoost || this.#state.boost) return;
    this.#state.queuedBoost = false;
    this.#state.boost = { msLeft: REWARDED_DURATION_MS };
    emit(this.#events, this.#state, 'boostStarted', { durationMs: REWARDED_DURATION_MS });
  }

  abandonRun() {
    if (this.#state.phase !== 'PAUSED') return false;
    finishRun(this.#state, this.#events, true);
    return true;
  }

  restart() {
    if (this.#state.phase !== 'RESULTS') return false;
    const next = createInitialState(this.#state.records, this.#state.runId + 1, this.#state.sessionRewardCooldownMs);
    next.simulationTimeMs = this.#state.simulationTimeMs;
    this.#state = next;
    this.#tapQueue = [];
    this.#accumulatorMs = 0;
    emit(this.#events, this.#state, 'phaseChanged', { from: 'RESULTS', to: 'READY' });
    return true;
  }

  /** @returns {PersistentRecords} */
  recordSnapshot() {
    return sanitizeRecords({
      ...this.#state.records,
      bestScore: Math.max(this.#state.records.bestScore, this.#state.score),
      highestStageReached: /** @type {Stage} */ (Math.max(this.#state.records.highestStageReached, this.#state.runHighestStage)),
      longestInfernoHoldMs: Math.max(this.#state.records.longestInfernoHoldMs, this.#state.runLongestInfernoHoldMs),
      maxMultiplier: Math.max(this.#state.records.maxMultiplier, this.#state.maxMultiplier),
    });
  }
}
