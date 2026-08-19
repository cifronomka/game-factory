// @ts-check

import { createDefaultSave } from '../platforms/index.js';

/** @param {import('../core/contracts.js').PersistentRecords} records @param {ReturnType<typeof createDefaultSave>} previous @param {{muted:boolean,reducedMotion:boolean}} settings @param {number} now */
export function buildSave(records, previous, settings, now) {
  return {
    ...createDefaultSave(now),
    ...previous,
    schemaVersion: 1,
    bestScore: records.bestScore,
    highestStageReached: records.highestStageReached,
    longestInfernoHoldMs: Math.floor(records.longestInfernoHoldMs),
    maxMultiplier: records.maxMultiplier,
    runsPlayed: records.runsPlayed,
    tutorialFlags: { ...previous.tutorialFlags },
    settings: { muted: settings.muted, reducedMotion: settings.reducedMotion, updatedAt: now },
    dailyRitual: { ...previous.dailyRitual },
    updatedAt: now,
  };
}

/** @param {ReturnType<typeof createDefaultSave>} save */
export function recordsFromSave(save) {
  return {
    schemaVersion: 1,
    bestScore: save.bestScore,
    highestStageReached: save.highestStageReached,
    longestInfernoHoldMs: save.longestInfernoHoldMs,
    maxMultiplier: save.maxMultiplier,
    runsPlayed: save.runsPlayed,
  };
}
