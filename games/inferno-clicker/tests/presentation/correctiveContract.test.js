// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** @param {string} path */
async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('production gameplay and presentation contain no legacy rhythm mechanic', async () => {
  const modules = await Promise.all([
    source('../../src/core/config.js'),
    source('../../src/core/contracts.js'),
    source('../../src/core/engine.js'),
    source('../../src/app/viewModel.js'),
    source('../../src/presentation/types.js'),
    source('../../src/presentation/ui/domHud.js'),
    source('../../src/presentation/scene/flameRig.js'),
  ]);
  const joined = modules.join('\n').toLowerCase();
  for (const forbidden of ['resonance', 'rhythm', 'cadencefactor', 'surge_duration', 'breath_duration', 'too-fast']) {
    assert.equal(joined.includes(forbidden), false, `legacy token remains: ${forbidden}`);
  }
});

test('production audio has no oscillator or per-tap tone generator', async () => {
  const audio = await source('../../src/presentation/audio/audioMixer.js');
  assert.doesNotMatch(audio, /createOscillator|OscillatorNode|playTap|TAP_FREQUENCIES|\btone\s*\(|\.createBuffer\(/);
  assert.match(audio, /ensureAuthoredAudio/);
  assert.match(audio, /embers-wood-bed\.ogg/);
  assert.match(audio, /charcoal-crackle\.ogg/);
  assert.match(audio, /fan-soft-a\.ogg/);
  assert.match(audio, /pendingFanTaps/);
  assert.doesNotMatch(audio, /fire-loop\.(?:ogg|flac)/);
});

test('flame and characters use authored frame atlases without static-card deformation fallback', async () => {
  const [flame, characters] = await Promise.all([
    source('../../src/presentation/scene/flameRig.js'),
    source('../../src/presentation/scene/characterScene.js'),
  ]);
  assert.match(flame, /core-low-v2\.webp/);
  assert.match(flame, /outer-high-v2\.webp/);
  assert.match(flame, /stage-flare-v2\.webp/);
  assert.match(flame, /SpriteAnimator/);
  assert.doesNotMatch(flame, /flame-core-organic|flame-outer-organic|inferno-beam-organic|drawSlice|slice deformation/i);
  assert.match(characters, /ash-servant-states-v3\.webp/);
  assert.match(characters, /demoness-states-v3\.webp/);
  assert.match(characters, /appearance.*idle.*inhale.*blow/s);
  assert.match(characters, /appearance.*idle.*cast.*hold/s);
  assert.doesNotMatch(characters, /drawServant|drawDemoness|fallback character/i);
});

test('test rewarded provider remains explicit and removed seal presentation cannot regress', async () => {
  const [types, hud] = await Promise.all([
    source('../../src/presentation/types.js'),
    source('../../src/presentation/ui/domHud.js'),
  ]);
  assert.match(types, /rewardedProvider/);
  assert.doesNotMatch(types, /sealBroken|sealLockedAtCap|seal-blocked|seal-broken/);
  assert.doesNotMatch(hud, /Печать удерживает предел|data-seal/);
  assert.match(hud, /Получить ×2 \(тест\)/);
  assert.match(hud, /data-debuffs/);
  assert.match(hud, /Общий decay/);
});
