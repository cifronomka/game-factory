// @ts-check

/**
 * @typedef {'unavailable'|'timeout'|'invalid-data'|'storage-error'|'cloud-error'|'sdk-error'|'unauthorized'|'rate-limited'|'busy'} PlatformErrorCode
 */

/**
 * @typedef {{code: PlatformErrorCode, message: string, retryable: boolean}} PlatformError
 */

/**
 * @template T
 * @typedef {{ok: true, value: T} | {ok: false, error: PlatformError}} Result
 */

/** @template T @param {T} value @returns {Result<T>} */
export function ok(value) {
  return { ok: true, value };
}

/**
 * @template T
 * @param {PlatformErrorCode} code
 * @param {string} message
 * @param {boolean} [retryable]
 * @returns {Result<T>}
 */
export function fail(code, message, retryable = false) {
  return { ok: false, error: { code, message, retryable } };
}

/** @param {unknown} error @returns {string} */
export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
