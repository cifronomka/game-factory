// @ts-check

/** @typedef {1|2|3|4|5|6|7} StageId */
/** @typedef {'high'|'low'|'off'} QualityTier */
/** @typedef {'servant'|'demoness'|'heat-window'} EncounterKind */
/** @typedef {'telegraph'|'active'} EncounterPhase */

/**
 * @typedef {object} EncounterViewModel
 * @property {EncounterKind} kind
 * @property {EncounterPhase} phase
 * @property {number} progress
 * @property {number=} remainingMs
 */

/**
 * @typedef {object} BoostViewModel
 * @property {boolean} active
 * @property {number} remainingMs
 */

/**
 * Renderer-facing snapshot. Core/application owns all values and clocks.
 * @typedef {object} PresentationViewModel
 * @property {StageId} stage
 * @property {number} stageProgress
 * @property {number} heat
 * @property {number} score
 * @property {number} bestScore
 * @property {number} multiplier
 * @property {number} infernoHoldMs
 * @property {EncounterViewModel|null} encounter
 * @property {BoostViewModel|null} boost
 * @property {boolean} paused
 * @property {boolean} muted
 * @property {QualityTier} quality
 * @property {boolean} reducedMotion
 * @property {boolean} rewardedAvailable
 * @property {boolean} rewardedSupported
 * @property {'yandex'|'test'|'unavailable'} rewardedProvider
 * @property {boolean} sealBroken
 * @property {boolean} sealLockedAtCap
 * @property {boolean} showTapHint
 */

/**
 * @typedef {object} GameplayTapEvent
 * @property {'tap-accepted'} type
 * @property {boolean=} critical
 * @property {number=} x
 * @property {number=} y
 */

/**
 * @typedef {GameplayTapEvent|
 * {type:'stage-changed',from:StageId,to:StageId}|
 * {type:'encounter-cue',kind:EncounterKind,phase:EncounterPhase}|
 * {type:'seal-blocked'}|
 * {type:'seal-broken'}|
 * {type:'boost-changed',active:boolean}|
 * {type:'personal-best'}|
 * {type:'pause',reason:string}|
 * {type:'resume',reason:string}|
 * {type:'mute-changed',muted:boolean}} PresentationEvent
 */

/**
 * @typedef {object} PresentationCallbacks
 * @property {(input:{x:number,y:number,timestampMs:number})=>void} onGameplayTap
 * @property {()=>void} onPauseToggle
 * @property {()=>void} onMuteToggle
 * @property {()=>void} onReducedMotionToggle
 * @property {()=>void} onRewardRequest
 */

/** @type {PresentationCallbacks} */
export const DEFAULT_PRESENTATION_CALLBACKS = Object.freeze({
  onGameplayTap: () => undefined,
  onPauseToggle: () => undefined,
  onMuteToggle: () => undefined,
  onReducedMotionToggle: () => undefined,
  onRewardRequest: () => undefined,
});

export const LOGICAL_WIDTH = 1080;
export const LOGICAL_HEIGHT = 1920;
