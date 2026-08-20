// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIXED_STEP_MS,
  MAX_SCORE,
  GameEngine,
  createInitialState,
  reduceFixedStep,
} from '../../src/core/index.js';

/** @param {import('../../src/core/contracts.js').GameState} state */
function playingState(state = createInitialState()) {
  return { ...state, phase: 'PLAYING' };
}

test('fixed step accepts every unique tap in timestamp order', () => {
  const initial = createInitialState();
  const result = reduceFixedStep(initial, [
    { type: 'tap', atMs: 0, inputId: 'first' },
    { type: 'tap', atMs: 10, inputId: 'second' },
    { type: 'tap', atMs: 10, inputId: 'third' },
    { type: 'tap', atMs: 49, inputId: 'fourth' },
  ]);
  assert.ok(Math.abs(result.state.heat - 41.975) < 1e-9);
  assert.equal(result.state.score, 120);
  assert.equal(result.events.filter((event) => event.type === 'tapAccepted').length, 4);
  assert.equal(result.events.filter((event) => event.type === 'tapRejected').length, 0);
});

test('duplicate ids are rejected but rapid unique input has no gameplay cap', () => {
  const commands = Array.from({ length: 100 }, (_, index) => ({
    type: /** @type {const} */ ('tap'), atMs: index / 3, inputId: `rapid-${index}`,
  }));
  commands.push({ type: 'tap', atMs: 40, inputId: 'rapid-0' });
  const result = reduceFixedStep(createInitialState(), commands);
  assert.equal(result.events.filter((event) => event.type === 'tapAccepted').length, 100);
  assert.equal(result.events.filter((event) => event.data?.reason === 'duplicate-input').length, 1);
  assert.ok(result.state.heat > 329 && result.state.heat < 330);
});

test('emergency guard accepts 256 commands per step and rejects only impossible overflow', () => {
  const commands = Array.from({ length: 300 }, (_, index) => ({
    type: /** @type {const} */ ('tap'), atMs: 0, inputId: `flood-${index}`,
  }));
  const result = reduceFixedStep(createInitialState(), commands);
  assert.equal(result.events.filter((event) => event.type === 'tapAccepted').length, 256);
  assert.equal(result.events.filter((event) => event.data?.reason === 'input-overflow').length, 44);
  assert.equal(result.state.heat, 797.35);
  assert.equal(result.state.scoreAcc, 35_745);
  assert.equal(result.state.runHighestStage, 6);
  const lastTap = result.events.filter((event) => event.type === 'tapAccepted').at(-1);
  assert.equal(lastTap?.data?.scoreAwarded, 97.5);
});

test('stage is recalculated before score and each upward stage bonus is granted once', () => {
  const initial = playingState(createInitialState());
  initial.heat = 78;
  initial.stageProgress = 78 / 80;
  const crossing = reduceFixedStep(initial, [{ type: 'tap', atMs: 0 }]);
  assert.equal(crossing.state.stage, 2);
  assert.equal(crossing.state.scoreAcc, 537.5);
  assert.deepEqual(crossing.state.grantedStageBonuses, [2]);

  const down = { ...crossing.state, heat: 79, stage: /** @type {1} */ (1), simulationTimeMs: 50 };
  const reentry = reduceFixedStep(down, [{ type: 'tap', atMs: 50 }]);
  assert.deepEqual(reentry.state.grantedStageBonuses, [2]);
  assert.equal(reentry.state.scoreAcc, 575);
});

test('tap power and multiplier are independent of input cadence', () => {
  const engine = new GameEngine();
  for (let index = 0; index < 20; index += 1) engine.queueTap(index * 10, `tap-${index}`);
  engine.advanceSteps(4);
  assert.equal(engine.drainEvents().filter((event) => event.type === 'tapAccepted').length, 20);
  assert.equal(engine.state.tapPower, 3);
  assert.equal(engine.state.multiplier, 1.25);
  assert.equal('rhythm' in engine.state, false);
});

