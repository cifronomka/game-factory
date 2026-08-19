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
