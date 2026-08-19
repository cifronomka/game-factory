// @ts-check

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayCanonicalSeal } from '../fixtures/canonical-seal.js';

const noBoostUrl = new URL('../fixtures/seal-no-boost-canonical.json', import.meta.url);
const boostedUrl = new URL('../fixtures/seal-boosted-canonical.json', import.meta.url);
/** @type {import('../fixtures/canonical-seal.js').CanonicalSealTraceConfig} */
const noBoost = JSON.parse(readFileSync(noBoostUrl, 'utf8'));
/** @type {import('../fixtures/canonical-seal.js').CanonicalSealTraceConfig} */
const boosted = JSON.parse(readFileSync(boostedUrl, 'utf8'));

test('paired canonical fixtures share the committed V3 input algorithm', () => {
  assert.equal(noBoost.name, 'canonicalSealNoBoostV3');
  assert.equal(boosted.name, 'canonicalSealBoostedV3');
  assert.equal(noBoost.version, 3);
  assert.equal(boosted.version, 3);
  assert.equal(noBoost.firstTapMs, 0);
  assert.deepEqual(noBoost.intervalByRunHighestStageMs, [500, 500, 250, 250, 200, 140, 140]);
  assert.deepEqual(boosted.intervalByRunHighestStageMs, noBoost.intervalByRunHighestStageMs);
  assert.equal(noBoost.stopMs, 117_000);
  assert.equal(boosted.stopMs, 117_000);
  assert.equal(boosted.rewardAtMs, 102_000);
});

test('canonical no-boost trace hits the Stage 4 seal identically at 60, 30 and 15 FPS', () => {
  const runs = /** @type {const} */ ([60, 30, 15]).map((fps) => replayCanonicalSeal(noBoost, fps));
  const baseline = runs[0];
  assert.ok(baseline);
  for (const run of runs) {
    assert.equal(run.state.runHighestStage, noBoost.expectedRunHighestStage);
    assert.equal(run.state.sealBroken, false);
    assert.equal(run.state.sealCapImpulses, noBoost.expectedSealCapImpulses);
    assert.equal(run.sealBlockedCount, noBoost.expectedSealCapImpulses);
    assert.equal(run.firstSealBlockedAtMs, noBoost.expectedFirstSealBlockedAtMs);
    assert.equal(run.maxHeat, noBoost.expectedMaxHeat);
    assert.deepEqual(run.stageReachedAtMs, baseline.stageReachedAtMs);
    assert.equal(run.state.score, baseline.state.score);
    assert.equal(run.acceptedTaps, baseline.acceptedTaps);
    assert.deepEqual(run.stageReachedAtMs, noBoost.expectedStageReachedAtMs);
    assert.equal(run.state.score, noBoost.expectedFinalScore);
    assert.equal(run.acceptedTaps, noBoost.expectedAcceptedTaps);
    assert.ok(Math.abs(run.state.heat - noBoost.expectedFinalHeat) <= 0.01);
    assert.equal('5' in run.stageReachedAtMs, false);
  }
});

test('canonical rewarded trace breaks the seal and reaches Inferno identically at 60, 30 and 15 FPS', () => {
  const runs = /** @type {const} */ ([60, 30, 15]).map((fps) => replayCanonicalSeal(boosted, fps));
  const baseline = runs[0];
  assert.ok(baseline);
  for (const run of runs) {
    assert.equal(run.state.runHighestStage, boosted.expectedRunHighestStage);
    assert.equal(run.state.sealBroken, true);
    assert.equal(run.state.sealCapImpulses, boosted.expectedSealCapImpulses);
    assert.equal(run.sealBlockedCount, boosted.expectedSealCapImpulses);
    assert.equal(run.firstSealBlockedAtMs, boosted.expectedFirstSealBlockedAtMs);
    assert.deepEqual(run.stageReachedAtMs, baseline.stageReachedAtMs);
    assert.equal(run.state.score, baseline.state.score);
    assert.equal(run.acceptedTaps, baseline.acceptedTaps);
    assert.deepEqual(run.stageReachedAtMs, boosted.expectedStageReachedAtMs);
    assert.equal(run.state.score, boosted.expectedFinalScore);
    assert.equal(run.acceptedTaps, boosted.expectedAcceptedTaps);
    assert.ok(Math.abs(run.state.heat - boosted.expectedFinalHeat) <= 0.01);
    assert.equal(run.state.boost?.msLeft, boosted.expectedBoostMsLeft);
    assert.ok(Math.abs(run.state.currentInfernoHoldMs - (boosted.expectedCurrentInfernoHoldMs ?? 0)) < 1e-6);
  }
});
