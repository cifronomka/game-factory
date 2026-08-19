// @ts-check

/** @typedef {'web'|'yandex'|'development'} PlatformKind */
/** @typedef {'test'|'yandex'|'unavailable'} RewardedProvider */
/** @typedef {'ad'|'visibility'|'platform'|'menu'|'game-ended'|string} PauseReason */
/**
 * @typedef {object} PlatformCapabilities
 * @property {PlatformKind} platform
 * @property {boolean} localSave
 * @property {boolean} cloudSave
 * @property {'local-only'|'remote'} leaderboard
 * @property {RewardedProvider} rewardedProvider Exactly one rewarded provider is selected for this adapter instance.
 * @property {boolean} rewardedAds
 * @property {false} interstitialAds
 * @property {boolean} gameplayLifecycle
 * @property {'yandex'} [degradedFrom]
 * @property {import('./result.js').PlatformErrorCode} [degradedReason]
 */
/**
 * @typedef {object} LeaderboardEntry
 * @property {number} rank
 * @property {number} score
 * @property {string} displayName
 * @property {boolean} isCurrentPlayer
 * @property {'local'|'yandex'} source
 */
/**
 * @typedef {{status:'rewarded'|'closed'|'unavailable'|'error', requestId:string, wasShown?:boolean, error?:import('./result.js').PlatformError}} RewardedResult
 */
/**
 * @typedef {{status:'closed'|'unavailable'|'error', requestId:string, wasShown?:boolean, error?:import('./result.js').PlatformError}} AdResult
 */
/** @typedef {{paused:boolean, reasons:readonly string[], gameplayRequested:boolean}} PauseSnapshot */

/**
 * @typedef {object} PlatformService
 * @property {() => Promise<import('./result.js').Result<PlatformCapabilities>>} init
 * @property {() => Promise<import('./result.js').Result<void>>} markReady
 * @property {(data: import('./save.js').InfernoSaveV1) => Promise<import('./result.js').Result<void>>} saveData
 * @property {() => Promise<import('./result.js').Result<import('./save.js').InfernoSaveV1|null>>} loadData
 * @property {(score:number) => Promise<import('./result.js').Result<void>>} submitScore
 * @property {() => Promise<import('./result.js').Result<LeaderboardEntry[]>>} getLeaderboard
 * @property {(placement:'inferno-seal') => Promise<RewardedResult>} showRewardedAd
 * @property {(placement:string) => Promise<AdResult>} showInterstitial
 * @property {(reason?:PauseReason) => import('./result.js').Result<void>} pauseGame
 * @property {(reason?:PauseReason) => import('./result.js').Result<void>} resumeGame
 * @property {(listener:(snapshot:PauseSnapshot)=>void) => (()=>void)} subscribePauseChanges
 * @property {() => PauseSnapshot} getPauseSnapshot
 * @property {() => void} dispose
 */

export {};
