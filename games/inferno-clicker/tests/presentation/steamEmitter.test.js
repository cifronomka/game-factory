// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEAM_CONTACT_REACH,
  drawSteamStream,
  steamParticles,
  steamStreamGeometry,
} from '../../src/presentation/scene/steamEmitter.js';

test('steam sampling is deterministic, bounded, and reduced-motion aware', () => {
  const options = {
    time: 3.25,
    strength: 0.8,
    source: { x: 120, y: 240 },
    target: { x: 540, y: 1_050 },
    reach: 0.62,
    seed: 7,
  };
  const first = steamParticles(options);
  const second = steamParticles(options);
  assert.deepEqual(first, second);
  assert.equal(first.length, 64);
  assert.ok(first.every(({ progress }) => progress >= 0 && progress <= 0.62));
  assert.equal(steamParticles({ ...options, reducedMotion: true }).length, 32);
  assert.deepEqual(steamParticles({ ...options, strength: 0 }), []);
});

test('stream contact cannot precede the authored travel threshold', () => {
  const source = { x: 120, y: 240 };
  const target = { x: 540, y: 1_050 };
  const before = steamStreamGeometry(source, target, STEAM_CONTACT_REACH - 0.001);
  assert.equal(before.contact, false);
  assert.equal(before.contactPoint, null);
  const contact = steamStreamGeometry(source, target, STEAM_CONTACT_REACH);
  assert.equal(contact.contact, true);
  assert.deepEqual(contact.leading, {
    x: source.x + (target.x - source.x) * STEAM_CONTACT_REACH,
    y: source.y + (target.y - source.y) * STEAM_CONTACT_REACH,
  });
});

test('renderer begins exactly at the supplied anatomical socket', () => {
  const ellipses = [];
  const context = {
    save() {}, restore() {}, beginPath() {}, fill() {},
    ellipse(x, y, ...rest) { ellipses.push([x, y, ...rest]); },
  };
  const source = { x: 321.5, y: 876.25 };
  drawSteamStream(/** @type {any} */ (context), {
    time: 1,
    strength: 1,
    source,
    target: { x: 540, y: 1_050 },
    seed: 3,
  });
  assert.deepEqual(ellipses[0].slice(0, 2), [source.x, source.y]);
  assert.equal(ellipses.length, 65, 'steam is rendered as a bounded source puff plus overlapping irregular vapor clouds');
});
