// @ts-check

export const FIXED_STEP_MS = 50;
export const MAX_FRAME_DELTA_MS = 100;
export const MAX_SCORE = 2_147_483_647;
export const HEAT_MAX = 1_000;
/** Highest reachable heat until the current run's Infernal Seal is broken. */
export const SEAL_HEAT_CAP = 559;
export const INITIAL_HEAT = 30;
export const BASE_TAP_POWER = 3;
/** Emergency protection for impossible synthetic floods, not a balance cap. */
export const MAX_TAPS_PER_FIXED_STEP = 256;
export const FAIL_GRACE_MS = 2_000;
export const REWARDED_DURATION_MS = 20_000;
export const REWARDED_ELIGIBLE_RUN_MS = 45_000;
export const REWARDED_SESSION_COOLDOWN_MS = 90_000;

/** @typedef {1|2|3|4|5|6|7} Stage */

/**
 * @typedef {object} StageConfig
 * @property {Stage} stage
 * @property {string} name
 * @property {number} lowerHeat
 * @property {number} upperHeat
 * @property {number} decayPerSecond
 * @property {number} multiplier
 * @property {number} firstEntryBonus
 */

/** @type {readonly StageConfig[]} */
export const STAGES = Object.freeze([
  { stage: 1, name: 'Тьма', lowerHeat: 0, upperHeat: 80, decayPerSecond: 0.5, multiplier: 1, firstEntryBonus: 0 },
  { stage: 2, name: 'Искра', lowerHeat: 80, upperHeat: 220, decayPerSecond: 2, multiplier: 1.25, firstEntryBonus: 500 },
  { stage: 3, name: 'Пепельный слуга', lowerHeat: 220, upperHeat: 380, decayPerSecond: 4, multiplier: 1.5, firstEntryBonus: 1_500 },
  { stage: 4, name: 'Алый порог', lowerHeat: 380, upperHeat: 560, decayPerSecond: 6.5, multiplier: 2, firstEntryBonus: 3_000 },
  { stage: 5, name: 'Демонесса угасания', lowerHeat: 560, upperHeat: 730, decayPerSecond: 9, multiplier: 2.5, firstEntryBonus: 6_000 },
  { stage: 6, name: 'Круг Инферно', lowerHeat: 730, upperHeat: 900, decayPerSecond: 13, multiplier: 3.25, firstEntryBonus: 10_000 },
  { stage: 7, name: 'Инферно', lowerHeat: 900, upperHeat: 1_000, decayPerSecond: 18, multiplier: 5, firstEntryBonus: 20_000 },
]);

export const SERVANT_FIRST_MS = 8_000;
export const SERVANT_REPEAT_MS = 14_000;
export const SERVANT_TELEGRAPH_MS = 1_000;
export const SERVANT_EFFECT_MS = 2_500;

export const DEMONESS_FIRST_MS = 10_000;
export const DEMONESS_REPEAT_MS = 16_000;
export const DEMONESS_TELEGRAPH_MS = 2_000;
export const DEMONESS_EFFECT_MS = 4_000;

export const HEAT_WINDOW_FIRST_MS = 6_000;
export const HEAT_WINDOW_TELEGRAPH_MS = 750;
export const HEAT_WINDOW_ACTIVE_MS = 1_500;
export const HEAT_WINDOW_REPEAT_MS = Object.freeze([9_000, 11_000, 8_000, 10_000]);
export const EVENT_GAP_MS = 1_000;

/** @param {number} heat @returns {StageConfig} */
export function stageForHeat(heat) {
  const clamped = Math.max(0, Math.min(HEAT_MAX, heat));
  for (let index = STAGES.length - 1; index >= 0; index -= 1) {
    const config = STAGES[index];
    if (config && clamped >= config.lowerHeat) return config;
  }
  return /** @type {StageConfig} */ (STAGES[0]);
}

/** @param {Stage} stage @returns {StageConfig} */
export function configForStage(stage) {
  return /** @type {StageConfig} */ (STAGES[stage - 1]);
}

/** @param {number} heat @param {Stage} stage */
export function progressForStage(heat, stage) {
  const config = configForStage(stage);
  return Math.max(0, Math.min(1, (heat - config.lowerHeat) / (config.upperHeat - config.lowerHeat)));
}
