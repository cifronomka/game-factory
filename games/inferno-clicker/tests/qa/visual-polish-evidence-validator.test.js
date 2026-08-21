// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateVisualPolishEvidence } from '../../scripts/validate-visual-polish-evidence.mjs';

const buildId = '0.1.0+123456789abc';
const commitSha = `123456789abc${'d'.repeat(28)}`;
const sourceFingerprint = 'a'.repeat(64);
const referenceSha256 = 'b'.repeat(64);
const servantFingerprint = 'c'.repeat(64);
const gameplayFingerprint = 'd'.repeat(64);
const audioSourceFingerprint = 'e'.repeat(64);
const audioAssetFingerprint = 'f'.repeat(64);
const flameCases = ['low', 'mid', 'high', 'inferno'].flatMap((level) => [`flame-${level}-normal`, `flame-${level}-slow`]);
const otherCases = [
  'flame-continuous-heat', 'flame-transitions-up', 'flame-transitions-down',
  'servant-regression', 'demoness-idle', 'demoness-disapproval',
  'demoness-full-cast', 'demoness-spell-contact', 'demoness-fire-reaction',
];
const demonessStates = [
  'idle-breath-1', 'idle-breath-2', 'look-fire', 'disapproval',
  'head-start', 'head-mid', 'head-end', 'prepare-1', 'prepare-2',
  'arms-halfway', 'hands-to-flame', 'cold-start', 'cold-mid', 'cold-full',
  'contact', 'fire-reacts', 'cast-ending', 'recovery', 'idle-return',
];

