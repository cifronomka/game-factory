// @ts-check

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createI18n } from '../../src/app/i18n.js';

const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url));
const i18nSourcePath = fileURLToPath(new URL('../../src/app/i18n.js', import.meta.url));

/** @param {string} locale @param {string} nextMarker */
function dictionaryKeys(locale, nextMarker) {
  const source = readFileSync(i18nSourcePath, 'utf8');
  const startMarker = `${locale}: Object.freeze({`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(nextMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${locale} dictionary start must be discoverable`);
  assert.notEqual(end, -1, `${locale} dictionary end must be discoverable`);
  return [...source.slice(start, end).matchAll(/^\s*'([^']+)':/gmu)].map((match) => match[1]);
}

/** @param {string} directory */
function productionJavaScript(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionJavaScript(path);
    return entry.isFile() && entry.name.endsWith('.js') && path !== i18nSourcePath ? [path] : [];
  });
}

function productionTranslationKeys() {
  const keys = new Set();
  for (const path of productionJavaScript(sourceRoot)) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/['"]([a-z][a-zA-Z0-9-]*\.[a-zA-Z0-9][a-zA-Z0-9.-]*)['"]/gu)) {
      if (match[1] !== 'leaderboards.getEntries' && match[1] !== 'leaderboards.setScore') keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

test('RU/EN number formatting has a deterministic fallback when Intl is absent', () => {
  const original = globalThis.Intl;
  try {
    // @ts-expect-error compatibility simulation
    globalThis.Intl = undefined;
    const ru = createI18n('ru');
    const en = createI18n('en');
    assert.equal(ru.number(250000), '250\u00a0000');
    assert.equal(ru.decimal(12.5), '12,5');
    assert.equal(en.number(250000), '250,000');
    assert.equal(en.seconds(12550), '12.55');
  } finally {
    globalThis.Intl = original;
  }
});

test('RU and EN dictionaries have strict key parity without duplicates', () => {
  const ruKeys = dictionaryKeys('ru', 'en: Object.freeze({');
  const enKeys = dictionaryKeys('en', '/** @param {unknown}');
  assert.equal(new Set(ruKeys).size, ruKeys.length, 'RU dictionary must not contain duplicate keys');
  assert.equal(new Set(enKeys).size, enKeys.length, 'EN dictionary must not contain duplicate keys');
  assert.deepEqual([...ruKeys].sort(), [...enKeys].sort());
});

test('every production translation key resolves in RU and EN without key-shaped fallback', () => {
  const ruKeys = new Set(dictionaryKeys('ru', 'en: Object.freeze({'));
  const enKeys = new Set(dictionaryKeys('en', '/** @param {unknown}'));
  const ru = createI18n('ru');
  const en = createI18n('en');

  for (const key of productionTranslationKeys()) {
    assert.ok(ruKeys.has(key), `RU dictionary is missing production key ${key}`);
    assert.ok(enKeys.has(key), `EN dictionary is missing production key ${key}`);
    assert.notEqual(ru.t(key), key, `RU fell back to production key ${key}`);
    assert.notEqual(en.t(key), key, `EN fell back to production key ${key}`);
  }
});
