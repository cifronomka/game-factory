// @ts-check

// Runtime shims are deliberately small and limited to APIs used by the game.
// They cover the official Android 5+/iOS 9+ OS floor without shipping a broad
// third-party compatibility runtime.

if (!Object.entries) {
  Object.entries = (object) => Object.keys(Object(object)).map((key) => [key, object[key]]);
}
if (!Object.values) {
  Object.values = (object) => Object.keys(Object(object)).map((key) => object[key]);
}
if (!Object.fromEntries) {
  Object.fromEntries = (entries) => {
    const result = {};
    for (const entry of entries) result[entry[0]] = entry[1];
    return result;
  };
}
if (!Number.isFinite) Number.isFinite = (value) => typeof value === 'number' && isFinite(value);
if (!Number.isInteger) Number.isInteger = (value) => Number.isFinite(value) && Math.floor(value) === value;
if (!Number.isSafeInteger) Number.isSafeInteger = (value) => Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
if (!Number.MAX_SAFE_INTEGER) Number.MAX_SAFE_INTEGER = 9_007_199_254_740_991;
if (!Array.prototype.includes) {
  Array.prototype.includes = function includes(search, fromIndex = 0) {
    for (let index = Math.max(0, fromIndex < 0 ? this.length + fromIndex : fromIndex); index < this.length; index += 1) {
      if (this[index] === search || (this[index] !== this[index] && search !== search)) return true;
    }
    return false;
  };
}
if (!String.prototype.includes) {
  String.prototype.includes = function includes(search, position = 0) { return this.indexOf(search, position) !== -1; };
}
if (!Promise.prototype.finally) {
  Promise.prototype.finally = function finallyShim(callback) {
    const Constructor = this.constructor || Promise;
    return this.then(
      (value) => Constructor.resolve(callback?.()).then(() => value),
      (error) => Constructor.resolve(callback?.()).then(() => { throw error; }),
    );
  };
}

/** @param {Node} parent @param {unknown[]} items @param {Node|null} before */
function insertItems(parent, items, before) {
  const document = parent.ownerDocument || globalThis.document;
  for (const item of items) {
    const node = item instanceof Node ? item : document.createTextNode(String(item));
    parent.insertBefore(node, before);
  }
}

for (const prototype of [globalThis.Element?.prototype, globalThis.DocumentFragment?.prototype]) {
  if (!prototype) continue;
  if (!prototype.append) prototype.append = function append(...items) { insertItems(this, items, null); };
  if (!prototype.prepend) prototype.prepend = function prepend(...items) { insertItems(this, items, this.firstChild); };
  if (!prototype.replaceChildren) {
    prototype.replaceChildren = function replaceChildren(...items) {
      while (this.firstChild) this.removeChild(this.firstChild);
      insertItems(this, items, null);
    };
  }
}
for (const prototype of [globalThis.Element?.prototype, globalThis.CharacterData?.prototype, globalThis.DocumentType?.prototype]) {
  if (prototype && !prototype.remove) {
    prototype.remove = function remove() { if (this.parentNode) this.parentNode.removeChild(this); };
  }
}

export {};