/** @param {Buffer|string} value */
function sha(value) { return createHash('sha256').update(value).digest('hex'); }
/** @param {Buffer} value */
function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** @param {string} name @param {Buffer} data */
function chunk(name, data) {
  const type = Buffer.from(name);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  type.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length);
  return output;
}
/** @param {number} width @param {number} height @param {number} seed */
function png(width, height, seed = 0) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  row[1] = seed & 0xff;
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function makeEvidence() {
  const parent = await mkdtemp(join(tmpdir(), 'inferno-visual-polish-'));
  const root = join(parent, buildId);
  await mkdir(root, { recursive: true });
  await writeFile(join(parent, 'index.json'), `${JSON.stringify({ schemaVersion: 1, cycle: '05', activeBuildId: buildId, builds: [buildId] })}\n`);
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

  await put('README.md', 'Cycle 05 exact-build visual polish evidence fixture.\n');
  await put('pass-1-implementation/automation.log', 'typecheck/lint/tests/assets/build/smoke/release-audit PASS; skipped=0\n');
  await putJson('pass-1-implementation/assets-manifest.json', {
    buildId,
    sourceFingerprint,
    servant: { baselineFingerprint: servantFingerprint, currentFingerprint: servantFingerprint, redesign: false, visualContractChanged: false, timingContractChanged: false },
    flame: { bitmapDesignCarriedForward: true, geometricReplacement: false, excessiveBlurMasking: false },
    demoness: { referenceSha256, referencePath: 'user-reference/newest-demoness.png', provenance: 'user supplied', controlledStates: 24 },
    decodedTextureBytes: 32 * 1024 * 1024,
  });
  for (const path of ['servant-regression.json', 'flame-temporal.json', 'demoness-continuity.json', 'spell-contact.json']) {
    await putJson(`pass-1-implementation/${path}`, { buildId, status: 'PASS' });
  }
  await putJson('pass-1-implementation/gameplay-audio-fingerprint-regression.json', {
    buildId,
    status: 'PASS',
    gameplayBeforeFingerprint: gameplayFingerprint,
    gameplayAfterFingerprint: gameplayFingerprint,
    audioSourceBeforeFingerprint: audioSourceFingerprint,
    audioSourceAfterFingerprint: audioSourceFingerprint,
    audioAssetBeforeFingerprint: audioAssetFingerprint,
    audioAssetAfterFingerprint: audioAssetFingerprint,
  });

  const scenarios = [];
  for (const id of [...flameCases, ...otherCases]) {
    const count = id === 'demoness-full-cast' ? 19 : id.startsWith('flame-') && !id.includes('transitions') && id !== 'flame-continuous-heat' ? 24 : id === 'demoness-idle' ? 24 : 12;
    const duration = id.endsWith('-slow') ? 8_000 : id.includes('-normal') ? 4_000 : id === 'demoness-idle' ? 20_000 : 2_000;
    const frames = [];
    for (let index = 0; index < count; index += 1) {
      const image = png(360, 640, (Number.parseInt(sha(id).slice(0, 2), 16) + index) % 256);
      const path = `pass-2-independent-blind/browser/frames/${id}/frame-${String(index).padStart(2, '0')}.png`;
      await put(path, image);
      frames.push({
        path,
        captureMs: Math.round(index * duration / (count - 1)),
        sha256: sha(image),
        pHash: sha(`${id}-${index}`).slice(0, 16),
        state: {
          heat: id === 'flame-continuous-heat' ? Math.round(index * 1_000 / (count - 1)) : 650,
          stage: id === 'flame-continuous-heat' ? Math.min(7, 1 + Math.floor(index * 7 / count)) : 5,
          semanticState: id === 'demoness-full-cast' ? demonessStates[index] : id,
          flameBBox: { x: 120, y: 300, width: 120, height: 220 },
        },
      });
    }
    let metrics = {};
    if (flameCases.includes(id)) metrics = { completeLoops: 4, visiblePopCount: 0, loopSeamCount: 0, ghostOrDoubleCount: 0, particleTeleportCount: 0, staticCardShimmer: false, seamToInternalP95Ratio: 1, maxUncausedAdjacentToP95Ratio: 1 };
    if (id === 'flame-continuous-heat') metrics = { orderedHeatSamples: 12, distinctRollingVisualLevels: 8, rollingVisualLevels: { scale: 8, brightness: 8, glow: 8, particleDensity: 8, secondaryFlameIntensity: 8 }, discreteOnlyPlateau: false, loopResetCount: 0, oneFrameJumpCount: 0 };
    if (id === 'flame-transitions-up' || id === 'flame-transitions-down') {
      const pairs = id.endsWith('-up') ? ['1-2', '2-3', '3-4', '4-5', '5-6', '6-7'] : ['7-6', '6-5', '5-4', '4-3', '3-2', '2-1'];
      metrics = { crossings: pairs.map((pair) => ({ pair, durationMs: 1_000, intermediateStates: 5, maxOpacityStep: 0.18, hardSwapCount: 0, popCount: 0, ghostCount: 0 })) };
    }
    if (id === 'servant-regression') metrics = { visualContractChanged: false, timingContractChanged: false, rootDriftLogicalPx: 1, clippingCount: 0, teleportCount: 0 };
    if (id === 'demoness-idle') metrics = { breathingPeriods: 3, danceLikeEvents: 0, rapidWholeBodySwayEvents: 0, twitchEvents: 0 };
    if (id === 'demoness-disapproval') metrics = { completeCycles: 3, orderedSequence: 'look-fire>gaze-shift>frown>pause>head-shake>return-fire', wholeBodyTransformEvents: 0, castInterruptions: 0 };
    if (id === 'demoness-full-cast') metrics = { idleToCastIntermediatePoses: 9, castToRecoveryIntermediatePoses: 8, morphEvents: 0, identityDiscontinuities: 0, handJumpEvents: 0 };
    if (id === 'demoness-spell-contact') metrics = { originToHandSocketMaxPx: 8, endpointToVisibleFlameMaxPx: 7, fixedIndependentTarget: false, spellMissCount: 0, gazePalmsBodyConverge: true };
    if (id === 'demoness-fire-reaction') metrics = { preContactReactionCount: 0, firstReactionDelayMs: 67, peakAfterContact: true, settledDuringRecovery: true };
    scenarios.push({
      id,
      buildId,
      sourceFingerprint,
      viewport: '360x640',
      dpr: 1,
      browser: { name: 'Chromium', version: 'fixture' },
      playbackRate: id.endsWith('-slow') ? 0.25 : id.includes('-normal') ? 1 : undefined,
      sourceSequenceFingerprint: id.startsWith('flame-') && (id.endsWith('-normal') || id.endsWith('-slow')) ? sha(id.replace(/-(normal|slow)$/, '')) : undefined,
      frames,
      metrics,
    });
  }
  await putJson('pass-2-independent-blind/browser/manifest.json', {
    buildId,
    sourceFingerprint,
    referenceSha256,
    capturedAt: '2026-08-21T10:00:00.000Z',
    scenarios,
  });
  for (const name of ['flame', 'transitions', 'performance']) await putJson(`pass-2-independent-blind/metrics/${name}.json`, { buildId, status: 'PASS' });
  await putJson('pass-2-independent-blind/metrics/demoness.json', {
    buildId,
    status: 'PASS',
    referenceChecklist: { face: 'PASS', crownHair: 'PASS', silhouette: 'PASS', costume: 'PASS', palette: 'PASS', proportions: 'PASS', scaleDominance: 'PASS' },
    heightVsServant: 1.3,
    flameOverlapPixels: 0,
    uiOverlapPixels: 0,
    rootDriftLogicalPx: 1,
    scaleDriftRatio: 0.01,
    fragmentCount: 0,
    clippingCount: 0,
    teleportCount: 0,
    slidingCount: 0,
  });
  const contactViewports = {};
  for (const viewport of ['390x844', '1366x768', '800x360']) {
    const [width, height] = viewport.split('x').map(Number);
    const bytes = png(width, height, 77);
    const framePath = `pass-2-independent-blind/browser/frames/contact-viewports/${viewport}.png`;
    await put(framePath, bytes);
    contactViewports[viewport] = { framePath, sha256: sha(bytes), originToHandSocketMaxPx: 8, endpointToVisibleFlameMaxPx: 7, spellMissCount: 0 };
  }
  await putJson('pass-2-independent-blind/metrics/spell-contact.json', { buildId, status: 'PASS', viewports: contactViewports });
  const blindFramePath = scenarios[0].frames[0].path;
  await putJson('pass-2-independent-blind/blind-review.json', {
    buildId,
    reviewerId: 'independent-qa',
    independent: true,
    productionContributor: false,
    fixesDisclosedBeforeFirstObservations: false,
    randomizedOpaqueClipIds: true,
    labels: { hud: false, debug: false, stateNames: false, fileNameHints: false },
    firstObservationsBeforeDiagnostics: true,
    firstObservations: 'The character clearly directs a cold cast into the central flame after a calm disapproval.',
    questions: Object.fromEntries(['HE-01', 'HE-02', 'HE-03', 'HE-04', 'HE-05'].map((id) => [id, { decision: 'PASS', evidence: [blindFramePath] }])),
    decision: 'PASS',
  });
  await putJson('pass-2-independent-blind/defects.json', { openCritical: 0, openHigh: 0, defects: [] });
  for (const path of ['full-cycle.json', 'cross-browser.json', 'audio-lifecycle.json', 'regression.json']) {
    await putJson(`pass-3-regression/${path}`, { buildId, status: 'PASS' });
  }
  await putJson('pass-3-regression/signoff.json', {
    buildId,
    decision: 'PASS',
    openCritical: 0,
    openHigh: 0,
    passOwners: { implementation: 'implementation-owner', independent: 'independent-qa', regression: 'regression-owner' },
  });

  const manifest = {
    schemaVersion: 1,
    cycle: '05',
    buildId,
    commitSha,
    sourceFingerprint,
    referenceSha256,
    clean: true,
    generatedAt: '2026-08-21T10:10:00.000Z',
    passes: [
      { id: 'pass-1-implementation', owner: 'implementation-owner', decision: 'PASS' },
      { id: 'pass-2-independent-blind', owner: 'independent-qa', decision: 'PASS', productionContributor: false, fixesDisclosedBeforeFirstObservations: false },
      { id: 'pass-3-regression', owner: 'regression-owner', decision: 'PASS' },
    ],
    files: inventory,
  };
  await writeFile(join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, manifest };
}

