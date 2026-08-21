// @ts-check

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { gameRoot } from './lib.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const BUILD_ID = /^0\.1\.0\+[a-f0-9]{12}$/;
const PASSES = Object.freeze(['pass-1-implementation', 'pass-2-independent-blind', 'pass-3-regression']);
const FLAME_LEVELS = Object.freeze(['low', 'mid', 'high', 'inferno']);
const FLAME_CASES = Object.freeze(FLAME_LEVELS.flatMap((level) => [`flame-${level}-normal`, `flame-${level}-slow`]));
const OTHER_CASES = Object.freeze([
  'flame-continuous-heat', 'flame-transitions-up', 'flame-transitions-down',
  'servant-regression', 'demoness-idle', 'demoness-disapproval',
  'demoness-full-cast', 'demoness-spell-contact', 'demoness-fire-reaction',
]);
const REQUIRED_CASES = Object.freeze([...FLAME_CASES, ...OTHER_CASES]);
const DEMONESS_STATES = Object.freeze([
  'idle-breath-1', 'idle-breath-2', 'look-fire', 'disapproval',
  'head-start', 'head-mid', 'head-end', 'prepare-1', 'prepare-2',
  'arms-halfway', 'hands-to-flame', 'cold-start', 'cold-mid', 'cold-full',
  'contact', 'fire-reacts', 'cast-ending', 'recovery', 'idle-return',
]);
const REQUIRED_FILES = Object.freeze([
  'README.md',
  'pass-1-implementation/automation.log',
  'pass-1-implementation/assets-manifest.json',
  'pass-1-implementation/servant-regression.json',
  'pass-1-implementation/flame-temporal.json',
  'pass-1-implementation/demoness-continuity.json',
  'pass-1-implementation/spell-contact.json',
  'pass-1-implementation/gameplay-audio-fingerprint-regression.json',
  'pass-2-independent-blind/browser/manifest.json',
  'pass-2-independent-blind/metrics/flame.json',
  'pass-2-independent-blind/metrics/transitions.json',
  'pass-2-independent-blind/metrics/demoness.json',
  'pass-2-independent-blind/metrics/spell-contact.json',
  'pass-2-independent-blind/metrics/performance.json',
  'pass-2-independent-blind/blind-review.json',
  'pass-2-independent-blind/defects.json',
  'pass-3-regression/full-cycle.json',
  'pass-3-regression/cross-browser.json',
  'pass-3-regression/audio-lifecycle.json',
  'pass-3-regression/regression.json',
  'pass-3-regression/signoff.json',
]);

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
function parsedTime(value) {
  const parsed = Date.parse(value);
  invariant(Number.isFinite(parsed), `Invalid timestamp: ${value}`);
  return parsed;
}
/** @param {string} path */
async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
/** @param {string} root */
async function walk(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output.sort();
}

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
  const interlace = bytes[28];
  invariant(width > 0 && height > 0 && bitDepth === 8 && (colorType === 2 || colorType === 6) && interlace === 0, `${label}: PNG must be non-interlaced 8-bit RGB/RGBA`);
  let offset = 8;
  let sawIend = false;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    invariant(offset + 12 + length <= bytes.length, `${label}: truncated PNG chunk`);
    const type = bytes.subarray(offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    invariant(crc32(Buffer.concat([type, data])) === bytes.readUInt32BE(offset + 8 + length), `${label}: corrupt PNG CRC`);
    const name = type.toString('ascii');
    if (name === 'IDAT') idat.push(data);
    if (name === 'IEND') { sawIend = true; break; }
    offset += 12 + length;
  }
  invariant(sawIend && idat.length > 0, `${label}: incomplete PNG`);
  const decoded = inflateSync(Buffer.concat(idat));
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  invariant(decoded.length === height * (1 + width * bytesPerPixel), `${label}: invalid decoded scanlines`);
  return { width, height };
}

/** @param {unknown} value @param {string} label */
function pass(value, label) { invariant(value === 'PASS', `${label} must be PASS`); }

/**
 * Validate immutable Cycle 05 browser/semantic evidence.
 * @param {string} evidenceRoot
 * @param {{expectedBuildId?:string,expectedCommitSha?:string,expectedSourceFingerprint?:string,expectedReferenceSha256?:string}=} expected
 */
