// @ts-check

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { gameRoot } from './lib.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const BUILD_ID = /^0\.1\.0\+[a-f0-9]{12}$/;
const REQUIRED_FILES = Object.freeze([
  'README.md',
  'pass-1-static/automation.log', 'pass-1-static/test-results.json', 'pass-1-static/asset-audit.json',
  'pass-1-static/atlas-metadata-audit.json', 'pass-1-static/frame-uniqueness.json',
  'pass-1-static/runtime-contract.json', 'pass-1-static/canonical-v5-no-reward.json',
  'pass-1-static/canonical-v5-boosted.json', 'pass-1-static/tap-rate-matrix.json',
  'pass-1-static/debuff-mechanical-parity.json', 'pass-1-static/audio-lifecycle.json',
  'pass-2-browser/full-cycle/touch-390x844.json', 'pass-2-browser/full-cycle/mouse-1366x768.json',
  'pass-2-browser/full-cycle/provider-unavailable.json', 'pass-2-browser/full-cycle/console.json',
  'pass-2-browser/balance/BALANCE_REPORT.md', 'pass-2-browser/balance/human-input-profiles.json',
  'pass-2-browser/balance/no-reward-stage7.json', 'pass-2-browser/balance/optional-boost-paired.json',
  'pass-2-browser/stills/manifest.json', 'pass-2-browser/motion/manifest.json',
  'pass-2-browser/metrics/flame-motion.json', 'pass-2-browser/metrics/loop-seams.json',
  'pass-2-browser/metrics/transitions.json', 'pass-2-browser/metrics/character-causality.json',
  'pass-2-browser/metrics/debuff-parity.json', 'pass-2-browser/metrics/inferno-ambient.json',
  'pass-2-browser/metrics/geometry.json', 'pass-2-browser/metrics/performance-browser.json',
  'pass-3-independent/independent-review.md', 'pass-3-independent/regression-cycle.json', 'pass-3-independent/device-matrix.md',
  'pass-3-independent/yandex-console.md', 'pass-3-independent/defects.md',
  'pass-3-independent/signoff.md', 'pass-3-independent/signoff.json',
]);
const FLAME_CASES = ['flame-p05', 'flame-p35', 'flame-p65', 'flame-p100', 'flame-reduced-motion', 'flame-tap-continuity', 'flame-loop-seam'];
const TRANSITION_CASES = [1, 2, 3, 4, 5, 6].flatMap((from) => [`transition-up-${from}-${from + 1}`, `transition-down-${from + 1}-${from}`]);
const CHARACTER_CASES = [
  'servant-appearance', 'servant-idle', 'servant-long-inhale-exhale-fire-reaction',
  'demoness-silhouette-reveal', 'demoness-calm-idle', 'demoness-disapproval-head-shake', 'demoness-full-cold-cast',
  'debuff-servant-only', 'debuff-demoness-only', 'debuff-both-active',
  'inferno-stage-6-to-7-payoff', 'inferno-sustained-30s',
];

/** @param {Buffer|string} value */
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
/** @param {unknown} condition @param {string} message */
function invariant(condition, message) { if (!condition) throw new Error(message); }
/** @param {string} root @param {string} candidate */
function inside(root, candidate) {
  invariant(typeof candidate === 'string' && candidate.length > 0 && !candidate.includes('\\'), `Unsafe evidence path: ${candidate}`);
  const absolute = resolve(root, candidate);
  invariant(absolute.startsWith(`${root}${sep}`), `Unsafe evidence path: ${candidate}`);
  return absolute;
}
/** @param {string} value */
function timestamp(value) { const parsed = Date.parse(value); invariant(Number.isFinite(parsed), `Invalid timestamp: ${value}`); return parsed; }