test('pause reason-set freezes simulation and resumes only after every reason closes', () => {
  const engine = new GameEngine();
  engine.queueTap(0);
  engine.advanceSteps(1);
  const before = engine.state;
  engine.pause('menu');
  engine.pause('visibility');
  engine.queueTap(before.simulationTimeMs);
  engine.advanceFrame(10_000);
  assert.equal(engine.state.simulationTimeMs, before.simulationTimeMs);
  assert.equal(engine.state.heat, before.heat);
  assert.equal(engine.drainEvents().filter((event) => event.type === 'tapRejected' && event.data?.reason === 'phase').length, 1);
  engine.resume('menu');
  assert.equal(engine.state.phase, 'PAUSED');
  engine.resume('visibility');
  assert.equal(engine.state.phase, 'PLAYING');
});

test('sub-step encounter boundary applies old and new decay modifiers exactly', () => {
  const encounter = playingState(createInitialState());
  encounter.heat = 300;
  encounter.stage = 3;
  encounter.runHighestStage = 3;
  encounter.reachedStageTwo = true;
  encounter.encounters = [{ kind: 'servant', phase: 'telegraph', msLeft: 20 }];
  const encounterResult = reduceFixedStep(encounter, []);
  assert.equal(encounterResult.state.encounters[0]?.phase, 'effect');
  assert.equal(encounterResult.state.encounters[0]?.msLeft, 2_470);
  assert.ok(Math.abs(encounterResult.state.heat - 299.704) < 1e-9);
});

test('zero heat returns to READY before stage 2, but fails after a continuous 2s grace later', () => {
  const early = playingState(createInitialState());
  early.heat = 0;
  const reset = reduceFixedStep(early, []);
  assert.equal(reset.state.phase, 'READY');
  assert.equal(reset.state.heat, 30);
  assert.equal(reset.state.simulationTimeMs, FIXED_STEP_MS);

  const late = playingState(createInitialState());
  late.heat = 0;
  late.stage = 1;
  late.reachedStageTwo = true;
  late.runHighestStage = 2;
  const engine = new GameEngine(late);
  engine.advanceSteps(40);
  assert.equal(engine.state.phase, 'RESULTS');
  assert.equal(engine.state.records.runsPlayed, 1);
  assert.equal(engine.restart(), true);
  assert.equal(engine.state.phase, 'READY');
  assert.equal(engine.state.heat, 30);
  assert.equal(engine.state.score, 0);
  assert.equal(engine.state.runId, 2);
});

test('positive tap cancels fail grace and score saturates safely', () => {
  const initial = playingState(createInitialState());
  initial.heat = 0;
  initial.reachedStageTwo = true;
  initial.runHighestStage = 2;
  initial.failGraceMsLeft = 50;
  initial.scoreAcc = MAX_SCORE - 1;
  initial.score = MAX_SCORE - 1;
  const result = reduceFixedStep(initial, [{ type: 'tap', atMs: 0 }]);
  assert.equal(result.state.phase, 'PLAYING');
  assert.equal(result.state.failGraceMsLeft, null);
  assert.equal(result.state.score, MAX_SCORE);
});

test('confirmed restart routes through abandoned RESULTS and carries sanitized records into a clean run', () => {
  const initial = playingState(createInitialState());
  initial.scoreAcc = 1_234.75;
  initial.score = 1_234;
  initial.runHighestStage = 4;
  initial.runLongestInfernoHoldMs = 900;
  initial.maxMultiplier = 4;
  const engine = new GameEngine(initial);
  engine.pause('menu');
  assert.equal(engine.abandonRun(), true);
  assert.equal(engine.state.phase, 'RESULTS');
  assert.equal(engine.state.abandoned, true);
  assert.equal(engine.state.records.bestScore, 1_234);
  assert.equal(engine.state.records.highestStageReached, 4);
  assert.equal(engine.state.records.runsPlayed, 1);
  assert.equal(engine.restart(), true);
  assert.equal(engine.state.phase, 'READY');
  assert.equal(engine.state.records.bestScore, 1_234);
  assert.equal(engine.state.runHighestStage, 1);
  assert.equal(engine.state.rewardedUsedThisRun, false);
});
