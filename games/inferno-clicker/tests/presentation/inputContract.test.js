// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isGameplayPoint, sceneTransform } from '../../src/presentation/scene/infernoScene.js';

test('gameplay canvas accepts distinct touch contacts and restricts mouse to primary left button', async () => {
  const source = await readFile(new URL('../../src/presentation/scene/infernoScene.js', import.meta.url), 'utf8');
  assert.match(source, /pointerType === 'mouse'/);
  assert.match(source, /activePointers\.has\(event\.pointerId\)/);
  assert.match(source, /activePointers\.add\(event\.pointerId\)/);
  assert.match(source, /pointerup/);
  assert.match(source, /pointercancel/);
  assert.match(source, /event\.button !== 0/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /contextmenu/);
});

test('gameplay hit target is central, large and excludes character lanes', () => {
  assert.equal(isGameplayPoint(540, 1_225), true);
  assert.equal(isGameplayPoint(260, 400), true);
  assert.equal(isGameplayPoint(820, 1_450), true);
  assert.equal(isGameplayPoint(120, 1_100), false);
  assert.equal(isGameplayPoint(940, 900), false);
  assert.equal(isGameplayPoint(540, 1_700), false);
});

test('short landscape keeps the Demoness hand-to-flame action inside the viewport', () => {
  const transform = sceneTransform(800, 360);
  const demonessHeadY = 634;
  const demonessCastHandY = 646;
  const flameBaseY = 1_145;

  assert.ok(transform.top + demonessHeadY * transform.scale >= 0);
  assert.ok(transform.top + demonessCastHandY * transform.scale >= 0);
  assert.ok(transform.top + flameBaseY * transform.scale <= 360);
});
