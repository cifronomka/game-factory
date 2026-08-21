// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { SpriteAnimator, gridFrames } from '../../src/presentation/scene/spriteAnimator.js';

const frames = gridFrames(4, 4, 32, 64);

test('loop clip advances authored cells and wraps', () => {
  const animator = new SpriteAnimator({ idle: { fps: 10, loop: true, frames } }, 'idle');
  animator.update(0.05);
  animator.update(0.05);
  assert.equal(animator.getFrameIndex(), 1);
  for (let index = 0; index < 4; index += 1) animator.update(0.05);
  assert.equal(animator.getFrameIndex(), 3);
  for (let index = 0; index < 2; index += 1) animator.update(0.05);
  assert.equal(animator.getFrameIndex(), 0);
});

test('non-loop clip holds its last frame and reports completion', () => {
  const animator = new SpriteAnimator({ appearance: { fps: 10, loop: false, frames } }, 'appearance');
  for (let index = 0; index < 12; index += 1) animator.update(0.05);
  assert.equal(animator.getFrameIndex(), 3);
  assert.equal(animator.isComplete(), true);
});

test('pause freezes elapsed clip time', () => {
  const animator = new SpriteAnimator({ idle: { fps: 10, loop: true, frames } }, 'idle');
  animator.update(0.05);
  animator.setPaused(true);
  animator.update(0.05);
  assert.equal(animator.snapshot().elapsed, 0.05);
});

test('temporal sample blends adjacent cells at render cadence with complementary weights', () => {
  const animator = new SpriteAnimator({ idle: { fps: 10, loop: true, frames } }, 'idle');
  const mixes = [];
  for (let index = 0; index < 6; index += 1) {
    animator.update(1 / 60);
    mixes.push(animator.getBlendSample().mix);
  }
  assert.ok(new Set(mixes.map((mix) => mix.toFixed(4))).size >= 5);
  assert.ok(mixes.every((mix) => mix >= 0 && mix <= 1));
  const sample = animator.getBlendSample();
  assert.equal(sample.currentIndex, 1);
  assert.equal(sample.nextIndex, 2);
  assert.ok(Math.abs((1 - sample.mix) + sample.mix - 1) < 1e-12);
});

test('temporal sample smooths the authored loop seam and wraps without a floating-point skip', () => {
  const animator = new SpriteAnimator({ idle: { fps: 10, loop: true, frames } }, 'idle');
  animator.setCycleProgress(0.975);
  const seam = animator.getBlendSample();
  assert.equal(seam.currentIndex, 3);
  assert.equal(seam.nextIndex, 0);
  assert.equal(seam.seam, true);
  assert.ok(seam.mix > 0 && seam.mix < 1);
  animator.update(0.01);
  const wrapped = animator.getBlendSample();
  assert.equal(wrapped.currentIndex, 0);
  assert.equal(wrapped.nextIndex, 1);
  assert.equal(wrapped.seam, false);
});

test('cycle phase can synchronize clips and remains frozen while paused', () => {
  const source = new SpriteAnimator({ idle: { fps: 10, loop: true, frames } }, 'idle');
  const target = new SpriteAnimator({ idle: { fps: 12, loop: true, frames } }, 'idle');
  source.update(0.137);
  target.setCycleProgress(source.getCycleProgress());
  assert.ok(Math.abs(target.getCycleProgress() - source.getCycleProgress()) < 1e-9);
  const before = target.getBlendSample();
  target.setPaused(true);
  target.update(0.05);
  assert.deepEqual(target.getBlendSample(), before);
});