test('visual-polish validator accepts a complete exact-build three-pass fixture', async () => {
  const { root } = await makeEvidence();
  const report = await validateVisualPolishEvidence(root, { expectedBuildId: buildId, expectedCommitSha: commitSha, expectedSourceFingerprint: sourceFingerprint, expectedReferenceSha256: referenceSha256 });
  assert.equal(report.status, 'PASS');
  assert.equal(report.scenarios, 17);
  assert.equal(report.passes, 3);
});

test('visual-polish validator rejects missing required evidence', async () => {
  const { root, manifest } = await makeEvidence();
  const missing = 'pass-2-independent-blind/metrics/spell-contact.json';
  await rm(join(root, missing));
  manifest.files = manifest.files.filter((entry) => entry.path !== missing);
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  await assert.rejects(() => validateVisualPolishEvidence(root), /Missing required evidence/);
});

test('visual-polish validator rejects stale source/reference identity', async () => {
  const { root } = await makeEvidence();
  await assert.rejects(() => validateVisualPolishEvidence(root, { expectedSourceFingerprint: '9'.repeat(64) }), /Stale evidence source fingerprint/);
  await assert.rejects(() => validateVisualPolishEvidence(root, { expectedReferenceSha256: '8'.repeat(64) }), /Stale Demoness reference fingerprint/);
});

test('visual-polish validator rejects corrupt inventoried bytes', async () => {
  const { root } = await makeEvidence();
  await writeFile(join(root, 'pass-1-implementation/automation.log'), 'tampered\n');
  await assert.rejects(() => validateVisualPolishEvidence(root), /Evidence hash\/size mismatch/);
});
