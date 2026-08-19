// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveCoordinator } from '../../src/app/saveCoordinator.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('coalesces a burst and serializes changes arriving during a save', async () => {
  let value = 1;
  let active = 0;
  let maxActive = 0;
  const writes = [];
  const coordinator = new SaveCoordinator({
    read: () => ({ value }),
    signature: (item) => String(item.value),
    delayMs: 5,
    save: async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      writes.push(item.value);
      await wait(12);
      active -= 1;
      return { ok: true };
    },
  });
  coordinator.request();
  coordinator.request();
  await wait(8);
  value = 2;
  coordinator.request();
  await wait(40);
  assert.deepEqual(writes, [1, 2]);
  assert.equal(maxActive, 1);
  coordinator.dispose();
});

test('retries a retryable failure with bounded backoff', async () => {
  let attempts = 0;
  const coordinator = new SaveCoordinator({
    read: () => ({ value: 7 }),
    signature: (item) => String(item.value),
    delayMs: 2,
    maxRetries: 2,
    save: async () => ({ ok: ++attempts >= 3 }),
  });
  coordinator.request();
  await wait(35);
  assert.equal(attempts, 3);
  coordinator.dispose();
});

test('surfaces a final failure once after bounded retries', async () => {
  let failures = 0;
  let attempts = 0;
  const coordinator = new SaveCoordinator({
    read: () => ({ value: 9 }),
    signature: (item) => String(item.value),
    delayMs: 1,
    maxRetries: 1,
    save: async () => { attempts += 1; return { ok: false }; },
    onFailure: () => { failures += 1; },
  });
  coordinator.request();
  await wait(15);
  assert.equal(attempts, 2);
  assert.equal(failures, 1);
  coordinator.dispose();
});

test('flushNow waits for an in-flight write and then persists the newest dirty snapshot', async () => {
  let value = 1;
  const writes = [];
  const coordinator = new SaveCoordinator({
    read: () => ({ value }),
    signature: (item) => String(item.value),
    delayMs: 1,
    save: async (item) => { writes.push(item.value); await wait(8); return { ok: true }; },
  });
  coordinator.request();
  await wait(3);
  value = 2;
  await coordinator.flushNow();
  assert.deepEqual(writes, [1, 2]);
  coordinator.dispose();
});
