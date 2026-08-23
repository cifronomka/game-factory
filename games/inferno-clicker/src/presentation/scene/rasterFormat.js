// @ts-check

let cachedWebpSupport;

/**
 * Synchronous capability probe used before optional bitmaps are requested.
 * Older Safari returns PNG when asked for WebP, which makes the fallback safe.
 */
export function supportsWebP() {
  if (typeof cachedWebpSupport === 'boolean') return cachedWebpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    cachedWebpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    cachedWebpSupport = false;
  }
  return cachedWebpSupport;
}

/** @param {URL} webp @param {URL} png */
export function preferredRasterUrl(webp, png) { return (supportsWebP() ? webp : png).href; }

/** @param {string} relativePath */
export function runtimeAssetUrl(relativePath) {
  const base = globalThis.document?.baseURI ?? globalThis.location?.href ?? 'http://localhost/';
  return new URL(relativePath, base);
}

/** @param {string} webpPath @param {string} pngPath */
export function preferredRuntimeRasterUrl(webpPath, pngPath) {
  return runtimeAssetUrl(supportsWebP() ? webpPath : pngPath).href;
}
