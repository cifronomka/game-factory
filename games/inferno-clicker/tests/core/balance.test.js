// @ts-check

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildHumanTapTimestamps, replayHumanInputProfile } from '../fixtures/canonical-direct.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/human-input-profiles.json', import.meta.url), 'utf8'));

test('human-profile browser replay contract uses five plausible profiles plus one rewarded control', () => {
  assert.equal(fixture.version, 1);
  assert.deepEqual(fixture.profiles.map((profile) => profile.name), [
    'casual-mobile', 'fast-mobile', 'casual-mouse', 'skilled-mouse', 'extreme-burst', 'skilled-mouse-rewarded',
  ]);
  assert.deepEqual(fixture.profiles.map((profile) => profile.input), [
    'touch', 'touch', 'mouse', 'mouse', 'mouse', 'mouse',
  ]);
  for (const profile of fixture.profiles) {
    const timestamps = buildHumanTapTimestamps(profile);
    assert.ok(timestamps.length > 0);
    assert.ok(timestamps.every((value, index) => index === 0 || value > timestamps[index - 1]));
    assert.ok(timestamps.every((value) => value >= 0 && value < profile.stopMs));
  }
});

test('human-profile traces match exact progression at 60/30/15 FPS', () => {
  for (const profile of fixture.profiles) {
    const runs = [60, 30, 15].map((fps) => replayHumanInputProfile(profile, /** @type {15|30|60} */ (fps)));
    for (const run of runs) {
      const expected = profile.expected;
      assert.deepEqual(run.stageReachedAtMs, expected.stageReachedAtMs, profile.name);
      assert.equal(run.acceptedTaps, expected.acceptedTaps, profile.name);
      assert.equal(run.state.score, expected.score, profile.name);
      assert.ok(Math.abs(run.state.heat - expected.heat) <= 0.01, profile.name);
      assert.ok(Math.abs(run.maxHeat - expected.maxHeat) <= 0.5, profile.name);
      assert.ok(Math.abs(run.state.currentInfernoHoldMs - expected.currentInfernoHoldMs) <= 0.01, profile.name);
      assert.ok(Math.abs(run.state.runLongestInfernoHoldMs - expected.runLongestInfernoHoldMs) <= 0.01, profile.name);
      assert.equal(run.state.runHighestStage, expected.runHighestStage, profile.name);
      assert.equal(run.state.stage, expected.finalStage, profile.name);
      assert.equal(run.maxConcurrentEnemyDebuffs, expected.maxConcurrentEnemyDebuffs, profile.name);
      assert.equal(run.rewardResolvedAtMs, expected.rewardResolvedAtMs, profile.name);
    }
    assert.deepEqual(runs[1]?.state, runs[0]?.state, profile.name);
    assert.deepEqual(runs[2]?.state, runs[0]?.state, profile.name);
  }
});

test('no-reward skilled pattern reaches Inferno and optional x2 materially improves entry and hold', () => {
  const skilled = fixture.profiles.find((profile) => profile.name === 'skilled-mouse');
  const rewarded = fixture.profiles.find((profile) => profile.name === 'skilled-mouse-rewarded');
  assert.ok(skilled && rewarded);
  const direct = replayHumanInputProfile(skilled, 60);
  const assisted = replayHumanInputProfile(rewarded, 60);
  assert.equal(direct.state.runHighestStage, 7);
  assert.equal(direct.state.rewardedUsedThisRun, false);
  assert.ok((direct.stageReachedAtMs['7'] ?? Infinity) - (assisted.stageReachedAtMs['7'] ?? 0) >= 20_000);
  assert.ok(assisted.state.runLongestInfernoHoldMs - direct.state.runLongestInfernoHoldMs >= 60_000);
  assert.ok(assisted.state.score - direct.state.score >= 18_000);
});
