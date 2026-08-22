// @ts-check

import { buildAtlas } from './build-cycle06-character-assets.mjs';

const allEight = Array.from({ length: 8 }, (_, index) => index);
const sourceRoot = 'visual-references/cycle-07-sources';

const servantSockets = Object.freeze({
  idle: [[0.72, 0.34], [0.72, 0.34], [0.73, 0.34], [0.73, 0.34], [0.72, 0.35], [0.72, 0.35], [0.71, 0.35], [0.71, 0.35]],
  inhale: [[0.7185, 0.2979], [0.7146, 0.2989], [0.7185, 0.2998], [0.7254, 0.2989], [0.7146, 0.2861], [0.7107, 0.2881], [0.7068, 0.2900], [0.7029, 0.2920]],
  blow: [[0.790, 0.515], [0.785, 0.515], [0.790, 0.520], [0.750, 0.565], [0.785, 0.530], [0.775, 0.520], [0.735, 0.560], [0.705, 0.560]],
  recovery: [[0.71, 0.45], [0.71, 0.43], [0.71, 0.41], [0.71, 0.39], [0.71, 0.37], [0.71, 0.36], [0.72, 0.35], [0.72, 0.34]],
});

const demonessHands = Object.freeze({
  cast: [
    [[0.2886, 0.5665], [0.6600, 0.5665]], [[0.1686, 0.5525], [0.6829, 0.5665]], [[0.0714, 0.3710], [0.7571, 0.4548]], [[0.0943, 0.3897], [0.5114, 0.4455]],
    [[0.1229, 0.3849], [0.3514, 0.4594]], [[0.1800, 0.3849], [0.3400, 0.4082]], [[0.1686, 0.3803], [0.3171, 0.4361]], [[0.1686, 0.3618], [0.3171, 0.3803]],
  ],
  hold: [
    [[0.0948, 0.3978], [0.3556, 0.4656]], [[0.1114, 0.3706], [0.2946, 0.4159]], [[0.0892, 0.3661], [0.3113, 0.4475]], [[0.1059, 0.3164], [0.3168, 0.4023]],
    [[0.1447, 0.3480], [0.3168, 0.4159]], [[0.1781, 0.3661], [0.3556, 0.4385]], [[0.1891, 0.4114], [0.3223, 0.4701]], [[0.0836, 0.3751], [0.3556, 0.4746]],
  ],
});

const servantSpecs = ['idle', 'inhale', 'blow', 'recovery'].map((clip, row) => ({
  cycle: '07',
  generatedBy: clip === 'idle' || clip === 'inhale' ? 'ImageGen Cycle 06 carry-forward' : 'ImageGen Cycle 07',
  sourceRoot,
  source: clip === 'idle' || clip === 'inhale' ? 'ash-servant-idle-inhale-carryforward.png' : `ash-servant-${clip}-8-source.png`,
  checker: false,
  backgroundRemoval: 'border-neutral',
  sourceColumns: clip === 'idle' || clip === 'inhale' ? 10 : 4,
  sourceRows: clip === 'idle' || clip === 'inhale' ? 4 : 2,
  indices: clip === 'idle' || clip === 'inhale' ? allEight.map((index) => row * 10 + index) : allEight,
  componentMode: 'largest',
  preserveCellFraming: true,
  framingScale: clip === 'inhale' ? 0.98 : 1,
  output: `assets/characters/ash-servant/ash-servant-${clip}-v5.webp`,
  clip,
  columns: 4,
  rows: 2,
  frameWidth: 256,
  frameHeight: 320,
  fps: clip === 'idle' ? 6 : 10,
  loop: clip === 'idle',
  pivot: [0.5, 0.98125],
  sockets: servantSockets[clip].map((mouth) => ({ mouth })),
  anatomicalScale: clip === 'inhale' ? 0.98 : 1,
}));

const demonessSpecs = [
  { clip: 'idle', fps: 1.2, loop: true },
  { clip: 'cast', fps: 8, loop: false },
  { clip: 'hold', fps: 6, loop: true },
  { clip: 'recovery', fps: 8, loop: false },
].map((entry) => ({
  ...entry,
  cycle: '07',
  generatedBy: 'ImageGen Cycle 07',
  sourceRoot,
  source: `demoness-${entry.clip}-8-source.png`,
  checker: false,
  backgroundRemoval: 'border-neutral',
  quality: 90,
  sourceColumns: 4,
  sourceRows: 2,
  indices: allEight,
  componentMode: 'largest',
  preserveCellFraming: true,
  output: `assets/characters/demoness/demoness-${entry.clip}-v6.webp`,
  columns: 4,
  rows: 2,
  frameWidth: 412,
  frameHeight: 664,
  framingScale: entry.clip === 'cast' ? 1.25 : entry.clip === 'hold' ? 1.02 : entry.clip === 'recovery' ? 1 : 1,
  pivot: [0.5, 0.99],
  sockets: demonessHands[entry.clip]?.map(([leftHand, rightHand]) => ({ leftHand, rightHand })),
  anatomicalScale: 1,
}));

for (const spec of [...servantSpecs, ...demonessSpecs]) await buildAtlas(spec);
