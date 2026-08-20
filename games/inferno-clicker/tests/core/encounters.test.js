// @ts-check

import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine, createInitialState } from '../../src/core/index.js';

/** @param {import('../../src/core/config.js').Stage} stage @param {number} heat */
function stateAt(stage, heat) {
  const state = createInitialState();
  state.phase = 'PLAYING';
  state.stage = stage;
  state.runHighestStage = stage;
  state.reachedStageTwo = true;
  state.heat = heat;
  return state;
}

test('all due independent channels start together in deterministic event order', () => {
  const state = stateAt(6, 800);
  state.encounterClocks = { servantMs: 0, demonessMs: 0, heatWindowMs: 0, heatWindowSequenceIndex: 0 };
  const engine = new GameEngine(state);
  engine.advanceSteps(1);
  assert.deepEqual(engine.state.encounters.map((item) => item.kind), ['demoness', 'servant', 'heat-window']);
  assert.deepEqual(
    engine.drainEvents().filter((item) => item.type === 'encounterStarted').map((item) => item.data?.kind),
    ['demoness', 'servant', 'heat-window'],
  );
});

test('telegraph taps remain direct gameplay and cannot cancel either enemy source', () => {
  const state = stateAt(5, 600);
  state.encounters = [
    { kind: 'servant', phase: 'telegraph', msLeft: 1_000 },
    { kind: 'demoness', phase: 'telegraph', msLeft: 1_500 },
  ];
  state.encounterClocks.servantMs = null;
  state.encounterClocks.demonessMs = null;
  const engine = new GameEngine(state);
  for (const atMs of [0, 200, 400, 600]) engine.queueTap(atMs);
  engine.advanceSteps(13);
  assert.deepEqual(engine.state.encounters.map((item) => item.kind), ['servant', 'demoness']);
  assert.equal(engine.state.tapPower, 3);
  assert.equal(engine.drainEvents().filter((item) => item.type === 'tapAccepted').length, 4);
});

test('servant and demoness factors multiply with a global 2.50 cap', () => {
  const servantState = stateAt(3, 300);
  servantState.encounters = [{ kind: 'servant', phase: 'effect', msLeft: 2_500 }];
  const servant = new GameEngine(servantState);
  servant.advanceSteps(1);
  assert.equal(servant.state.decayFactor, 1.8);
  assert.equal(servant.state.decayRate, 7.2);

  const demonState = stateAt(5, 600);
  demonState.encounters = [{ kind: 'demoness', phase: 'effect', msLeft: 4_000 }];
  const demon = new GameEngine(demonState);
  demon.advanceSteps(1);
  assert.equal(demon.state.decayFactor, 1.5);
  assert.equal(demon.state.decayRate, 13.5);

  const stackedState = stateAt(5, 600);
  stackedState.encounters = [
    { kind: 'servant', phase: 'effect', msLeft: 2_500 },
    { kind: 'demoness', phase: 'effect', msLeft: 4_000 },
  ];
  const stacked = new GameEngine(stackedState);
  stacked.advanceSteps(1);
  assert.equal(stacked.state.decayFactor, 2.5);
  assert.equal(stacked.state.decayRate, 22.5);
  assert.ok(Math.abs(stacked.state.heat - 598.875) < 1e-9);
});

test('rapid taps do not cancel concurrent active debuffs or shorten their timers', () => {
  const state = stateAt(5, 600);
  state.encounters = [
    { kind: 'servant', phase: 'effect', msLeft: 2_500 },
    { kind: 'demoness', phase: 'effect', msLeft: 4_000 },
  ];
  const engine = new GameEngine(state);
  for (let index = 0; index < 20; index += 1) engine.queueTap(index * 2, `stack-${index}`);
  engine.advanceSteps(1);
  assert.equal(engine.drainEvents().filter((item) => item.type === 'tapAccepted').length, 20);
  assert.deepEqual(engine.state.encounters.map((item) => item.msLeft), [2_450, 3_950]);
  assert.equal(engine.state.decayFactor, 2.5);
});

test('heat window is independent and stacks with rewarded heat, not direct ad score', () => {
  const state = stateAt(6, 800);
  state.encounters = [
    { kind: 'servant', phase: 'effect', msLeft: 1_000 },
    { kind: 'heat-window', phase: 'effect', msLeft: 1_500 },
  ];
  state.boost = { msLeft: 20_000 };
  state.rewardedUsedThisRun = true;
  state.grantedStageBonuses = [2, 3, 4, 5, 6];
  const engine = new GameEngine(state);
  engine.queueTap(0);
  engine.advanceSteps(1);
  assert.equal(engine.state.tapPower, 12);
  assert.equal(engine.state.scoreAcc, 195);
  assert.equal(engine.state.multiplier, 3.25);
  assert.equal(engine.state.decayFactor, 1.8);
});

test('stage exit cancels ineligible channels but active demoness finishes', () => {
  const state = stateAt(3, 220.01);
  state.encounters = [
    { kind: 'servant', phase: 'effect', msLeft: 2_500 },
    { kind: 'demoness', phase: 'effect', msLeft: 100 },
    { kind: 'heat-window', phase: 'effect', msLeft: 1_500 },
  ];
  const engine = new GameEngine(state);
  engine.advanceSteps(1);
  assert.deepEqual(engine.state.encounters.map((item) => item.kind), ['demoness']);
  assert.equal(engine.state.encounters[0]?.msLeft, 50);
});
