// @ts-check

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAtlas } from './build-cycle06-character-assets.mjs';

export const CYCLE08_SOURCE_ROOT = 'visual-references/cycle-08-sources';

const allEight = Object.freeze(Array.from({ length: 8 }, (_, index) => index));

// The Servant silhouette is retained, so its independently reviewed Cycle 07
// mouth landmarks remain valid for the cleaned Cycle 08 atlas family.
export const servantSockets = Object.freeze({
  idle: [[0.72, 0.34], [0.72, 0.34], [0.73, 0.34], [0.73, 0.34], [0.72, 0.35], [0.72, 0.35], [0.71, 0.35], [0.71, 0.35]],
  inhale: [[0.7185, 0.2979], [0.7146, 0.2989], [0.7185, 0.2998], [0.7254, 0.2989], [0.7146, 0.2861], [0.7107, 0.2881], [0.7068, 0.2900], [0.7029, 0.2920]],
  blow: [[0.790, 0.515], [0.785, 0.515], [0.790, 0.520], [0.750, 0.565], [0.785, 0.530], [0.775, 0.520], [0.735, 0.560], [0.705, 0.560]],
  recovery: [[0.71, 0.45], [0.71, 0.43], [0.71, 0.41], [0.71, 0.39], [0.71, 0.37], [0.71, 0.36], [0.72, 0.35], [0.72, 0.34]],
});

const cycle08CastHands = Object.freeze([
  [[0.3091, 0.5490], [0.6461, 0.5454]], [[0.2275, 0.4762], [0.6860, 0.4961]], [[0.0775, 0.3408], [0.7816, 0.4635]], [[0.1304, 0.3612], [0.5416, 0.4365]],
  [[0.1462, 0.3348], [0.4096, 0.4111]], [[0.1596, 0.3129], [0.4307, 0.3855]], [[0.1735, 0.3366], [0.3515, 0.4006]], [[0.1902, 0.3013], [0.3552, 0.3360]],
]);
const cycle08HoldHands = Object.freeze([
  [[0.1763, 0.3674], [0.4381, 0.4338]], [[0.1590, 0.3476], [0.3659, 0.3927]], [[0.1454, 0.3333], [0.3531, 0.4092]], [[0.1518, 0.3005], [0.3738, 0.3492]],
  [[0.2022, 0.3239], [0.3749, 0.3801]], [[0.2147, 0.3423], [0.4277, 0.4091]], [[0.2115, 0.3781], [0.3934, 0.4359]], [[0.1545, 0.3446], [0.4415, 0.4434]],
]);

// Cycle 07 runtime used cast positions as the fallback outside `hold`; writing
// that fallback explicitly gives every Cycle 08 frame auditable palm sockets.
export const demonessHands = Object.freeze({
  idle: cycle08CastHands,
  cast: cycle08CastHands,
  hold: cycle08HoldHands,
  recovery: cycle08CastHands,
});

const strictAlphaAudit = Object.freeze({
  matteRatioMax: 0.01,
  internalNeutralResidueRatioMax: 0.005,
  edgeAlphaPixelsMax: 0,
  transparentGutterPixelsMin: 4,
  sourceToAtlasUpscaleMax: 1,
  encodedAlphaExact: true,
});
const servantStrictAlphaAudit = Object.freeze({ ...strictAlphaAudit, detachedPartialAlphaPixelsMax: 0 });

const shared = Object.freeze({
  cycle: '08',
  generatedBy: 'ImageGen Cycle 08',
  sourceRoot: CYCLE08_SOURCE_ROOT,
  checker: false,
  backgroundRemoval: 'smart-alpha',
  sourceColumns: 4,
  sourceRows: 2,
  indices: allEight,
  componentMode: 'largest',
  preserveCellFraming: true,
  framingScale: 1,
  columns: 4,
  rows: 2,
  anatomicalScale: 1,
  strictAlphaAudit,
});

const servantSpecs = ['idle', 'inhale', 'blow', 'recovery'].map((clip) => Object.freeze({
  ...shared,
  strictAlphaAudit: servantStrictAlphaAudit,
  source: `ash-servant-${clip}-8-source.png`,
  output: `assets/characters/ash-servant/ash-servant-${clip}-v6.webp`,
  clip,
  frameWidth: 256,
  frameHeight: 320,
  quality: 92,
  alphaQuality: 100,
  fps: clip === 'idle' ? 6 : 10,
  loop: clip === 'idle',
  pivot: [0.5, 0.98125],
  sockets: servantSockets[clip].map((mouth) => ({ mouth })),
}));

const demonessSpecs = [
  { clip: 'idle', fps: 1.2, loop: true },
  { clip: 'cast', fps: 8, loop: false },
  { clip: 'hold', fps: 6, loop: true },
  { clip: 'recovery', fps: 8, loop: false },
].map((entry) => Object.freeze({
  ...shared,
  source: `demoness-${entry.clip}-8-source.png`,
  output: `assets/characters/demoness/demoness-${entry.clip}-v7.webp`,
  clip: entry.clip,
  frameWidth: 512,
  frameHeight: 832,
  quality: 66,
  alphaQuality: 100,
  effort: 6,
  fps: entry.fps,
  loop: entry.loop,
  pivot: [0.5, 0.99],
  sockets: demonessHands[entry.clip].map(([leftHand, rightHand]) => ({ leftHand, rightHand })),
}));

export const cycle08Specs = Object.freeze([...servantSpecs, ...demonessSpecs]);

function assertCycle08Spec(spec) {
  if (spec.cycle !== '08' || spec.sourceRoot !== CYCLE08_SOURCE_ROOT) throw new Error(`${spec.clip}: invalid Cycle 08 source contract`);
  if (spec.sourceColumns !== 4 || spec.sourceRows !== 2 || spec.columns !== 4 || spec.rows !== 2 || spec.indices.length !== 8) throw new Error(`${spec.clip}: Cycle 08 requires an eight-frame 4x2 sheet and atlas`);
  if (!Array.isArray(spec.sockets) || spec.sockets.length !== 8) throw new Error(`${spec.clip}: eight normalized socket records are required`);
  const servant = spec.output.includes('/ash-servant/');
  const expected = servant ? [256, 320, '-v6.webp'] : [512, 832, '-v7.webp'];
  if (spec.frameWidth !== expected[0] || spec.frameHeight !== expected[1] || !spec.output.endsWith(expected[2])) throw new Error(`${spec.clip}: invalid Cycle 08 frame/version contract`);
}

export async function buildCycle08CharacterAssets() {
  for (const spec of cycle08Specs) {
    assertCycle08Spec(spec);
    await buildAtlas(spec);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildCycle08CharacterAssets().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
