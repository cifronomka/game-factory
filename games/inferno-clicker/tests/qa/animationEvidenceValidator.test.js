// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateAnimationEvidence } from '../../scripts/validate-animation-evidence.mjs';

const buildId = '0.1.0+123456789abc';
const commitSha = `123456789abc${'d'.repeat(28)}`;
const sourceFingerprint = 'a'.repeat(64);
const audioSourceFingerprint = 'b'.repeat(64);
const audioAssetFingerprint = 'c'.repeat(64);
const flameCases = ['flame-p05', 'flame-p35', 'flame-p65', 'flame-p100', 'flame-reduced-motion', 'flame-tap-continuity', 'flame-loop-seam'];
const transitionCases = [1, 2, 3, 4, 5, 6].flatMap((from) => [`transition-up-${from}-${from + 1}`, `transition-down-${from + 1}-${from}`]);
const characterCases = [
  'servant-appearance', 'servant-idle', 'servant-long-inhale-exhale-fire-reaction',
  'demoness-silhouette-reveal', 'demoness-calm-idle', 'demoness-disapproval-head-shake', 'demoness-full-cold-cast',
  'debuff-servant-only', 'debuff-demoness-only', 'debuff-both-active',
  'inferno-stage-6-to-7-payoff', 'inferno-sustained-30s',
];

