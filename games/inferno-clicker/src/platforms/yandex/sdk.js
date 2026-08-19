// @ts-check

/** @typedef {{publicName?:string, uniqueID?:string}} YandexLeaderboardPlayer */
/** @typedef {{rank:number, score:number, player?:YandexLeaderboardPlayer}} YandexLeaderboardEntry */
/**
 * @typedef {object} YandexPlayer
 * @property {() => boolean} isAuthorized
 * @property {(keys?:string[]) => Promise<Record<string, unknown>>} getData
 * @property {(data:Record<string, unknown>, flush?:boolean) => Promise<void>} setData
 */
/**
 * @typedef {object} YandexSdk
 * @property {{LoadingAPI?:{ready:()=>void|Promise<void>}, GameplayAPI?:{start:()=>void, stop:()=>void}}} [features]
 * @property {{showRewardedVideo:(options:{callbacks:{onOpen?:()=>void,onRewarded?:()=>void,onClose?:(wasShown:boolean)=>void,onError?:(error:unknown)=>void}})=>void}} [adv]
 * @property {{setScore:(name:string,score:number,extraData?:string)=>Promise<void>,getEntries:(name:string,options:{includeUser?:boolean,quantityAround?:number,quantityTop?:number})=>Promise<{entries:YandexLeaderboardEntry[]}>}} [leaderboards]
 * @property {() => Promise<YandexPlayer>} [getPlayer]
 * @property {(method:string) => Promise<boolean>} [isAvailableMethod]
 * @property {(event:'game_api_pause'|'game_api_resume', callback:()=>void)=>void} [on]
 * @property {(event:'game_api_pause'|'game_api_resume', callback:()=>void)=>void} [off]
 */

/** @returns {() => Promise<YandexSdk>} */
export function createGlobalYandexSdkFactory() {
  return async () => {
    const root = /** @type {typeof globalThis & {YaGames?:{init:()=>Promise<YandexSdk>}}} */ (globalThis);
    if (!root.YaGames?.init) throw new Error('Yandex Games SDK loader is unavailable.');
    return root.YaGames.init();
  };
}
