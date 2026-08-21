// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceQualityController } from '../../src/app/performanceQuality.js';

function observeFor(controller, { startMs = 0, durationMs, refreshHz, workMs, state }) {
  let changes = 0;
  const step = 1_000 / refreshHz;
  for (let at = startMs; at <= startMs + durationMs; at += step) {
    changes += Number(controller.observe(at, typeof workMs === 'function' ? workMs(at) : workMs, state));
  }
  return changes;
}

test('downgrades exactly once after warm-up and two sustained expensive render windows', () => {
  const controller = new PerformanceQualityController({ warmupMs: 500, windowMs: 500, thresholdMs: 20, minSamples: 5 });
  let changes = observeFor(controller, { durationMs: 1_700, refreshHz: 60, workMs: 28 });
  assert.equal(changes, 1);
  changes += observeFor(controller, { startMs: 1_800, durationMs: 1_000, refreshHz: 60, workMs: 35 });
  assert.equal(changes, 1);
  assert.deepEqual(controller.getDiagnostics(), {
    downgraded: true,
    reason: 'sustained-render-cost',
    renderP95Ms: 28,
    thresholdMs: 20,
    confirmedWindows: 2,
  });
});

for (const refreshHz of [30, 40, 60, 120]) {
  test(`does not mistake ${refreshHz} Hz requestAnimationFrame cadence for render cost`, () => {
    const controller = new PerformanceQualityController({ warmupMs: 200, windowMs: 400, thresholdMs: 20, minSamples: 5 });
    const changes = observeFor(controller, { durationMs: 2_000, refreshHz, workMs: 8 });
    assert.equal(changes, 0);
    assert.equal(controller.getDiagnostics().reason, null);
  });
}

test('transient render spikes do not confirm a downgrade', () => {
  const controller = new PerformanceQualityController({ warmupMs: 200, windowMs: 500, thresholdMs: 20, minSamples: 5 });
  const changes = observeFor(controller, {
    durationMs: 2_500,
    refreshHz: 60,
    workMs: (at) => Math.round(at / (1_000 / 60)) % 30 === 0 ? 45 : 8,
  });
  assert.equal(changes, 0);
});

test('startup samples are ignored during warm-up', () => {
  const controller = new PerformanceQualityController({ warmupMs: 500, windowMs: 400, thresholdMs: 20, minSamples: 5 });
  let changes = observeFor(controller, { durationMs: 450, refreshHz: 60, workMs: 80 });
  changes += observeFor(controller, { startMs: 500, durationMs: 1_500, refreshHz: 60, workMs: 8 });
  assert.equal(changes, 0);
});

test('hidden and paused periods reset confirmation and resume through warm-up', () => {
  const controller = new PerformanceQualityController({ warmupMs: 300, windowMs: 400, thresholdMs: 20, minSamples: 5 });
  let changes = observeFor(controller, { durationMs: 850, refreshHz: 60, workMs: 35 });
  assert.equal(changes, 0, 'only one expensive window was observed');
  controller.observe(900, 500, { visible: false });
  controller.observe(5_000, 500, { paused: true });
  changes += observeFor(controller, { startMs: 5_100, durationMs: 650, refreshHz: 60, workMs: 35 });
  assert.equal(changes, 0, 'resume warm-up cannot reuse confirmation from before suspension');
  changes += observeFor(controller, { startMs: 5_800, durationMs: 1_000, refreshHz: 60, workMs: 8 });
  assert.equal(changes, 0);
});
