// @ts-check

/** @typedef {'web'|'yandex'|'development'} PlatformKind */
/** @typedef {'test'|'yandex'|'unavailable'} RewardedProvider */
/** @typedef {'ad'|'visibility'|'platform'|'menu'|'game-ended'|string} PauseReason */
/** @typedef {'ru'|'en'} PlatformLocale */

export const REWARDED_PLACEMENT = 'heat-power-2x-60s';

const RUSSIAN_FALLBACK_LOCALES = new Set(['ru', 'be', 'kk', 'uk', 'uz']);

/**
 * Maps the Yandex/browser language to one of the two shipped localizations.
 * Region subtags are deliberately ignored so `ru-RU` and `en_US` remain safe.
 * @param {unknown} language
 * @returns {PlatformLocale}
 */
export function mapPlatformLocale(language) {
  if (typeof language !== 'string') return 'en';
  const primary = language.trim().toLowerCase().split(/[-_]/u, 1)[0];
  return RUSSIAN_FALLBACK_LOCALES.has(primary) ? 'ru' : 'en';
}

/**
 * @typedef {object} PlatformCapabilities
 * @property {PlatformKind} platform
 * @property {PlatformLocale} locale Selected shipped UI locale.
 * @property {boolean} authorized Whether the current platform player is authorized without prompting.
 * @property {boolean} localSave
 * @property {boolean} cloudSave
 * @property {'local-only'|'remote'} leaderboard
 * @property {boolean} leaderboardRead Whether remote platform leaderboard reads are available.
 * @property {boolean} leaderboardWrite Whether remote platform leaderboard writes are available for this player.
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
/** @typedef {{onRewarded?:()=>void}} RewardedCallbacks */
/**
 * @typedef {{status:'closed'|'unavailable'|'error', requestId:string, wasShown?:boolean, error?:import('./result.js').PlatformError}} AdResult
 */
/** @typedef {{paused:boolean, reasons:readonly string[], gameplayRequested:boolean}} PauseSnapshot */

/**
 * @typedef {object} PlatformService
 * @property {() => Promise<import('./result.js').Result<PlatformCapabilities>>} init
 * @property {() => Promise<import('./result.js').Result<void>>} markReady
 * @property {(data: import('./save.js').InfernoSaveV1) => Promise<import('./result.js').Result<void>>} saveData
 * @property {() => Promise<import('./result.js').Result<void>>} flushData Flushes any adapter-owned deferred persistence without exceeding provider limits.
 * @property {() => Promise<import('./result.js').Result<import('./save.js').InfernoSaveV1|null>>} loadData
 * @property {(score:number) => Promise<import('./result.js').Result<void>>} submitScore
 * @property {() => Promise<import('./result.js').Result<LeaderboardEntry[]>>} getLeaderboard
 * @property {(placement:typeof REWARDED_PLACEMENT, callbacks?:RewardedCallbacks) => Promise<RewardedResult>} showRewardedAd Calls onRewarded at the SDK earn event and resolves only after the ad reaches a terminal state.
 * @property {(placement:string) => Promise<AdResult>} showInterstitial
 * @property {(reason?:PauseReason) => import('./result.js').Result<void>} pauseGame
 * @property {(reason?:PauseReason) => import('./result.js').Result<void>} resumeGame
 * @property {() => void} startGameplay Starts gameplay markup only in response to the first accepted gameplay intent of a run.
 * @property {() => void} stopGameplay Ends the current gameplay-markup session without adding a pause reason.
 * @property {(listener:(snapshot:PauseSnapshot)=>void) => (()=>void)} subscribePauseChanges
 * @property {() => PauseSnapshot} getPauseSnapshot
 * @property {() => void|Promise<void>} dispose
 */