/** @param {Buffer|string} value */
function sha(value) { return createHash('sha256').update(value).digest('hex'); }
/** @param {Buffer} value */
function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
/** @param {string} name @param {Buffer} data */
function chunk(name, data) {
  const type = Buffer.from(name);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0); type.copy(output, 4); data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length);
  return output;
}
/** @param {number} width @param {number} height */
function png(width, height) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const row = Buffer.alloc(1 + width * 4);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function makeEvidence() {
  const parent = await mkdtemp(join(tmpdir(), 'inferno-animation-evidence-'));
  const root = join(parent, buildId);
  await mkdir(root, { recursive: true });
  await writeFile(join(parent, 'index.json'), `${JSON.stringify({ schemaVersion: 1, activeBuildId: buildId, builds: [buildId] })}\n`);
  const inventory = [];
  /** @param {string} path @param {Buffer|string} value */
  async function put(path, value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), bytes);
    inventory.push({ path, bytes: bytes.length, sha256: sha(bytes) });
  }
  /** @param {string} path @param {unknown} value */
  async function putJson(path, value) { await put(path, `${JSON.stringify(value, null, 2)}\n`); }

  const requiredJson = [
    'pass-1-static/test-results.json', 'pass-1-static/asset-audit.json', 'pass-1-static/atlas-metadata-audit.json',
    'pass-1-static/frame-uniqueness.json', 'pass-1-static/runtime-contract.json', 'pass-1-static/audio-lifecycle.json',
    'pass-2-browser/full-cycle/touch-390x844.json', 'pass-2-browser/full-cycle/mouse-1366x768.json',
    'pass-2-browser/full-cycle/provider-unavailable.json', 'pass-2-browser/full-cycle/console.json',
    'pass-2-browser/metrics/flame-motion.json', 'pass-2-browser/metrics/loop-seams.json',
    'pass-2-browser/metrics/transitions.json', 'pass-2-browser/metrics/character-causality.json',
    'pass-2-browser/metrics/performance-browser.json', 'pass-3-independent/regression-cycle.json',
  ];
  await put('README.md', 'Exact-build animation QA fixture.\n');
  await put('pass-1-static/automation.log', 'all commands PASS\n');
  for (const path of requiredJson) await putJson(path, { buildId, status: 'PASS' });
  await putJson('pass-1-static/canonical-v5-no-reward.json', { buildId, status: 'PASS', frameRates: [60, 30, 15], stageTimestampsMs: [9_000, 43_500, 64_500, 102_000, 145_200, 164_800], checkpoint: { elapsedMs: 180_000, acceptedTaps: 786, score: 110_498, heat: 946.465417, infernoHoldMs: 15_060 } });
  await putJson('pass-1-static/canonical-v5-boosted.json', { buildId, status: 'PASS', frameRates: [60, 30, 15], boostStartMs: 65_000, stageTimestampsMs: [9_000, 43_500, 64_500, 75_750, 83_950, 102_710], checkpoint: { elapsedMs: 180_000, acceptedTaps: 944, score: 180_220, heat: 936.94, infernoHoldMs: 65_950 } });
  await putJson('pass-1-static/tap-rate-matrix.json', { buildId, status: 'PASS', version: 2, maximumStages: { '2': 4, '4': 5, '5': 6, '7.14': 7 } });
  await putJson('pass-1-static/debuff-mechanical-parity.json', { buildId, status: 'PASS', servantFactor: 1.8, demonessFactor: 1.5, combinedFactor: 2.5, tapPowerUnchanged: true, independentTimers: true });
  const profiles = {};
  for (const profile of ['casual-mobile', 'fast-mobile', 'casual-mouse', 'skilled-mouse', 'extreme-burst']) {
    profiles[profile] = [];
    for (let index = 0; index < 3; index += 1) {
      const rawLog = `pass-2-browser/balance/raw/${profile}-${index}.json`;
      await putJson(rawLog, { buildId, timestampsMs: [0, 231, 479, 701] });
      profiles[profile].push({ productionBrowser: true, captureMethod: `fixture-${index}`, inputType: profile.includes('mobile') ? 'touch' : 'mouse', rawLog, irregularIntervals: true, durationMs: profile === 'extreme-burst' ? 8_000 : 120_000, sustainedTapsPerSecond: 4.2 });
    }
  }
  await put('pass-2-browser/balance/BALANCE_REPORT.md', 'Production-browser profile fixture.\n');
  await putJson('pass-2-browser/balance/human-input-profiles.json', { buildId, simulationSeparated: true, profiles });
  await putJson('pass-2-browser/balance/no-reward-stage7.json', { buildId, rewardUsed: false, productionBrowser: true, profile: 'skilled-mouse', stageReached: 7 });
  await putJson('pass-2-browser/balance/optional-boost-paired.json', { buildId, status: 'PASS', contentAccessChanged: false, advantage: true });
  for (const path of ['pass-3-independent/device-matrix.md', 'pass-3-independent/yandex-console.md', 'pass-3-independent/defects.md', 'pass-3-independent/signoff.md']) await put(path, 'Decision: PASS\n');
  await put('pass-3-independent/independent-review.md', 'Reviewer-ID: independent-qa\nIndependence: PASS\nDecision: PASS\n');
  await putJson('pass-3-independent/signoff.json', { buildId, decision: 'PASS', openCritical: 0, openHigh: 0, passOwners: { implementation: 'implementation-owner', independent: 'independent-qa', regression: 'regression-owner' }, audio: { carriedForward: true, fromBuildId: '0.1.0+abcdefabcdef', priorSignoffSha256: 'e'.repeat(64), sourceFingerprint: audioSourceFingerprint, audioFingerprint: audioAssetFingerprint, lifecycleSmoke: 'PASS' } });

  const stillViewports = ['360x640', '390x844', '768x1024', '1366x768'];
  const stills = [];
  let sequence = 0;
  for (const viewport of stillViewports) {
    for (const targetHeat of [50, 350, 650, 1000]) {
      const [width, height] = viewport.split('x').map(Number);
      const file = `${viewport}-p${targetHeat}.png`;
      await put(`pass-2-browser/stills/${file}`, png(width, height));
      stills.push({ file, viewport, dpr: 1, browser: { name: 'Chromium', version: 'fixture' }, targetHeat, actualHeat: targetHeat, timestamp: new Date(1_700_000_000_000 + sequence++ * 1_000).toISOString(), buildId, sourceFingerprint });
    }
  }
  await put('pass-2-browser/stills/800x360-p1000.png', png(800, 360));
  stills.push({ file: '800x360-p1000.png', viewport: '800x360', dpr: 1, browser: { name: 'Chromium', version: 'fixture' }, targetHeat: 1000, actualHeat: 1000, timestamp: new Date(1_700_000_000_000 + sequence++ * 1_000).toISOString(), buildId, sourceFingerprint });
  await putJson('pass-2-browser/stills/manifest.json', { buildId, captureCount: 17, captures: stills });

  const samplePng = png(390, 844);
  const scenarios = [];
  for (const id of [...flameCases, ...transitionCases, ...characterCases]) {
    const frames = [];
    for (let index = 0; index < 12; index += 1) {
      const path = `pass-2-browser/motion/${id}/frame-${String(index).padStart(2, '0')}.png`;
      await put(path, samplePng);
      const sampleStep = id.startsWith('flame-p') ? 200 : id === 'demoness-calm-idle' ? 1_700 : id === 'inferno-sustained-30s' ? 3_000 : 300;
      frames.push({ path, captureMs: index * sampleStep, sha256: sha(samplePng), pHash: index.toString(16).padStart(16, '0'), state: { heat: 350, stage: 3, clip: id, frameIndex: index } });
    }
    const metrics = id.startsWith('transition-') ? { durationMs: 1_050, intermediateOpacityStates: 4, maxOpacityStep: 0.1, hiddenToFullPopCount: 0 }
      : id === 'flame-tap-continuity' ? { loopResetCount: 0, flickerCount: 0 }
        : id === 'flame-loop-seam' ? { visibleSeamCount: 0 }
          : id === 'servant-long-inhale-exhale-fire-reaction' ? { phaseContract: 'prepare>inhale-ramp>inhale-hold>exhale-start>exhale-ramp>exhale-peak>exhale-fade>exhale-end>recovery>idle', maxStrengthError: 0.05, peakFrameDelta: 1 }
            : id === 'demoness-disapproval-head-shake' ? { orderedSequence: 'look>pause>negative-head-movement>return', minIntervalMs: 5_000, maxIntervalMs: 9_000, coreMutations: 0, castRestarts: 0 }
              : id === 'demoness-full-cold-cast' ? { phaseContract: 'cast-look>arms-rise>cast-gather>cold-ramp>cold-hold>cold-release>recovery>idle', maxStrengthError: 0.05, eventToReactionMs: 50 }
              : id === 'demoness-silhouette-reveal' ? { orderedSequence: 'silhouette>reveal', fragmentEvents: 0, teleportEvents: 0 }
                : id === 'inferno-stage-6-to-7-payoff' ? { durationMs: 1_500, highFlameExpansion: true, emberBurst: true, runeWave: true, lightingPulse: true, stagedHostReveal: true, hudReadable: true, popCount: 0 }
                  : id === 'inferno-sustained-30s' ? { addressableRegions: 5, minMovingRegionsPerFiveSeconds: 2, lockstep: false, wholePlateOnly: false, seamCount: 0, freezeWindows: 0 } : {};
    scenarios.push({ id, buildId, sourceFingerprint, viewport: '390x844', dpr: 1, browser: { name: 'Chromium', version: 'fixture' }, frames, metrics });
  }
  await putJson('pass-2-browser/motion/manifest.json', { buildId, sourceFingerprint, scenarios });
  await putJson('pass-2-browser/metrics/geometry.json', { servant: { rootDriftLogicalPx: 2, edgeAlphaPixels: 0, wrapEvents: 0 }, demoness: { connectedComponents: 1, fragmentEvents: 0, teleportEvents: 0, heightVsServant: 1.25, flameOverlapPixels: 0 }, infernoHost: { addressableRegions: 5, minMovingRegionsPerFiveSeconds: 2, wholePlateOnly: false } });
  await putJson('pass-2-browser/metrics/debuff-parity.json', { servantOnly: 'PASS', demonessOnly: 'PASS', bothActive: 'PASS', servantFactor: 1.8, demonessFactor: 1.5, combinedFactor: 2.5, combinedRule: 'min(2.50,servantFactor*demonessFactor)', uiCoreMaxDeltaMs: 50, overlapCount: 0, truncationCount: 0 });
  await putJson('pass-2-browser/metrics/inferno-ambient.json', { buildId, status: 'PASS', durationMs: 30_000, addressableRegions: 5 });

  const manifest = { schemaVersion: 1, buildId, commitSha, sourceFingerprint, audioSourceFingerprint, audioAssetFingerprint, clean: true, generatedAt: new Date(1_700_000_100_000).toISOString(), passes: ['pass-1-static', 'pass-2-browser', 'pass-3-independent'], files: inventory };
  await writeFile(join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, manifest };
}

