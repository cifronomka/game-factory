// @ts-check

import { fail, ok } from './result.js';

export const SAVE_SCHEMA_VERSION = 1;
export const MAX_SCORE = 2_147_483_647;

/** @typedef {{muted: boolean, reducedMotion: boolean, updatedAt: number}} PersistedSettings */
/** @typedef {{date: string|null, rewardClaimed: boolean}} DailyRitualState */
/**
 * @typedef {object} InfernoSaveV1
 * @property {1} schemaVersion
 * @property {number} bestScore
 * @property {number} highestStageReached
 * @property {number} longestInfernoHoldMs
 * @property {number} maxMultiplier
 * @property {number} runsPlayed
 * @property {Record<string, boolean>} tutorialFlags
 * @property {PersistedSettings} settings
 * @property {DailyRitualState} dailyRitual
 * @property {number} updatedAt
 */

/** @param {number} [now] @returns {InfernoSaveV1} */
export function createDefaultSave(now = Date.now()) {
  const timestamp = nonNegativeInteger(now) ? now : 0;
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    bestScore: 0,
    highestStageReached: 1,
    longestInfernoHoldMs: 0,
    maxMultiplier: 1,
    runsPlayed: 0,
    tutorialFlags: {},
    settings: { muted: false, reducedMotion: false, updatedAt: timestamp },
    dailyRitual: { date: null, rewardClaimed: false },
    updatedAt: timestamp,
  };
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is number} */
function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

