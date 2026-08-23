// @ts-check

/** @typedef {import('../core/contracts.js').PersistentRecords} PersistentRecords */

/**
 * @typedef {'stage'|'runs'|'milliseconds'|'score'} GoalUnit
 * @typedef {'stage-3'|'stage-5'|'stage-7'|'runs-3'|'runs-10'|'inferno-30s'|'inferno-60s'|'score-250000'} GoalId
 * @typedef {object} GoalViewModel
 * @property {GoalId} id
 * @property {string} labelKey
 * @property {GoalUnit} unit
 * @property {number} current
 * @property {number} target
 * @property {number} progress
 * @property {boolean} completed
 */

/** @type {readonly {id:GoalId,labelKey:string,unit:GoalUnit,metric:keyof PersistentRecords,target:number}[]} */
export const GOAL_DEFINITIONS = Object.freeze([
  { id: 'stage-3', labelKey: 'goals.stage3', unit: 'stage', metric: 'highestStageReached', target: 3 },
  { id: 'stage-5', labelKey: 'goals.stage5', unit: 'stage', metric: 'highestStageReached', target: 5 },
  { id: 'stage-7', labelKey: 'goals.stage7', unit: 'stage', metric: 'highestStageReached', target: 7 },
  { id: 'runs-3', labelKey: 'goals.runs3', unit: 'runs', metric: 'runsPlayed', target: 3 },
  { id: 'runs-10', labelKey: 'goals.runs10', unit: 'runs', metric: 'runsPlayed', target: 10 },
  { id: 'inferno-30s', labelKey: 'goals.inferno30', unit: 'milliseconds', metric: 'longestInfernoHoldMs', target: 30_000 },
  { id: 'inferno-60s', labelKey: 'goals.inferno60', unit: 'milliseconds', metric: 'longestInfernoHoldMs', target: 60_000 },
  { id: 'score-250000', labelKey: 'goals.score250000', unit: 'score', metric: 'bestScore', target: 250_000 },
]);

/** @param {unknown} value */
function safeMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Derives release goals exclusively from the existing V1 record fields. Goal
 * completion therefore needs no save migration or extra persistence writes.
 * @param {PersistentRecords} records
 * @returns {readonly GoalViewModel[]}
 */
export function deriveGoals(records) {
  return GOAL_DEFINITIONS.map((definition) => {
    const current = safeMetric(records[definition.metric]);
    return Object.freeze({
      id: definition.id,
      labelKey: definition.labelKey,
      unit: definition.unit,
      current,
      target: definition.target,
      progress: Math.max(0, Math.min(1, current / definition.target)),
      completed: current >= definition.target,
    });
  });
}

/** @param {readonly GoalViewModel[]} goals @returns {GoalViewModel|null} */
export function firstIncompleteGoal(goals) {
  return goals.find((goal) => !goal.completed) ?? null;
}
