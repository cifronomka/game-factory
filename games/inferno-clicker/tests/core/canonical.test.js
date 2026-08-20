// @ts-check

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayCanonicalDirect, replayTapRateScenario } from '../fixtures/canonical-direct.js';

/** @type {import('../fixtures/canonical-direct.js').DirectTraceConfig} */
const noReward = JSON.parse(readFileSync(new URL('../fixtures/direct-no-reward-canonical.json', import.meta.url), 'utf8'));
/** @type {import('../fixtures/canonical-direct.js').DirectTraceConfig} */
const boosted = JSON.parse(readFileSync(new URL('../fixtures/direct-boosted-canonical.json', import.meta.url), 'utf8'));
/** @type {{name:string,version:number,scenarios:import('../fixtures/canonical-direct.js').TapRateScenario[]}} */
const rateMatrix = JSON.parse(readFileSync(new URL('../fixtures/tap-rate-matrix.json', import.meta.url), 'utf8'));

/** @param {ReturnType<typeof replayCanonicalDirect>} run @param {import('../fixtures/canonical-direct.js').ExpectedTrace} expected */
function assertCanonical(run, expected) {
  assert.deepEqual(run.stageReachedAtMs, expected.stageReachedAtMs);
  assert.equal(run.acceptedTaps, expected.acceptedTaps);
  assert.equal(run.state.score, expected.score);
  assert.ok(Math.abs(run.state.heat - expected.heat) <= 0.01);
  assert.ok(Math.abs(run.state.currentInfernoHoldMs - expected.currentInfernoHoldMs) <= 0.01);
  assert.equal(run.state.runHighestStage, expected.runHighestStage);
}

test('paired canonical fixtures use the committed concurrent-event direct-tap V5 algorithm', () => {
  assert.equal(noReward.name, 'canonicalDirectNoRewardV5');
  assert.equal(boosted.name, 'canonicalDirectBoostedV5');
  assert.equal(noReward.version, 5);
  assert.equal(boosted.version, 5);
  assert.equal(noReward.firstTapMs, 0);
  assert.deepEqual(noReward.intervalByRunHighestStageMs, [500, 500, 250, 250, 200, 140, 140]);
  assert.deepEqual(boosted.intervalByRunHighestStageMs, noReward.intervalByRunHighestStageMs);
  assert.equal(noReward.stopMs, 180_000);
  assert.equal(boosted.stopMs, 180_000);
  assert.equal(boosted.rewardAtMs, 65_000);
});

for (const [label, fixture] of /** @type {const} */ ([['no-reward', noReward], ['boosted', boosted]])) {
  test(`canonical direct ${label} trace has exact 60/30/15 FPS parity`, () => {
    const runs = /** @type {const} */ ([60, 30, 15]).map((fps) => replayCanonicalDirect(fixture, fps));
    for (const run of runs) assertCanonical(run, fixture.expected);
    assert.deepEqual(runs[1], runs[0]);
    assert.deepEqual(runs[2], runs[0]);
  });
}

test('tap-rate matrix has exact slow/normal/fast/very-fast/boosted parity at 60/30/15 FPS', () => {
  assert.equal(rateMatrix.name, 'tapRateMatrixV2');
  assert.deepEqual(rateMatrix.scenarios.map((scenario) => scenario.name), [
    'slow', 'normal', 'fast', 'very-fast', 'boosted-normal',
  ]);
  for (const scenario of rateMatrix.scenarios) {
    const runs = /** @type {const} */ ([60, 30, 15]).map((fps) => replayTapRateScenario(scenario, fps));
    for (const run of runs) {
      assert.deepEqual(run.stageReachedAtMs, scenario.expected.stageReachedAtMs, scenario.name);
      assert.equal(run.acceptedTaps, scenario.expected.acceptedTaps, scenario.name);
      assert.equal(run.state.score, scenario.expected.score, scenario.name);
      assert.ok(Math.abs(run.state.heat - scenario.expected.heat) <= 0.01, scenario.name);
      assert.ok(Math.abs(run.maxHeat - scenario.expected.maxHeat) <= 0.5, scenario.name);
      assert.equal(run.state.currentInfernoHoldMs, scenario.expected.currentInfernoHoldMs, scenario.name);
      assert.equal(run.state.runHighestStage, scenario.expected.runHighestStage, scenario.name);
      assert.equal(run.state.stage, scenario.expected.finalStage, scenario.name);
    }
    for (const run of runs.slice(1)) {
      assert.deepEqual(run.state, runs[0]?.state, scenario.name);
      assert.deepEqual(run.stageReachedAtMs, runs[0]?.stageReachedAtMs, scenario.name);
      assert.equal(run.acceptedTaps, runs[0]?.acceptedTaps, scenario.name);
      assert.ok(Math.abs(run.maxHeat - (runs[0]?.maxHeat ?? 0)) <= 0.5, scenario.name);
    }
  }
});