/** @param {unknown} value @returns {value is number} */
function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** @param {unknown} value @returns {value is string|null} */
function validDate(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

/** @param {unknown} value @returns {value is Record<string, boolean>} */
function validFlags(value) {
  return isRecord(value) && Object.values(value).every((flag) => typeof flag === 'boolean');
}

/** Legacy saves may contain retired tutorial keys; only current direct-tap flags survive parsing. @param {Record<string, unknown>} value */
function sanitizeTutorialFlags(value) {
  /** @type {Record<string, boolean>} */
  const flags = {};
  if (value.tap === true) flags.tap = true;
  if (value.completed === true) flags.completed = true;
  return flags;
}

/** @param {Record<string, unknown>} raw @returns {Record<string, unknown>} */
function migrateLegacy(raw) {
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const dailyRitual = isRecord(raw.dailyRitual) ? raw.dailyRitual : {};
  const tutorialFlags = isRecord(raw.tutorialFlags)
    ? raw.tutorialFlags
    : raw.tutorialCompleted === true
      ? { completed: true }
      : {};

  return {
    schemaVersion: 1,
    bestScore: raw.bestScore,
    highestStageReached: raw.highestStageReached,
    longestInfernoHoldMs: raw.longestInfernoHoldMs,
    maxMultiplier: raw.maxMultiplier,
    runsPlayed: raw.runsPlayed,
    tutorialFlags,
    settings: {
      muted: settings.muted ?? raw.muted ?? false,
      reducedMotion: settings.reducedMotion ?? raw.reducedMotion ?? false,
      updatedAt: settings.updatedAt ?? raw.settingsUpdatedAt ?? raw.updatedAt,
    },
    dailyRitual: {
      date: dailyRitual.date ?? raw.dailyRitualDate ?? null,
      rewardClaimed: dailyRitual.rewardClaimed ?? raw.dailyRitualRewardClaimed ?? false,
    },
    updatedAt: raw.updatedAt,
  };
}

/**
 * Parses current schema and the explicitly supported schema-0/field-based legacy form.
 * Unknown fields (including active-run state) are deliberately not returned.
 * @param {unknown} input
 * @returns {import('./result.js').Result<InfernoSaveV1>}
 */
export function parseInfernoSave(input) {
  if (!isRecord(input)) return fail('invalid-data', 'Save must be an object.');

  const knownLegacy = ['bestScore', 'highestStageReached', 'longestInfernoHoldMs', 'runsPlayed']
    .some((key) => key in input);
  const version = input.schemaVersion;
  if (version !== 1 && version !== 0 && !(version === undefined && knownLegacy)) {
    return fail('invalid-data', 'Unsupported or missing save schema version.');
  }

  const raw = version === 1 ? input : migrateLegacy(input);
  const settings = raw.settings;
  const daily = raw.dailyRitual;

  if (!nonNegativeInteger(raw.bestScore) || Number(raw.bestScore) > MAX_SCORE) {
    return fail('invalid-data', 'bestScore is outside the supported range.');
  }
  if (!Number.isInteger(raw.highestStageReached)
    || Number(raw.highestStageReached) < 1
    || Number(raw.highestStageReached) > 7) {
    return fail('invalid-data', 'highestStageReached must be an integer from 1 to 7.');
  }
  if (!nonNegativeInteger(raw.longestInfernoHoldMs)
    || !finiteNumber(raw.maxMultiplier)
    || Number(raw.maxMultiplier) < 1
    || Number(raw.maxMultiplier) > 10
    || !nonNegativeInteger(raw.runsPlayed)
    || !nonNegativeInteger(raw.updatedAt)) {
    return fail('invalid-data', 'Record fields are invalid.');
  }
  if (!validFlags(raw.tutorialFlags)
    || !isRecord(settings)
    || typeof settings.muted !== 'boolean'
    || typeof settings.reducedMotion !== 'boolean'
    || !nonNegativeInteger(settings.updatedAt)
    || !isRecord(daily)
    || !validDate(daily.date)
    || typeof daily.rewardClaimed !== 'boolean') {
    return fail('invalid-data', 'Settings, tutorial, or daily ritual fields are invalid.');
  }

  return ok({
    schemaVersion: 1,
    bestScore: Number(raw.bestScore),
    highestStageReached: Number(raw.highestStageReached),
    longestInfernoHoldMs: Number(raw.longestInfernoHoldMs),
    maxMultiplier: Math.min(5, Number(raw.maxMultiplier)),
    runsPlayed: Number(raw.runsPlayed),
    tutorialFlags: sanitizeTutorialFlags(raw.tutorialFlags),
    settings: {
      muted: settings.muted,
      reducedMotion: settings.reducedMotion,
      updatedAt: Number(settings.updatedAt),
    },
    dailyRitual: { date: daily.date, rewardClaimed: daily.rewardClaimed },
    updatedAt: Number(raw.updatedAt),
  });
}

/** @param {Record<string, boolean>} a @param {Record<string, boolean>} b */
function mergeFlags(a, b) {
  /** @type {Record<string, boolean>} */
  const result = { ...a };
  for (const [key, value] of Object.entries(b)) result[key] = Boolean(result[key] || value);
  return result;
}

/** @param {InfernoSaveV1} local @param {InfernoSaveV1} cloud @returns {InfernoSaveV1} */
export function mergeInfernoSaves(local, cloud) {
  const newest = cloud.updatedAt > local.updatedAt ? cloud : local;
  const settings = cloud.settings.updatedAt > local.settings.updatedAt ? cloud.settings : local.settings;
  const sameDailyDate = local.dailyRitual.date === cloud.dailyRitual.date;
  const dailyRitual = sameDailyDate
    ? {
        date: local.dailyRitual.date,
        rewardClaimed: local.dailyRitual.rewardClaimed || cloud.dailyRitual.rewardClaimed,
      }
    : { ...newest.dailyRitual };

  return {
    schemaVersion: 1,
    bestScore: Math.max(local.bestScore, cloud.bestScore),
    highestStageReached: Math.max(local.highestStageReached, cloud.highestStageReached),
    longestInfernoHoldMs: Math.max(local.longestInfernoHoldMs, cloud.longestInfernoHoldMs),
    maxMultiplier: Math.min(5, Math.max(local.maxMultiplier, cloud.maxMultiplier)),
    runsPlayed: Math.max(local.runsPlayed, cloud.runsPlayed),
    tutorialFlags: mergeFlags(
      sanitizeTutorialFlags(local.tutorialFlags),
      sanitizeTutorialFlags(cloud.tutorialFlags),
    ),
    settings: { ...settings },
    dailyRitual,
    updatedAt: Math.max(local.updatedAt, cloud.updatedAt),
  };
}
