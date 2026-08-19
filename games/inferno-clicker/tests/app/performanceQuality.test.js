// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceQualityController } from '../../src/app/performanceQuality.js';

test('downgrades exactly once after a full five-second over-budget p95 window', () => {
  const controller = new PerformanceQualityController();
  let changes = 0;
  for (let at = 0; at <= 5_100; at += 30) changes += Number(controller.observe(at, 30));
  assert.equal(changes, 1);
  for (let at = 5_130; at <= 12_000; at += 40) changes += Number(controller.observe(at, 40));
  assert.equal(changes, 1);
});

test('does not downgrade when p95 remains within budget', () => {
  const controller = new PerformanceQualityController();
  let changed = false;
  for (let at = 0; at <= 6_000; at += 16) changed ||= controller.observe(at, at % 800 === 0 ? 40 : 16);
  assert.equal(changed, false);
});