test('animation evidence hard gate accepts all three complete passes', async () => {
  const { root } = await makeEvidence();
  const report = await validateAnimationEvidence(root, { expectedBuildId: buildId, expectedCommitSha: commitSha, expectedSourceFingerprint: sourceFingerprint });
  assert.equal(report.status, 'PASS');
  assert.equal(report.passes, 3);
  assert.equal(report.stills, 17);
});

test('animation evidence hard gate rejects missing evidence', async () => {
  const { root, manifest } = await makeEvidence();
  const missing = 'pass-2-browser/metrics/transitions.json';
  await rm(join(root, missing));
  manifest.files = manifest.files.filter((entry) => entry.path !== missing);
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  await assert.rejects(() => validateAnimationEvidence(root), /Missing required evidence/);
});

test('animation evidence hard gate rejects stale identity', async () => {
  const { root } = await makeEvidence();
  await assert.rejects(() => validateAnimationEvidence(root, { expectedSourceFingerprint: 'f'.repeat(64) }), /Stale evidence source fingerprint/);
});

test('animation evidence hard gate rejects corrupt inventoried bytes', async () => {
  const { root } = await makeEvidence();
  await writeFile(join(root, 'pass-1-static/automation.log'), 'tampered\n');
  await assert.rejects(() => validateAnimationEvidence(root), /hash\/size mismatch/);
});
