// @ts-check

/** @typedef {'READY'|'PLAYING'|'PAUSED'|'AD_BREAK'|'RESULTS'|'ERROR'} GamePhase */
/** @typedef {'ad'|'visibility'|'platform'|'menu'} PauseReason */
/** @typedef {'servant'|'demoness'|'heat-window'} EncounterKind */
/** @typedef {'telegraph'|'effect'} EncounterPhase */
/** @typedef {'rewarded'|'closed'|'unavailable'|'error'} RewardedOutcome */
/** @typedef {import('./config.js').Stage} Stage */
/** @typedef {'phaseChanged'|'pauseReasonsChanged'|'tapAccepted'|'tapRejected'|'sealBlocked'|'sealBroken'|'stageChanged'|'stageBonus'|'infernoEntered'|'infernoExited'|'encounterStarted'|'encounterEffect'|'encounterEnded'|'rewardRequested'|'rewardResolved'|'boostStarted'|'boostEnded'|'runEnded'|'recordsChanged'} DomainEventType */

/**
 * @typedef {object} PersistentRecords
 * @property {1} schemaVersion
 * @property {number} bestScore
 * @property {Stage} highestStageReached
 * @property {number} longestInfernoHoldMs
 * @property {number} maxMultiplier
 * @property {number} runsPlayed
 */

/**
 * @typedef {object} EncounterState
 * @property {EncounterKind} kind
 * @property {EncounterPhase} phase
 * @property {number} msLeft
 */

/**
 * @typedef {object} EncounterClocks
 * @property {number|null} servantMs
 * @property {number|null} demonessMs
 * @property {number|null} heatWindowMs
 * @property {number} heatWindowSequenceIndex
 * @property {number} globalGapMs
 */

/**
 * @typedef {object} GameState
 * @property {GamePhase} phase
 * @property {number} simulationTimeMs
 * @property {number} heat
 * @property {number} scoreAcc
 * @property {number} score
 * @property {number} bestScore
 * @property {number} multiplier
 * @property {Stage} stage
 * @property {number} stageProgress
 * @property {number} decayRate
 * @property {number} tapPower
 * @property {EncounterState|null} encounter
 * @property {EncounterClocks} encounterClocks
 * @property {{msLeft:number}|null} boost
 * @property {boolean} queuedBoost
 * @property {boolean} sealBroken
 * @property {number} sealCapImpulses
 * @property {number} activeRunTimeMs
 * @property {number} currentInfernoHoldMs
 * @property {number} runLongestInfernoHoldMs
 * @property {Stage} runHighestStage
 * @property {number} maxMultiplier
 * @property {Stage[]} grantedStageBonuses
 * @property {PauseReason[]} pauseReasons
 * @property {number|null} failGraceMsLeft
 * @property {boolean} reachedStageTwo
 * @property {boolean} rewardedUsedThisRun
 * @property {boolean} rewardSheetOpen
 * @property {string|null} activeRewardRequestId
 * @property {number} sessionRewardCooldownMs
 * @property {boolean} boostUsed
 * @property {boolean} abandoned
 * @property {number} runId
 * @property {PersistentRecords} records
 */

/**
 * @typedef {object} DomainEvent
 * @property {DomainEventType} type
 * @property {number} atMs
 * @property {Record<string, unknown>} [data]
 */

/**
 * @typedef {object} TapCommand
 * @property {'tap'} type
 * @property {number} atMs
 * @property {string} [inputId]
 */

export {};
