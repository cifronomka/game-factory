// @ts-check

/** @typedef {{addEventListener:(type:string, listener:()=>void)=>void, removeEventListener:(type:string, listener:()=>void)=>void}} EventSource */
/** @typedef {EventSource & {hidden?:boolean}} VisibilitySource */

/**
 * @param {{systemPause:(reason:string)=>void, systemResume:(reason:string)=>void}} target
 * @param {{documentTarget?:VisibilitySource|null, windowTarget?:EventSource|null}} [options]
 */
export function attachBrowserLifecycle(target, options = {}) {
  const globalDocument = typeof globalThis.document === 'undefined' ? null : globalThis.document;
  const globalWindow = typeof globalThis.window === 'undefined' ? null : globalThis.window;
  const documentTarget = options.documentTarget === undefined ? globalDocument : options.documentTarget;
  const windowTarget = options.windowTarget === undefined ? globalWindow : options.windowTarget;

  const pause = () => target.systemPause('visibility');
  const resume = () => {
    if (!documentTarget?.hidden) target.systemResume('visibility');
  };
  const visibility = () => documentTarget?.hidden ? pause() : resume();

  documentTarget?.addEventListener('visibilitychange', visibility);
  windowTarget?.addEventListener('pagehide', pause);
  windowTarget?.addEventListener('pageshow', resume);
  windowTarget?.addEventListener('blur', pause);
  windowTarget?.addEventListener('focus', resume);

  return () => {
    documentTarget?.removeEventListener('visibilitychange', visibility);
    windowTarget?.removeEventListener('pagehide', pause);
    windowTarget?.removeEventListener('pageshow', resume);
    windowTarget?.removeEventListener('blur', pause);
    windowTarget?.removeEventListener('focus', resume);
  };
}
