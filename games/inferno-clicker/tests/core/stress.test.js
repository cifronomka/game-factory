// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP_MS, GameEngine } from '../../src/core/index.js';

test('ten-minute active-time stress keeps every numeric and discrete invariant valid', () => {
  const engine = new GameEngine();
  let nextTapAt = 0;
  const steps = 600_000 / FIXED_STEP_MS;
  for (let index = 0; index < steps; index += 1) {
    const stepEnd = engine.state.simulationTimeMs + FIXED_STEP_MS;
    if (nextTapAt < stepEnd) {
      engine.queueTap(Math.max(engine.state.simulationTimeMs, nextTapAt), `stress-${index}`);
      nextTapAt += 280;
    }
    engine.advanceFrame(FIXED_STEP_MS);
    const state = engine.state;
    for (const value of [state.heat, state.scoreAcc, state.score, state.multiplier, state.stageProgress, state.activeRunTimeMs]) {
      assert.equal(Number.isFinite(value), true);
    }
    assert.ok(state.heat >= 0 && state.heat <= 1_000);
    assert.ok(state.stage >= 1 && state.stage <= 7);
    assert.ok(state.stageProgress >= 0 && state.stageProgress <= 1);
    assert.ok(state.multiplier >= 1 && state.multiplier <= 5);
  }
  assert.equal(engine.state.simulationTimeMs, 600_000);
  assert.ok(engine.state.runHighestStage >= 5);
});