export async function validateVisualPolishEvidence(evidenceRoot, expected = {}) {
  const root = resolve(evidenceRoot);
  const manifest = await json(join(root, 'manifest.json'));
  invariant(manifest.schemaVersion === 1 && manifest.cycle === '05', 'Invalid visual-polish schema/cycle');
  invariant(BUILD_ID.test(String(manifest.buildId ?? '')) && manifest.clean === true, 'Evidence requires an exact clean Build ID');
  invariant(/^[a-f0-9]{40}$/.test(String(manifest.commitSha ?? '')), 'Invalid commitSha');
  invariant(SHA256.test(String(manifest.sourceFingerprint ?? '')) && SHA256.test(String(manifest.referenceSha256 ?? '')), 'Missing source/reference fingerprint');
  invariant(manifest.buildId.endsWith(manifest.commitSha.slice(0, 12)), 'Build ID/commit mismatch');
  invariant(basename(root) === manifest.buildId, 'Evidence directory must equal Build ID');
  invariant(Array.isArray(manifest.passes) && manifest.passes.map((entry) => entry.id).join(',') === PASSES.join(','), 'Exactly three ordered Cycle 05 passes are required');
  const owners = manifest.passes.map((entry) => entry.owner);
  invariant(owners.every((owner) => typeof owner === 'string' && owner.length > 0) && new Set(owners).size === 3, 'Three distinct pass owners are required');
  manifest.passes.forEach((entry) => pass(entry.decision, `${entry.id} decision`));
  invariant(manifest.passes[1].productionContributor === false && manifest.passes[1].fixesDisclosedBeforeFirstObservations === false, 'Pass 2 must be independent and blind');
  if (expected.expectedBuildId) invariant(manifest.buildId === expected.expectedBuildId, 'Stale evidence Build ID');
  if (expected.expectedCommitSha) invariant(manifest.commitSha === expected.expectedCommitSha, 'Stale evidence commit');
  if (expected.expectedSourceFingerprint) invariant(manifest.sourceFingerprint === expected.expectedSourceFingerprint, 'Stale evidence source fingerprint');
  if (expected.expectedReferenceSha256) invariant(manifest.referenceSha256 === expected.expectedReferenceSha256, 'Stale Demoness reference fingerprint');
  const generatedAt = parsedTime(manifest.generatedAt);

  const index = await json(join(root, '../index.json'));
  invariant(index.schemaVersion === 1 && index.cycle === '05' && index.activeBuildId === manifest.buildId && index.builds?.includes(manifest.buildId), 'Visual-polish index does not select this exact build');

  invariant(Array.isArray(manifest.files), 'Evidence file inventory is required');
  const inventory = new Map();
  for (const entry of manifest.files) {
    invariant(typeof entry.path === 'string' && Number.isInteger(entry.bytes) && entry.bytes >= 0 && SHA256.test(String(entry.sha256 ?? '')), 'Invalid inventory entry');
    invariant(!inventory.has(entry.path), `Duplicate inventory path: ${entry.path}`);
    const bytes = await readFile(inside(root, entry.path));
    invariant(bytes.length === entry.bytes && digest(bytes) === entry.sha256, `Evidence hash/size mismatch: ${entry.path}`);
    inventory.set(entry.path, entry);
  }
  for (const path of REQUIRED_FILES) invariant(inventory.has(path), `Missing required evidence: ${path}`);
  const actual = (await walk(root)).map((path) => path.slice(root.length + 1).split(sep).join('/')).filter((path) => path !== 'manifest.json');
  invariant(actual.length === inventory.size, 'Unlisted or missing evidence files');
  for (const path of actual) invariant(inventory.has(path), `Unlisted evidence file: ${path}`);

  const assets = await json(join(root, 'pass-1-implementation/assets-manifest.json'));
  invariant(assets.buildId === manifest.buildId && assets.sourceFingerprint === manifest.sourceFingerprint, 'Stale asset manifest');
  invariant(SHA256.test(String(assets.servant?.baselineFingerprint ?? '')) && SHA256.test(String(assets.servant?.currentFingerprint ?? '')), 'Ash Servant fingerprints are missing');
  const servantByteEqual = assets.servant.baselineFingerprint === assets.servant.currentFingerprint;
  const servantTechnicalOnly = assets.servant.technicalOnlyDiff === true
    && SHA256.test(String(assets.servant.baselineReferenceFingerprint ?? ''))
    && assets.servant.baselineReferenceFingerprint === assets.servant.currentReferenceFingerprint
    && SHA256.test(String(assets.servant.baselineTimingFingerprint ?? ''))
    && assets.servant.baselineTimingFingerprint === assets.servant.currentTimingFingerprint
    && typeof assets.servant.diffArtifactPath === 'string'
    && inventory.has(assets.servant.diffArtifactPath);
  invariant(servantByteEqual || servantTechnicalOnly, 'Ash Servant carry-forward fingerprint mismatch');
  invariant(assets.servant?.redesign === false && assets.servant?.visualContractChanged === false && assets.servant?.timingContractChanged === false, 'Ash Servant regression/redesign detected');
  invariant(assets.flame?.bitmapDesignCarriedForward === true && assets.flame?.geometricReplacement === false && assets.flame?.excessiveBlurMasking === false, 'Accepted bitmap flame design was not carried forward');
  invariant(assets.demoness?.referenceSha256 === manifest.referenceSha256 && assets.demoness?.referencePath && assets.demoness?.provenance, 'Demoness reference identity/provenance mismatch');
  invariant(assets.demoness?.controlledStates >= 19 && assets.decodedTextureBytes <= 64 * 1024 * 1024, 'Demoness state count or decoded texture budget failed');

  for (const path of [
    'pass-1-implementation/servant-regression.json',
    'pass-1-implementation/flame-temporal.json',
    'pass-1-implementation/demoness-continuity.json',
    'pass-1-implementation/spell-contact.json',
  ]) {
    const report = await json(join(root, path));
    invariant(report.buildId === manifest.buildId, `${path}: stale Build ID`);
    pass(report.status, path);
  }
  const frozen = await json(join(root, 'pass-1-implementation/gameplay-audio-fingerprint-regression.json'));
  invariant(frozen.buildId === manifest.buildId && frozen.gameplayBeforeFingerprint === frozen.gameplayAfterFingerprint && frozen.audioSourceBeforeFingerprint === frozen.audioSourceAfterFingerprint && frozen.audioAssetBeforeFingerprint === frozen.audioAssetAfterFingerprint, 'Gameplay/audio changed during visual-only cycle');
  pass(frozen.status, 'Frozen gameplay/audio regression');

  const browser = await json(join(root, 'pass-2-independent-blind/browser/manifest.json'));
  invariant(browser.buildId === manifest.buildId && browser.sourceFingerprint === manifest.sourceFingerprint && browser.referenceSha256 === manifest.referenceSha256, 'Stale browser manifest');
  invariant(parsedTime(browser.capturedAt) <= generatedAt, 'Browser capture postdates root manifest');
  const scenarios = new Map((browser.scenarios ?? []).map((scenario) => [scenario.id, scenario]));
  invariant(scenarios.size === REQUIRED_CASES.length, 'Unexpected or duplicate visual-polish scenarios');
  for (const id of REQUIRED_CASES) invariant(scenarios.has(id), `Missing browser scenario: ${id}`);

  const allFramePaths = new Set();
  for (const id of REQUIRED_CASES) {
    const scenario = /** @type {any} */ (scenarios.get(id));
    invariant(scenario.buildId === manifest.buildId && scenario.sourceFingerprint === manifest.sourceFingerprint, `${id}: stale scenario identity`);
    invariant(/^\d+x\d+$/.test(String(scenario.viewport ?? '')) && scenario.browser?.name && scenario.browser?.version && Number.isFinite(scenario.dpr) && scenario.dpr > 0, `${id}: incomplete browser metadata`);
    invariant(Array.isArray(scenario.frames) && scenario.frames.length >= (id.startsWith('flame-') && !id.includes('transitions') && id !== 'flame-continuous-heat' ? 24 : 12), `${id}: insufficient sampled frames`);
    let prior = -Infinity;
    const pHashes = new Set();
    const pixelHashes = new Set();
    const stateLabels = new Set();
    for (const frame of scenario.frames) {
      invariant(Number.isFinite(frame.captureMs) && frame.captureMs > prior, `${id}: frame time is not strictly increasing`);
      prior = frame.captureMs;
      invariant(SHA256.test(String(frame.sha256 ?? '')) && /^[a-f0-9]{16,64}$/.test(String(frame.pHash ?? '')), `${id}: missing frame hashes`);
      invariant(frame.path.startsWith('pass-2-independent-blind/browser/frames/') && inventory.has(frame.path), `${id}: frame is not inventoried`);
      invariant(!allFramePaths.has(frame.path), `${id}: sampled frame path reused by another scenario`);
      allFramePaths.add(frame.path);
      const bytes = await readFile(inside(root, frame.path));
      invariant(digest(bytes) === frame.sha256, `${id}: sampled frame hash mismatch`);
      const dimensions = pngInfo(bytes, `${id}/${frame.path}`);
      const [width, height] = scenario.viewport.split('x').map(Number);
      invariant(dimensions.width === width && dimensions.height === height, `${id}: frame/viewport mismatch`);
      invariant(Number.isFinite(frame.state?.heat) && Number.isInteger(frame.state?.stage) && frame.state?.flameBBox && Number.isFinite(frame.state.flameBBox.x) && Number.isFinite(frame.state.flameBBox.y) && frame.state.flameBBox.width > 0 && frame.state.flameBBox.height > 0, `${id}: incomplete state/flame target snapshot`);
      pHashes.add(frame.pHash);
      pixelHashes.add(frame.sha256);
      if (frame.state?.semanticState) stateLabels.add(frame.state.semanticState);
    }

    if (FLAME_CASES.includes(id)) {
      const slow = id.endsWith('-slow');
      invariant(scenario.playbackRate === (slow ? 0.25 : 1), `${id}: wrong playback rate`);
      invariant(SHA256.test(String(scenario.sourceSequenceFingerprint ?? '')), `${id}: missing source sequence fingerprint`);
      invariant(prior - scenario.frames[0].captureMs >= (slow ? 8_000 : 4_000), `${id}: capture too short`);
      invariant(scenario.metrics?.completeLoops >= 3 && pHashes.size >= 8 && pixelHashes.size >= 8, `${id}: insufficient loop/motion evidence`);
      invariant(scenario.metrics.visiblePopCount === 0 && scenario.metrics.loopSeamCount === 0 && scenario.metrics.ghostOrDoubleCount === 0 && scenario.metrics.particleTeleportCount === 0 && scenario.metrics.staticCardShimmer === false, `${id}: visible flame temporal defect`);
      invariant(scenario.metrics.seamToInternalP95Ratio <= 1.25 && scenario.metrics.maxUncausedAdjacentToP95Ratio <= 1.5, `${id}: frame/loop discontinuity threshold failed`);
    }
    if (id === 'flame-continuous-heat') {
      const heats = scenario.frames.map((frame) => frame.state.heat);
      invariant(Math.min(...heats) <= 50 && Math.max(...heats) >= 950 && scenario.metrics?.orderedHeatSamples >= 12 && scenario.metrics?.distinctRollingVisualLevels >= 6, 'Continuous-heat range/resolution failed');
      for (const signal of ['scale', 'brightness', 'glow', 'particleDensity', 'secondaryFlameIntensity']) invariant(scenario.metrics?.rollingVisualLevels?.[signal] >= 6, `Continuous-heat ${signal} response failed`);
      invariant(scenario.metrics.discreteOnlyPlateau === false && scenario.metrics.loopResetCount === 0 && scenario.metrics.oneFrameJumpCount === 0, 'Continuous-heat interpolation failed');
    }
    if (id === 'flame-transitions-up' || id === 'flame-transitions-down') {
      invariant(Array.isArray(scenario.metrics?.crossings) && scenario.metrics.crossings.length === 6, `${id}: six crossings required`);
      const expectedPairs = id.endsWith('-up') ? ['1-2', '2-3', '3-4', '4-5', '5-6', '6-7'] : ['7-6', '6-5', '5-4', '4-3', '3-2', '2-1'];
      invariant(scenario.metrics.crossings.map((crossing) => crossing.pair).join(',') === expectedPairs.join(','), `${id}: missing/incorrect named crossings`);
      for (const crossing of scenario.metrics.crossings) invariant(crossing.durationMs >= 800 && crossing.durationMs <= 1_500 && crossing.intermediateStates >= 4 && crossing.maxOpacityStep <= 0.20 && crossing.hardSwapCount === 0 && crossing.popCount === 0 && crossing.ghostCount === 0, `${id}: transition continuity failed`);
    }
    if (id === 'servant-regression') invariant(scenario.metrics?.visualContractChanged === false && scenario.metrics?.timingContractChanged === false && scenario.metrics?.rootDriftLogicalPx <= 2 && scenario.metrics?.clippingCount === 0 && scenario.metrics?.teleportCount === 0, 'Ash Servant regression detected');
    if (id === 'demoness-idle') invariant(prior - scenario.frames[0].captureMs >= 20_000 && scenario.metrics?.breathingPeriods >= 3 && scenario.metrics?.danceLikeEvents === 0 && scenario.metrics?.rapidWholeBodySwayEvents === 0 && scenario.metrics?.twitchEvents === 0, 'Demoness idle is not slow/calm/alive');
    if (id === 'demoness-disapproval') invariant(scenario.metrics?.completeCycles >= 3 && scenario.metrics?.orderedSequence === 'look-fire>gaze-shift>frown>pause>head-shake>return-fire' && scenario.metrics?.wholeBodyTransformEvents === 0 && scenario.metrics?.castInterruptions === 0, 'Demoness disapproval failed');
    if (id === 'demoness-full-cast') {
      for (const state of DEMONESS_STATES) invariant(stateLabels.has(state), `Demoness control sequence missing: ${state}`);
      invariant(scenario.metrics?.idleToCastIntermediatePoses >= 8 && scenario.metrics?.castToRecoveryIntermediatePoses >= 8 && scenario.metrics?.morphEvents === 0 && scenario.metrics?.identityDiscontinuities === 0 && scenario.metrics?.handJumpEvents === 0, 'Demoness cast continuity failed');
    }
    if (id === 'demoness-spell-contact') invariant(scenario.metrics?.originToHandSocketMaxPx <= 12 && scenario.metrics?.endpointToVisibleFlameMaxPx <= 12 && scenario.metrics?.fixedIndependentTarget === false && scenario.metrics?.spellMissCount === 0 && scenario.metrics?.gazePalmsBodyConverge === true, 'Dynamic hand-to-visible-flame targeting failed');
    if (id === 'demoness-fire-reaction') invariant(scenario.metrics?.preContactReactionCount === 0 && scenario.metrics?.firstReactionDelayMs >= 0 && scenario.metrics?.firstReactionDelayMs <= 100 && scenario.metrics?.peakAfterContact === true && scenario.metrics?.settledDuringRecovery === true, 'Fire reaction/contact ordering failed');
  }

  for (const level of FLAME_LEVELS) {
    const normal = /** @type {any} */ (scenarios.get(`flame-${level}-normal`));
    const slow = /** @type {any} */ (scenarios.get(`flame-${level}-slow`));
    invariant(normal.sourceSequenceFingerprint === slow.sourceSequenceFingerprint, `flame-${level}: normal/slow source mismatch`);
  }

  for (const name of ['flame', 'transitions', 'demoness', 'spell-contact', 'performance']) {
    const metrics = await json(join(root, `pass-2-independent-blind/metrics/${name}.json`));
    invariant(metrics.buildId === manifest.buildId, `${name} metrics: stale Build ID`);
    pass(metrics.status, `${name} metrics`);
  }
  const demonessMetrics = await json(join(root, 'pass-2-independent-blind/metrics/demoness.json'));
  for (const feature of ['face', 'crownHair', 'silhouette', 'costume', 'palette', 'proportions', 'scaleDominance']) pass(demonessMetrics.referenceChecklist?.[feature], `Demoness reference ${feature}`);
  invariant(demonessMetrics.heightVsServant >= 1.25 && demonessMetrics.flameOverlapPixels === 0 && demonessMetrics.uiOverlapPixels === 0, 'Demoness dominance/clearance gate failed');
  invariant(demonessMetrics.rootDriftLogicalPx <= 2 && demonessMetrics.scaleDriftRatio <= 0.02 && demonessMetrics.fragmentCount === 0 && demonessMetrics.clippingCount === 0 && demonessMetrics.teleportCount === 0 && demonessMetrics.slidingCount === 0, 'Demoness anchor/continuity geometry failed');
  const contactMetrics = await json(join(root, 'pass-2-independent-blind/metrics/spell-contact.json'));
  for (const viewport of ['390x844', '1366x768', '800x360']) {
    const sample = contactMetrics.viewports?.[viewport];
    invariant(sample && sample.originToHandSocketMaxPx <= 12 && sample.endpointToVisibleFlameMaxPx <= 12 && sample.spellMissCount === 0, `Spell targeting failed at ${viewport}`);
    invariant(typeof sample.framePath === 'string' && inventory.has(sample.framePath), `Spell targeting ${viewport}: missing frame evidence`);
    const bytes = await readFile(inside(root, sample.framePath));
    invariant(digest(bytes) === sample.sha256, `Spell targeting ${viewport}: frame hash mismatch`);
    const dimensions = pngInfo(bytes, `spell-contact-${viewport}`);
    const [width, height] = viewport.split('x').map(Number);
    invariant(dimensions.width === width && dimensions.height === height, `Spell targeting ${viewport}: frame dimensions mismatch`);
  }

  const blind = await json(join(root, 'pass-2-independent-blind/blind-review.json'));
  invariant(blind.buildId === manifest.buildId && blind.reviewerId === owners[1] && blind.independent === true && blind.productionContributor === false, 'Blind reviewer identity/independence failed');
  invariant(blind.fixesDisclosedBeforeFirstObservations === false && blind.randomizedOpaqueClipIds === true && blind.labels?.hud === false && blind.labels?.debug === false && blind.labels?.stateNames === false && blind.labels?.fileNameHints === false, 'Blind review exposed labels/fix summary');
  invariant(blind.firstObservationsBeforeDiagnostics === true && typeof blind.firstObservations === 'string' && blind.firstObservations.trim().length >= 20, 'Blind first observations are missing');
  for (const id of ['HE-01', 'HE-02', 'HE-03', 'HE-04', 'HE-05']) {
    pass(blind.questions?.[id]?.decision, `Human-Eye ${id}`);
    invariant(Array.isArray(blind.questions[id].evidence) && blind.questions[id].evidence.length > 0 && blind.questions[id].evidence.every((path) => inventory.has(path)), `Human-Eye ${id}: missing inventoried frame links`);
  }
  pass(blind.decision, 'Blind Human-Eye decision');
  const defects = await json(join(root, 'pass-2-independent-blind/defects.json'));
  invariant(defects.openCritical === 0 && defects.openHigh === 0, 'Open Critical/High after independent review');

  for (const path of ['full-cycle.json', 'cross-browser.json', 'audio-lifecycle.json', 'regression.json']) {
    const report = await json(join(root, `pass-3-regression/${path}`));
    invariant(report.buildId === manifest.buildId, `${path}: stale regression Build ID`);
    pass(report.status, path);
  }
  const signoff = await json(join(root, 'pass-3-regression/signoff.json'));
  invariant(signoff.buildId === manifest.buildId && signoff.passOwners?.implementation === owners[0] && signoff.passOwners?.independent === owners[1] && signoff.passOwners?.regression === owners[2], 'Signoff/pass owner mismatch');
  invariant(signoff.openCritical === 0 && signoff.openHigh === 0, 'Final signoff has open Critical/High');
  pass(signoff.decision, 'Final Cycle 05 signoff');

  return Object.freeze({ schemaVersion: 1, cycle: '05', buildId: manifest.buildId, files: inventory.size, scenarios: scenarios.size, passes: 3, status: 'PASS' });
}

async function main() {
  const evidenceRoot = process.argv[2];
  if (!evidenceRoot) throw new Error('Usage: node scripts/validate-visual-polish-evidence.mjs reports/visual-polish/<exact-build-id>');
  const dist = await json(join(gameRoot, 'dist/build-manifest.json'));
  invariant(dist.clean === true, 'Current dist is not a clean exact build');
  const report = await validateVisualPolishEvidence(evidenceRoot, {
    expectedBuildId: dist.buildId,
    expectedCommitSha: dist.commitSha,
    expectedSourceFingerprint: dist.sourceFingerprint,
  });
  console.log(`visual-polish evidence PASS (${report.buildId}; ${report.scenarios} scenarios; ${report.passes} passes)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
