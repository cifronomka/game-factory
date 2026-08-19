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
  state.sealBroken = stage >= 5;
  return state;
}

test('event priority is demoness, servant, then heat window', () => {
  const state = stateAt(6, 800);
  state.encounterClocks = { servantMs: 0, demonessMs: 0, heatWindowMs: 0, heatWindowSequenceIndex: 0, globalGapMs: 0 };
  const engine = new GameEngine(state);
  engine.advanceSteps(1);
  assert.equal(engine.state.encounter?.kind, 'demoness');
});

test('telegraph taps remain direct gameplay and cannot cancel servant', () => {
  const state = stateAt(3, 300);
  state.encounter = { kind: 'servant', phase: 'telegraph', msLeft: 1_000 };
  state.encounterClocks.servantMs = null;
  const engine = new GameEngine(state);
  for (const atMs of [0, 200, 400, 600]) engine.queueTap(atMs);
  engine.advanceSteps(13);
  assert.equal(engine.state.encounter?.kind, 'servant');
  assert.equal(engine.state.encounter?.phase, 'telegraph');
  assert.equal(engine.state.tapPower, 3);
  assert.equal(engine.drainEvents().filter((item) => item.type === 'tapAccepted').length, 4);
});

test('uncountered servant and demoness activate their committed debuffs', () => {
  const servantState = stateAt(3, 300);
  servantState.encounter = { kind: 'servant', phase: 'telegraph', msLeft: 50 };
  const servant = new GameEngine(servantState);
  servant.advanceSteps(1);
  assert.equal(servant.state.encounter?.phase, 'effect');
  assert.equal(servant.state.decayRate, 7.2);

  const demonState = stateAt(5, 600);
  demonState.encounter = { kind: 'demoness', phase: 'telegraph', msLeft: 50 };
  const demon = new GameEngine(demonState);
  demon.advanceSteps(1);
  assert.equal(demon.state.encounter?.phase, 'effect');
  assert.equal(demon.state.decayRate, 13.5);
  demon.queueTap(50);
  demon.advanceSteps(1);
  assert.equal(demon.state.tapPower, 3);
});

test('heat window doubles every tap without changing stage multiplier', () => {
  const state = stateAt(6, 800);
  state.encounter = { kind: 'heat-window', phase: 'effect', msLeft: 1_500 };
  const engine = new GameEngine(state);
  engine.queueTap(0);
  engine.advanceSteps(1);
  assert.equal(engine.state.tapPower, 6);
  assert.equal(engine.state.multiplier, 3.25);
});

test('heat window stacks with rewarded heat while assisted heat stays out of tap score', () => {
  const state = stateAt(6, 800);
  state.encounter = { kind: 'heat-window', phase: 'effect', msLeft: 1_500 };
  state.boost = { msLeft: 20_000 };
  state.rewardedUsedThisRun = true;
  state.grantedStageBonuses = [2, 3, 4, 5, 6];
  const engine = new GameEngine(state);
  engine.queueTap(0);
  engine.advanceSteps(1);
  assert.equal(engine.state.tapPower, 12);
  assert.equal(engine.state.scoreAcc, 195);
  assert.equal(engine.state.multiplier, 3.25);
});

test('stage exit cancels servant and heat-window, while active demoness effect finishes', () => {
  const servantState = stateAt(3, 220.01);
  servantState.encounter = { kind: 'servant', phase: 'effect', msLeft: 2_500 };
  const servant = new GameEngine(servantState);
  servant.advanceSteps(1);
  assert.equal(servant.state.encounter, null);

  const heatState = stateAt(6, 730.01);
  heatState.encounter = { kind: 'heat-window', phase: 'effect', msLeft: 1_500 };
  const heat = new GameEngine(heatState);
  heat.advanceSteps(1);
  assert.equal(heat.state.encounter, null);

  const demonState = stateAt(5, 560.01);
  demonState.encounter = { kind: 'demoness', phase: 'effect', msLeft: 100 };
  const demon = new GameEngine(demonState);
  demon.advanceSteps(1);
  assert.equal(demon.state.encounter?.kind, 'demoness');
});