/** @param {Buffer} value */
function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** @param {Buffer} bytes @param {string} label */
function pngInfo(bytes, label) {
  invariant(bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${label}: invalid PNG signature`);
  invariant(bytes.subarray(12, 16).toString('ascii') === 'IHDR', `${label}: missing IHDR`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  invariant(bitDepth === 8 && (colorType === 2 || colorType === 6), `${label}: PNG must be 8-bit RGB/RGBA`);
  let offset = 8;
  let sawIhdr = false;
  let sawIend = false;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    invariant(offset + 12 + length <= bytes.length, `${label}: truncated PNG chunk`);
    const type = bytes.subarray(offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
    invariant(crc32(Buffer.concat([type, data])) === expectedCrc, `${label}: corrupt PNG CRC`);
    const name = type.toString('ascii');
    if (name === 'IHDR') sawIhdr = true;
    if (name === 'IDAT') idat.push(data);
    if (name === 'IEND') { sawIend = true; break; }
    offset += 12 + length;
  }
  invariant(sawIhdr && sawIend && idat.length > 0, `${label}: incomplete PNG`);
  const decoded = inflateSync(Buffer.concat(idat));
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  invariant(decoded.length === height * (1 + width * bytesPerPixel), `${label}: invalid decoded scanline length`);
  for (let row = 0; row < height; row += 1) invariant(decoded[row * (1 + width * bytesPerPixel)] <= 4, `${label}: invalid PNG filter`);
  return { width, height, bitDepth, colorType };
}

/** @param {string} path */
async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }

/** @param {string} root */
async function walk(root) {
  const paths = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else paths.push(path);
  }
  return paths.sort();
}

/** @param {string} path @param {string} label */
async function assertSignedReview(path, label) {
  const text = await readFile(path, 'utf8');
  const reviewer = text.match(/^Reviewer-ID:\s*(\S+)/m)?.[1];
  invariant(reviewer, `${label}: missing Reviewer-ID`);
  invariant(/^Independence:\s*PASS$/m.test(text) && /^Decision:\s*PASS$/m.test(text), `${label}: unsigned or failing review`);
  return reviewer;
}

/**
 * Validates one immutable evidence directory. It never accepts `working.*`, a
 * different directory name, an optional/missing matrix, or un-hashed files.
 * @param {string} evidenceRoot
 * @param {{expectedBuildId?:string,expectedCommitSha?:string,expectedSourceFingerprint?:string}=} expected
 */
export async function validateAnimationEvidence(evidenceRoot, expected = {}) {
  const root = resolve(evidenceRoot);
  const manifest = await json(join(root, 'manifest.json'));
  invariant(manifest.schemaVersion === 1, 'Invalid evidence schemaVersion');
  invariant(BUILD_ID.test(String(manifest.buildId ?? '')), 'Evidence requires an exact clean Build ID');
  invariant(manifest.clean === true, 'Evidence build must be clean');
  invariant(/^[a-f0-9]{40}$/.test(String(manifest.commitSha ?? '')), 'Invalid evidence commitSha');
  invariant(SHA256.test(String(manifest.sourceFingerprint ?? '')), 'Invalid sourceFingerprint');
  invariant(manifest.buildId.endsWith(manifest.commitSha.slice(0, 12)), 'Build ID/commit mismatch');
  invariant(basename(root) === manifest.buildId, 'Evidence directory must equal Build ID');
  const index = await json(join(root, '../index.json'));
  invariant(index.schemaVersion === 1 && index.activeBuildId === manifest.buildId && Array.isArray(index.builds) && index.builds.includes(manifest.buildId), 'Animation QA index does not select this exact build');
  if (expected.expectedBuildId) invariant(manifest.buildId === expected.expectedBuildId, 'Stale evidence Build ID');
  if (expected.expectedCommitSha) invariant(manifest.commitSha === expected.expectedCommitSha, 'Stale evidence commit');
  if (expected.expectedSourceFingerprint) invariant(manifest.sourceFingerprint === expected.expectedSourceFingerprint, 'Stale evidence source fingerprint');
  const generatedAt = timestamp(manifest.generatedAt);
  invariant(Array.isArray(manifest.passes) && manifest.passes.join(',') === 'pass-1-static,pass-2-browser,pass-3-independent', 'Exactly three ordered passes are required');
  invariant(Array.isArray(manifest.files), 'Evidence file inventory is required');
  const inventory = new Map();
  for (const entry of manifest.files) {
    invariant(typeof entry.path === 'string' && SHA256.test(String(entry.sha256 ?? '')) && Number.isInteger(entry.bytes) && entry.bytes >= 0, 'Invalid evidence inventory entry');
    invariant(!inventory.has(entry.path), `Duplicate evidence inventory path: ${entry.path}`);
    const path = inside(root, entry.path);
    const bytes = await readFile(path);
    invariant(bytes.length === entry.bytes && digest(bytes) === entry.sha256, `Evidence hash/size mismatch: ${entry.path}`);
    inventory.set(entry.path, entry);
  }
  for (const path of REQUIRED_FILES) invariant(inventory.has(path), `Missing required evidence: ${path}`);
  const actualRelative = (await walk(root)).map((path) => path.slice(root.length + 1).split(sep).join('/')).filter((path) => path !== 'manifest.json');
  invariant(actualRelative.length === inventory.size, 'Unlisted or missing evidence files');
  for (const path of actualRelative) invariant(inventory.has(path), `Unlisted evidence file: ${path}`);

  const noRewardV5 = await json(join(root, 'pass-1-static/canonical-v5-no-reward.json'));
  invariant(noRewardV5.buildId === manifest.buildId && noRewardV5.status === 'PASS' && noRewardV5.frameRates?.join(',') === '60,30,15', 'Invalid V5 no-reward identity/frame rates');
  invariant(noRewardV5.stageTimestampsMs?.join(',') === '9000,43500,64500,102000,145200,164800', 'V5 no-reward stage timestamps mismatch');
  invariant(noRewardV5.checkpoint?.elapsedMs === 180_000 && noRewardV5.checkpoint?.acceptedTaps === 786 && noRewardV5.checkpoint?.score === 110_498 && Math.abs(noRewardV5.checkpoint?.heat - 946.465417) <= 0.01 && Math.abs(noRewardV5.checkpoint?.infernoHoldMs - 15_060) <= 10, 'V5 no-reward checkpoint mismatch');
  const boostedV5 = await json(join(root, 'pass-1-static/canonical-v5-boosted.json'));
  invariant(boostedV5.buildId === manifest.buildId && boostedV5.status === 'PASS' && boostedV5.frameRates?.join(',') === '60,30,15' && boostedV5.boostStartMs === 65_000, 'Invalid V5 boosted identity/frame rates');
  invariant(boostedV5.stageTimestampsMs?.join(',') === '9000,43500,64500,75750,83950,102710', 'V5 boosted stage timestamps mismatch');
  invariant(boostedV5.checkpoint?.elapsedMs === 180_000 && boostedV5.checkpoint?.acceptedTaps === 944 && boostedV5.checkpoint?.score === 180_220 && Math.abs(boostedV5.checkpoint?.heat - 936.94) <= 0.01 && Math.abs(boostedV5.checkpoint?.infernoHoldMs - 65_950) <= 10, 'V5 boosted checkpoint mismatch');
  const rateMatrix = await json(join(root, 'pass-1-static/tap-rate-matrix.json'));
  invariant(rateMatrix.buildId === manifest.buildId && rateMatrix.status === 'PASS' && rateMatrix.version === 2, 'Invalid tap-rate matrix identity/version');
  invariant(rateMatrix.maximumStages?.['2'] === 4 && rateMatrix.maximumStages?.['4'] === 5 && rateMatrix.maximumStages?.['5'] === 6 && rateMatrix.maximumStages?.['7.14'] === 7, 'Tap-rate V2 stage matrix mismatch');

  const stillManifest = await json(join(root, 'pass-2-browser/stills/manifest.json'));
  invariant(stillManifest.buildId === manifest.buildId && stillManifest.captureCount === 17 && stillManifest.captures?.length === 17, 'Invalid 17-still matrix');
  const requiredViewports = { '360x640': 4, '390x844': 4, '768x1024': 4, '1366x768': 4, '800x360': 1 };
  const viewportCounts = Object.fromEntries(Object.keys(requiredViewports).map((key) => [key, 0]));
  let lastCaptureAt = -Infinity;
  const seenStillFiles = new Set();
  for (const capture of stillManifest.captures) {
    invariant(capture.buildId === manifest.buildId && capture.sourceFingerprint === manifest.sourceFingerprint, `${capture.file}: stale still identity`);
    invariant(!seenStillFiles.has(capture.file), `${capture.file}: duplicate still`);
    seenStillFiles.add(capture.file);
    invariant(capture.viewport in viewportCounts, `${capture.file}: unexpected viewport`);
    viewportCounts[capture.viewport] += 1;
    invariant(Number.isFinite(capture.dpr) && capture.dpr > 0 && capture.browser?.name && capture.browser?.version, `${capture.file}: missing browser/DPR metadata`);
    invariant(Math.abs(capture.actualHeat - capture.targetHeat) <= 5, `${capture.file}: heat outside ±5`);
    const capturedAt = timestamp(capture.timestamp);
    invariant(capturedAt > lastCaptureAt && capturedAt <= generatedAt, `${capture.file}: timestamps must be strictly increasing and precede manifest`);
    lastCaptureAt = capturedAt;
    const path = `pass-2-browser/stills/${capture.file}`;
    invariant(inventory.has(path), `${capture.file}: still not inventoried`);
    const bytes = await readFile(inside(root, path));
    const info = pngInfo(bytes, capture.file);
    const [width, height] = capture.viewport.split('x').map(Number);
    invariant(info.width === width && info.height === height, `${capture.file}: viewport/dimensions mismatch`);
  }
  for (const [viewport, count] of Object.entries(requiredViewports)) invariant(viewportCounts[viewport] === count, `${viewport}: expected ${count} stills`);

  const motion = await json(join(root, 'pass-2-browser/motion/manifest.json'));
  invariant(motion.buildId === manifest.buildId && motion.sourceFingerprint === manifest.sourceFingerprint, 'Stale motion manifest');
  const scenarios = new Map((motion.scenarios ?? []).map((entry) => [entry.id, entry]));
  for (const id of [...FLAME_CASES, ...TRANSITION_CASES, ...CHARACTER_CASES]) {
    const scenario = /** @type {any} */ (scenarios.get(id));
    invariant(scenario, `Missing motion scenario: ${id}`);
    invariant(scenario.buildId === manifest.buildId && scenario.sourceFingerprint === manifest.sourceFingerprint, `${id}: stale identity`);
    invariant(Number.isFinite(scenario.dpr) && scenario.dpr > 0 && scenario.browser?.name && scenario.browser?.version, `${id}: missing browser/DPR`);
    invariant(['390x844', '768x1024', '1366x768', '800x360', '360x640'].includes(scenario.viewport), `${id}: unsupported viewport`);
    invariant(Array.isArray(scenario.frames) && scenario.frames.length >= 12, `${id}: requires >=12 sampled frames`);
    let prior = -Infinity;
    const framePaths = new Set();
    const perceptualHashes = new Set();
    for (const frame of scenario.frames) {
      invariant(Number.isFinite(frame.captureMs) && frame.captureMs > prior, `${id}: non-monotonic frame time`);
      prior = frame.captureMs;
      invariant(SHA256.test(String(frame.sha256 ?? '')) && /^[a-f0-9]{16,64}$/.test(String(frame.pHash ?? '')), `${id}: missing frame hashes`);
      invariant(!framePaths.has(frame.path), `${id}: duplicate sampled frame path`);
      framePaths.add(frame.path);
      perceptualHashes.add(frame.pHash);
      invariant(frame.state && Number.isFinite(frame.state.heat) && Number.isInteger(frame.state.stage), `${id}: missing state snapshot`);
      invariant(typeof frame.state.clip === 'string' && Number.isInteger(frame.state.frameIndex), `${id}: missing clip/frame diagnostic`);
      const path = inside(root, frame.path);
      invariant(frame.path.startsWith('pass-2-browser/motion/'), `${id}: frame outside motion directory`);
      const bytes = await readFile(path);
      invariant(digest(bytes) === frame.sha256, `${id}: sampled frame hash mismatch`);
      const info = pngInfo(bytes, `${id}/${frame.path}`);
      const [width, height] = scenario.viewport.split('x').map(Number);
      invariant(info.width === width && info.height === height, `${id}: frame/viewport dimensions mismatch`);
    }
    if (id.startsWith('flame-p')) {
      invariant(prior - scenario.frames[0].captureMs >= 2_000, `${id}: idle capture shorter than 2s`);
      invariant(perceptualHashes.size >= 8, `${id}: fewer than 8 distinct sampled pHashes`);
    }
    if (id === 'flame-reduced-motion') invariant(perceptualHashes.size >= 2, `${id}: reduced motion became static`);
    if (id === 'servant-idle' || id === 'demoness-calm-idle') invariant(perceptualHashes.size >= 4, `${id}: idle is not visibly alive`);
    if (id.startsWith('transition-')) {
      invariant(scenario.metrics?.durationMs >= 800 && scenario.metrics?.durationMs <= 1_500, `${id}: transition duration outside 0.8–1.5s`);
      invariant(scenario.metrics.intermediateOpacityStates >= 3 && scenario.metrics.maxOpacityStep <= 0.20 && scenario.metrics.hiddenToFullPopCount === 0, `${id}: transition continuity failed`);
    }
    if (id === 'flame-tap-continuity') invariant(scenario.metrics?.loopResetCount === 0 && scenario.metrics?.flickerCount === 0, `${id}: tap reset/flicker detected`);
    if (id === 'flame-loop-seam') invariant(scenario.metrics?.visibleSeamCount === 0, `${id}: visible loop seam detected`);
    if (id === 'servant-long-inhale-exhale-fire-reaction') invariant(scenario.metrics?.phaseContract === 'prepare>inhale-ramp>inhale-hold>exhale-start>exhale-ramp>exhale-peak>exhale-fade>exhale-end>recovery>idle' && scenario.metrics?.maxStrengthError <= 0.05 && scenario.metrics?.peakFrameDelta <= 1, `${id}: long exhale/fire synchronization failed`);
    if (id === 'demoness-disapproval-head-shake') invariant(scenario.metrics?.orderedSequence === 'look>pause>negative-head-movement>return' && scenario.metrics?.minIntervalMs >= 5_000 && scenario.metrics?.maxIntervalMs <= 9_000 && scenario.metrics?.coreMutations === 0 && scenario.metrics?.castRestarts === 0, `${id}: disapproval gesture failed`);
    if (id === 'demoness-full-cold-cast') invariant(scenario.metrics?.phaseContract === 'cast-look>arms-rise>cast-gather>cold-ramp>cold-hold>cold-release>recovery>idle' && scenario.metrics?.maxStrengthError <= 0.05 && scenario.metrics?.eventToReactionMs <= 50, `${id}: cold cast/fire response failed`);
    if (id === 'demoness-silhouette-reveal') invariant(scenario.metrics?.orderedSequence === 'silhouette>reveal' && scenario.metrics?.fragmentEvents === 0 && scenario.metrics?.teleportEvents === 0, `${id}: reveal continuity failed`);
    if (id === 'inferno-stage-6-to-7-payoff') invariant(scenario.metrics?.durationMs === 1_500 && scenario.metrics?.highFlameExpansion && scenario.metrics?.emberBurst && scenario.metrics?.runeWave && scenario.metrics?.lightingPulse && scenario.metrics?.stagedHostReveal && scenario.metrics?.hudReadable && scenario.metrics?.popCount === 0, `${id}: Stage 6→7 payoff failed`);
    if (id === 'inferno-sustained-30s') invariant(prior - scenario.frames[0].captureMs >= 30_000 && scenario.metrics?.addressableRegions >= 5 && scenario.metrics?.minMovingRegionsPerFiveSeconds >= 2 && scenario.metrics?.lockstep === false && scenario.metrics?.wholePlateOnly === false && scenario.metrics?.seamCount === 0 && scenario.metrics?.freezeWindows === 0, `${id}: sustained Inferno motion failed`);
  }

  const geometry = await json(join(root, 'pass-2-browser/metrics/geometry.json'));
  invariant(geometry.servant?.rootDriftLogicalPx <= 2 && geometry.servant?.edgeAlphaPixels === 0 && geometry.servant?.wrapEvents === 0, 'Servant root/edge/wrap gate failed');
  invariant(geometry.demoness?.connectedComponents === 1 && geometry.demoness?.fragmentEvents === 0 && geometry.demoness?.teleportEvents === 0, 'Demoness connected-figure gate failed');
  invariant(geometry.demoness?.heightVsServant >= 1.25 && geometry.demoness?.flameOverlapPixels === 0, 'Demoness scale/flame-clearance gate failed');
  invariant(geometry.infernoHost?.addressableRegions >= 5 && geometry.infernoHost?.minMovingRegionsPerFiveSeconds >= 2 && geometry.infernoHost?.wholePlateOnly === false, 'Inferno host independent-motion gate failed');

  const debuffs = await json(join(root, 'pass-2-browser/metrics/debuff-parity.json'));
  invariant(debuffs.servantOnly === 'PASS' && debuffs.demonessOnly === 'PASS' && debuffs.bothActive === 'PASS', 'Three debuff display states are required');
  invariant(debuffs.servantFactor === 1.8 && debuffs.demonessFactor === 1.5 && debuffs.combinedFactor === 2.5 && debuffs.combinedRule === 'min(2.50,servantFactor*demonessFactor)', 'Debuff mechanical stacking mismatch');
  invariant(debuffs.uiCoreMaxDeltaMs <= 50 && debuffs.overlapCount === 0 && debuffs.truncationCount === 0, 'Debuff UI parity/layout failed');
  const mechanicalDebuffs = await json(join(root, 'pass-1-static/debuff-mechanical-parity.json'));
  invariant(mechanicalDebuffs.status === 'PASS' && mechanicalDebuffs.servantFactor === 1.8 && mechanicalDebuffs.demonessFactor === 1.5 && mechanicalDebuffs.combinedFactor === 2.5 && mechanicalDebuffs.tapPowerUnchanged === true && mechanicalDebuffs.independentTimers === true, 'Static debuff mechanical parity failed');

  const balance = await json(join(root, 'pass-2-browser/balance/human-input-profiles.json'));
  const requiredProfiles = ['casual-mobile', 'fast-mobile', 'casual-mouse', 'skilled-mouse', 'extreme-burst'];
  invariant(balance.buildId === manifest.buildId && balance.simulationSeparated === true, 'Balance evidence identity/separation failed');
  for (const profile of requiredProfiles) {
    const trials = balance.profiles?.[profile];
    invariant(Array.isArray(trials) && trials.length >= 3, `${profile}: requires >=3 production-browser replays`);
    for (const trial of trials) {
      invariant(trial.productionBrowser === true && trial.captureMethod && ['touch', 'mouse'].includes(trial.inputType) && trial.rawLog && trial.irregularIntervals === true && trial.durationMs > 0 && Number.isFinite(trial.sustainedTapsPerSecond), `${profile}: incomplete/constant-rate browser replay`);
      invariant(trial.rawLog.startsWith('pass-2-browser/balance/raw/') && inventory.has(trial.rawLog), `${profile}: raw input log is not inventoried`);
    }
  }
  invariant(balance.profiles['extreme-burst'].every((trial) => trial.durationMs <= 10_000), 'Extreme burst cannot be treated as sustained input');
  const noReward = await json(join(root, 'pass-2-browser/balance/no-reward-stage7.json'));
  invariant(noReward.buildId === manifest.buildId && noReward.rewardUsed === false && noReward.productionBrowser === true && noReward.profile === 'skilled-mouse' && noReward.stageReached === 7, 'Production-browser no-reward Stage 7 evidence failed');
  const optionalBoost = await json(join(root, 'pass-2-browser/balance/optional-boost-paired.json'));
  invariant(optionalBoost.buildId === manifest.buildId && optionalBoost.status === 'PASS' && optionalBoost.contentAccessChanged === false && optionalBoost.advantage === true, 'Optional boost paired evidence failed');

  const independentReviewer = await assertSignedReview(join(root, 'pass-3-independent/independent-review.md'), 'independent QA reviewer');
  const signoff = await json(join(root, 'pass-3-independent/signoff.json'));
  invariant(signoff.buildId === manifest.buildId && signoff.decision === 'PASS' && signoff.openCritical === 0 && signoff.openHigh === 0, 'Final signoff gate failed');
  invariant(signoff.passOwners?.implementation && signoff.passOwners?.independent === independentReviewer && signoff.passOwners?.regression && new Set(Object.values(signoff.passOwners)).size === 3, 'Exactly three independently owned passes are required');
  invariant(signoff.audio?.lifecycleSmoke === 'PASS', 'Audio lifecycle smoke is required');
  if (signoff.audio?.carriedForward === true) {
    invariant(SHA256.test(String(signoff.audio.sourceFingerprint ?? '')) && SHA256.test(String(signoff.audio.audioFingerprint ?? '')), 'Audio carry-forward fingerprints are required');
    invariant(signoff.audio.sourceFingerprint === manifest.audioSourceFingerprint && signoff.audio.audioFingerprint === manifest.audioAssetFingerprint, 'Audio carry-forward fingerprint mismatch');
    invariant(BUILD_ID.test(String(signoff.audio.fromBuildId ?? '')) && SHA256.test(String(signoff.audio.priorSignoffSha256 ?? '')), 'Audio carry-forward requires exact prior build and signed evidence hash');
  }

  return Object.freeze({ schemaVersion: 1, buildId: manifest.buildId, files: inventory.size, stills: 17, motionScenarios: scenarios.size, passes: 3, status: 'PASS' });
}

async function main() {
  const root = process.argv[2];
  if (!root) throw new Error('Usage: node scripts/validate-animation-evidence.mjs reports/animation-qa/<exact-build-id>');
  const distIdentity = await json(join(gameRoot, 'dist/build-manifest.json'));
  invariant(distIdentity.clean === true, 'Current dist is not a clean exact build');
  const report = await validateAnimationEvidence(root, {
    expectedBuildId: distIdentity.buildId,
    expectedCommitSha: distIdentity.commitSha,
    expectedSourceFingerprint: distIdentity.sourceFingerprint,
  });
  const canonicalBalance = await readFile(join(gameRoot, 'reports/BALANCE_REPORT.md'));
  const evidenceBalance = await readFile(join(resolve(root), 'pass-2-browser/balance/BALANCE_REPORT.md'));
  invariant(digest(canonicalBalance) === digest(evidenceBalance), 'Canonical BALANCE_REPORT does not match exact-build evidence');
  console.log(`animation evidence PASS (${report.buildId}; ${report.stills} stills; ${report.motionScenarios} motion scenarios)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
