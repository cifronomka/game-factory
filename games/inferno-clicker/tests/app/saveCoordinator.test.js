// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveCoordinator } from '../../src/app/saveCoordinator.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve: /** @type {(value:any)=>void} */ (resolve) };
}

test('coalesces a burst and serializes changes arriving during a save', async () => {
  let value = 1;
  let active = 0;
  let maxActive = 0;
  const writes = [];
  const firstWrite = deferred();
  const coordinator = new SaveCoordinator({
    read: () => ({ value }),
    signature: (item) => String(item.value),
    delayMs: 60_000,
    save: async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      writes.push(item.value);
      if (item.value === 1) await firstWrite.promise;
      active -= 1;
      return { ok: true };
    },
  });
  coordinator.request();
  coordinator.request();
  const firstFlush = coordinator.flushNow();
  await Promise.resolve();
  assert.deepEqual(writes, [1]);
  value = 2;
  coordinator.request();
  firstWrite.resolve(undefined);
  await firstFlush;
  await coordinator.flushNow();
  assert.deepEqual(writes, [1, 2]);
  assert.equal(maxActive, 1);
  coordinator.dispose();
});
test('retries a retryable failure with bounded backoff through deterministic flushes', async () => {
  let attempts = 0;
  const coordinator = new SaveCoordinator({
    read: () => ({ value: 7 }),
    signature: (item) => String(item.value),
    delayMs: 60_000,
    maxRetries: 2,
    save: async () => ({ ok: ++attempts >= 3 }),
  });
  await coordinator.flushNow();
  await coordinator.flushNow();
  await coordinator.flushNow();
  assert.equal(attempts, 3);
  coordinator.dispose();
});

test('surfaces a final failure once after bounded retries', async () => {
  let failures = 0;
  let attempts = 0;
  const coordinator = new SaveCoordinator({
    read: () => ({ value: 9 }),
    signature: (item) => String(item.value),
    delayMs: 60_000,
    maxRetries: 1,
    save: async () => { attempts += 1; return { ok: false }; },
    onFailure: () => { failures += 1; },
  });
  await coordinator.flushNow();
  await coordinator.flushNow();
  assert.equal(attempts, 2);
  assert.equal(failures, 1);
  coordinator.dispose();
});

test('flushNow waits for an in-flight write and then persists the newest dirty snapshot', async () => {
  let value = 1;
  const writes = [];
  const firstWrite = deferred();
  const coordinator = new SaveCoordinator({
    read: () => ({ value }),
    signature: (item) => String(item.value),
    delayMs: 60_000,
    save: async (item) => {
      writes.push(item.value);
      if (item.value === 1) await firstWrite.promise;
      return { ok: true };
    },
  });
  const firstFlush = coordinator.flushNow();
  await Promise.resolve();
  assert.deepEqual(writes, [1]);
  value = 2;
  const newestFlush = coordinator.flushNow();
  firstWrite.resolve(undefined);
  await Promise.all([firstFlush, newestFlush]);
  assert.deepEqual(writes, [1, 2]);
  coordinator.dispose();
});
