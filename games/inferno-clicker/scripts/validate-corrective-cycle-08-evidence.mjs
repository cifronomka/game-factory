// @ts-check

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { defringe, extractCell, normalizedSource, scrubPartialNeutralMatte } from './build-cycle06-character-assets.mjs';
import { auditCycle08Fingerprints } from './cycle08-fingerprint-audit.mjs';
import { pixelMetrics } from './generate-cycle08-evidence.mjs';
import { gameRoot } from './lib.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const BUILD_ID = /^\d+\.\d+\.\d+\+[a-f0-9]{12}$/;
const CYCLE_VERSION = '0.1.1';
const BASELINE_BUILD_ID = '0.1.0+a17cdd65fd5a';
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SUBJECTS = Object.freeze(['ash-servant', 'demoness']);
const BACKGROUNDS = Object.freeze(['black', 'dark-red', 'neutral-gray']);
const BACKGROUND_HEX = Object.freeze({ black: '#000000', 'dark-red': '#350b0b', 'neutral-gray': '#777777' });
const VIEWPORTS = Object.freeze(['390x844', '768x1024', '1366x768', '800x360']);
const DPRS = Object.freeze([1, 2]);
const MOTION_DELAYS = Object.freeze({ normal: 100, slow: 400 });
const MOTION_CYCLES = 3;
const APPROVED_REFERENCE_PATH = 'visual-references/stage-references/stage-5-demoness-reference-view.jpg';
const REFERENCE_FEATURES = Object.freeze(['face', 'crown-hair', 'silhouette', 'closed-high-neck-costume', 'ember-copper-palette', 'proportions', 'hands', 'scale-dominance']);
const REQUIRED_COMMANDS = Object.freeze(['npm run lint', 'npm run typecheck', 'npm test', 'npm run assets:audit', 'npm run animation:audit', 'npm run fingerprint:audit:cycle08', 'npm run build', 'npm run test:e2e', 'npm run release:audit']);
const REQUIRED_ISSUES = Object.freeze([
  'C08-01-servant-white-matte',
  'C08-02-servant-internal-residue',
  'C08-03-demoness-white-matte',
  'C08-04-demoness-sharpness-scale',
]);
const REQUIRED_REGRESSIONS = Object.freeze([
  'contour-dark-backgrounds',
  'internal-gaps-all-frames',
  'viewport-dpr-matrix',
  'socket-origin-parity',
  'pause-freeze',
  'cancel-cleanup',
  'reduced-motion-semantic-parity',
  'gameplay-timing-parity',
]);
const REQUIRED_ACCEPTANCE = Object.freeze(['F-10', 'G-09', 'V-25', 'V-26', 'V-27', 'V-28', 'V-29', 'V-30', 'A-06', 'PERF-09', 'Y-07', 'Q-09', 'Q-10', 'RLS-07', 'RLS-08']);

const EXPECTED_ATLASES = Object.freeze([
  ...['idle', 'inhale', 'blow', 'recovery'].map((clip) => Object.freeze({ id: `CH-ASH-SERVANT-${clip.toUpperCase()}-C08`, family: 'ash-servant', clip, version: 'v6', atlas: [1024, 640], cell: [256, 320] })),
  ...['idle', 'cast', 'hold', 'recovery'].map((clip) => Object.freeze({ id: `CH-DEMONESS-${clip.toUpperCase()}-C08`, family: 'demoness', clip, version: 'v7', atlas: [2048, 1664], cell: [512, 832] })),
]);

/** @param {Buffer|string} value */
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
/** @param {unknown} condition @param {string} message */
function invariant(condition, message) { if (!condition) throw new Error(message); }
/** @param {unknown} value @param {string} label */
function instant(value, label) {
  const parsed = Date.parse(String(value ?? ''));
  invariant(Number.isFinite(parsed), `${label}: missing or invalid timestamp`);
  return parsed;
}
/** @param {string} root @param {unknown} candidate */
function inside(root, candidate) {
  invariant(typeof candidate === 'string' && candidate.length > 0 && !candidate.includes('\\'), `Unsafe evidence path: ${candidate}`);
  const absolute = resolve(root, candidate);
  invariant(absolute.startsWith(`${root}${sep}`), `Unsafe evidence path: ${candidate}`);
  return absolute;
}
/** @param {string} path */
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
/** @param {string} path @param {string} expectedSha @param {number} expectedBytes @param {string} label */
async function assertArtifact(path, expectedSha, expectedBytes, label) {
  invariant(SHA256.test(String(expectedSha ?? '')) && Number.isInteger(expectedBytes) && expectedBytes > 0, `${label}: invalid artifact inventory`);
  const bytes = await readFile(path);
  invariant(bytes.length === expectedBytes && digest(bytes) === expectedSha, `${label}: artifact hash/size mismatch`);
}
/** @param {string} path @param {unknown} expectedSha @param {string} label */
async function assertPng(path, expectedSha, label) {
  invariant(SHA256.test(String(expectedSha ?? '')), `${label}: invalid PNG SHA-256`);
  const bytes = await readFile(path);
  invariant(bytes.length > PNG_MAGIC.length && bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC), `${label}: invalid PNG evidence`);
  invariant(digest(bytes) === expectedSha, `${label}: PNG hash mismatch`);
  invariant(bytes.length >= 24 && bytes.subarray(12, 16).toString('ascii') === 'IHDR', `${label}: PNG IHDR is missing`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  invariant(width > 0 && height > 0, `${label}: invalid PNG dimensions`);
  const metadata = await sharp(bytes, { failOn: 'error' }).metadata().catch(() => null);
  invariant(metadata?.format === 'png' && metadata.width === width && metadata.height === height, `${label}: PNG cannot be decoded`);
  return { width, height };
}
/** @param {string} path @param {unknown} expectedSha @param {number} expectedBytes @param {string} label */
async function assertAnimatedWebp(path, expectedSha, expectedBytes, label) {
  await assertArtifact(path, expectedSha, expectedBytes, label);
  const metadata = await sharp(path, { animated: true, failOn: 'error' }).metadata().catch(() => null);
  invariant(metadata?.format === 'webp' && Number(metadata.pages) >= 24, `${label}: continuous animated WebP cannot be decoded or has fewer than three eight-frame cycles`);
  return metadata;
}
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
/** @param {unknown} actual @param {unknown} expected @param {string} message */
function exactArray(actual, expected, message) {
  invariant(Array.isArray(actual) && JSON.stringify(actual) === JSON.stringify(expected), message);
}

/** @param {Buffer} rgba @param {{width:number,channels:number}} info @param {{x:number,y:number,w:number,h:number}} frame */
function frameAlpha(rgba, info, frame) {
  invariant(info.channels === 4, 'Decoded character atlas must expose RGBA pixels');
  const alpha = Buffer.alloc(frame.w * frame.h);
  let target = 0;
  for (let y = 0; y < frame.h; y += 1) {
    let source = ((frame.y + y) * info.width + frame.x) * info.channels + 3;
    for (let x = 0; x < frame.w; x += 1) {
      alpha[target] = rgba[source];
      target += 1;
      source += info.channels;
    }
  }
  return alpha;
}

/** @param {string} distRoot @param {Map<string, any>} evidenceAtlases @param {any} budgets */
async function verifyRuntimeAssets(distRoot, evidenceAtlases, budgets) {
  for (const expected of EXPECTED_ATLASES) {
    const base = `${expected.family}-${expected.clip}-${expected.version}`;
    const metadataPath = join(distRoot, 'assets', 'characters', expected.family, `${base}.json`);
    const atlasPath = join(distRoot, 'assets', 'characters', expected.family, `${base}.webp`);
    const metadata = await readJson(metadataPath);
    const atlasBytes = await readFile(atlasPath);
    invariant(metadata.cycle === '08' && metadata.atlasWidth === expected.atlas[0] && metadata.atlasHeight === expected.atlas[1] && metadata.frameWidth === expected.cell[0] && metadata.frameHeight === expected.cell[1], `${expected.id}: dist metadata geometry/cycle mismatch`);
    invariant(digest(atlasBytes) === metadata.atlasSha256, `${expected.id}: dist WebP hash does not match metadata`);
    const frames = metadata.clips?.[expected.clip]?.frames;
    invariant(Array.isArray(frames) && frames.length === 8, `${expected.id}: dist frame inventory is incomplete`);
    const decoded = await sharp(atlasBytes, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    invariant(decoded.info.width === expected.atlas[0] && decoded.info.height === expected.atlas[1] && decoded.info.channels === 4, `${expected.id}: decoded WebP geometry is wrong`);
    const sourcePath = inside(gameRoot, metadata.sourceSheet);
    const sourceBytes = await readFile(sourcePath);
    invariant(digest(sourceBytes) === metadata.sourceSheetSha256, `${expected.id}: approved source sheet hash mismatch`);
    const normalized = await normalizedSource(sourcePath, false, 'smart-alpha');
    let exactAlphaFrames = 0;
    const decodedMetrics = [];
    for (const [frameIndex, frame] of frames.entries()) {
      invariant(frame.w === expected.cell[0] && frame.h === expected.cell[1], `${expected.id}: packed frame dimensions are wrong`);
      const decodedAlphaSha256 = digest(frameAlpha(decoded.data, decoded.info, frame));
      const extracted = await extractCell(normalized, 4, 2, frameIndex, frame.w, frame.h, 'largest', true, 1);
      const approvedFrame = scrubPartialNeutralMatte(defringe(extracted, frame.w, frame.h), frame.w, frame.h);
      const approvedAlphaSha256 = digest(frameAlpha(approvedFrame, { width: frame.w, channels: 4 }, { x: 0, y: 0, w: frame.w, h: frame.h }));
      invariant(digest(approvedFrame) === frame.sha256 && approvedAlphaSha256 === frame.alphaSha256, `${expected.id}: metadata does not reproduce from the approved source cleanup pipeline`);
      invariant(decodedAlphaSha256 === frame.alphaSha256 && decodedAlphaSha256 === frame.encodedAlphaSha256 && frame.encodedAlphaExact === true, `${expected.id}: decoded frame alpha differs from approved source mask`);
      decodedMetrics.push(pixelMetrics(decoded.data, decoded.info.width, frame));
      exactAlphaFrames += 1;
    }
    const derived = {
      maxEdgeAlphaPixels: Math.max(...decodedMetrics.map((metrics) => metrics.edgeAlphaPixels)),
      maxMatteRatio: Math.max(...decodedMetrics.map((metrics) => metrics.matteRatio)),
      maxInternalNeutralResidueRatio: Math.max(...decodedMetrics.map((metrics) => metrics.internalNeutralResidueRatio)),
      maxSourceToAtlasUpscale: Math.max(...frames.map((frame) => Number(frame.sourceToAtlasUpscale))),
      exactAlphaFrames,
      maxDetachedPartialAlphaPixels: Math.max(...decodedMetrics.map((metrics) => metrics.detachedPartialAlphaPixels)),
    };
    const evidence = evidenceAtlases.get(expected.id);
    for (const [field, value] of Object.entries(derived)) {
      if (field === 'maxDetachedPartialAlphaPixels' && expected.family !== 'ash-servant') continue;
      invariant(evidence?.[field] === value, `${expected.id}: ${field} evidence does not match decoded dist metadata`);
    }
  }

  for (const family of ['ash-servant', 'demoness']) {
    const directory = join(distRoot, 'assets', 'characters', family);
    const actual = (await readdir(directory)).filter((name) => /\.(?:json|webp)$/i.test(name)).sort();
    const expected = EXPECTED_ATLASES.filter((atlas) => atlas.family === family)
      .flatMap((atlas) => [`${family}-${atlas.clip}-${atlas.version}.json`, `${family}-${atlas.clip}-${atlas.version}.webp`]).sort();
    exactArray(actual, expected, `${family}: dist contains stale or missing character atlases`);
  }

  const manifest = await readJson(join(distRoot, 'assets', 'assets-manifest.json'));
  invariant(Array.isArray(manifest.assets) && manifest.assets.length > 0, 'Cycle 08 production asset manifest is invalid');
  let artBytes = 0;
  let decodedBytes = 0;
  const groups = new Map();
  for (const entry of manifest.assets) {
    artBytes += Number(entry.bytes);
    const physical = Number(entry.width) * Number(entry.height) * 4;
    if (entry.residencyGroup) {
      const values = groups.get(entry.residencyGroup) ?? [];
      values.push(physical);
      groups.set(entry.residencyGroup, values);
    } else decodedBytes += physical;
  }
  for (const [name, values] of groups) {
    const contract = manifest.residencyGroups?.[name];
    invariant(Number.isInteger(contract?.maxResident), `Cycle 08 residency group is invalid: ${name}`);
    decodedBytes += values.sort((a, b) => b - a).slice(0, contract.maxResident).reduce((sum, value) => sum + value, 0);
    decodedBytes += Number(contract.maxCachedFrames ?? 0) * Number(contract.cachedFrameDecodedBytes ?? 0);
  }
  const packageBytes = (await Promise.all((await walk(distRoot)).map(async (path) => (await stat(path)).size))).reduce((sum, value) => sum + value, 0);
  invariant(budgets.artBytes === artBytes && budgets.decodedBytes === decodedBytes && budgets.packageBytes === packageBytes, 'Cycle 08 budget evidence does not match exact dist files');
}

/** @param {string} evidenceDir @param {any} nativeSource @param {boolean} verifyCandidateSources */
async function verifyNativeSource(evidenceDir, nativeSource, verifyCandidateSources) {
  const manifestPath = inside(evidenceDir, nativeSource?.manifest?.path);
  const sourceManifest = await readJson(manifestPath);
  const frames = sourceManifest.demonessFrames;
  invariant(sourceManifest.cycle === '08' && sourceManifest.generationMode === 'built-in OpenAI ImageGen' && Array.isArray(frames) && frames.length === 32, 'Cycle 08 copied native source manifest is incomplete');
  const approvedReference = sourceManifest.approvedReference;
  invariant(approvedReference?.path === APPROVED_REFERENCE_PATH && SHA256.test(String(approvedReference?.sha256 ?? '')) && typeof approvedReference?.provenance === 'string' && approvedReference.provenance.length >= 48, 'Cycle 08 approved reference provenance is incomplete');
  invariant(JSON.stringify(approvedReference.featureChecklist) === JSON.stringify(REFERENCE_FEATURES), 'Cycle 08 approved reference checklist is incomplete');
  invariant(SHA256.test(String(sourceManifest.identityMaster?.sha256 ?? '')) && Number(sourceManifest.identityMaster?.width) >= 512 && Number(sourceManifest.identityMaster?.height) >= 832, 'Cycle 08 identity master proof is invalid');
  const unique = new Set(frames.map((frame) => frame?.sha256));
  const minWidth = Math.min(...frames.map((frame) => Number(frame?.width)));
  const minHeight = Math.min(...frames.map((frame) => Number(frame?.height)));
  invariant(unique.size === 32 && [...unique].every((value) => SHA256.test(String(value))) && minWidth >= 512 && minHeight >= 832, 'Cycle 08 copied native source frame proof is invalid');
  invariant(nativeSource.generationMode === sourceManifest.generationMode && nativeSource.identityMasterSha256 === sourceManifest.identityMaster.sha256 && nativeSource.oldRasterUpscaleUsed === false, 'Cycle 08 redraw provenance does not exclude old-raster upscale');
  exactArray(nativeSource.targetCell, [512, 832], 'Cycle 08 native target cell is wrong');
  invariant(nativeSource.maxSourceToAtlasUpscale === 1, 'Cycle 08 native source-to-atlas upscale gate is wrong');
  invariant(nativeSource.approvedReference?.path === approvedReference.path && nativeSource.approvedReference?.sha256 === approvedReference.sha256 && nativeSource.approvedReference?.provenance === approvedReference.provenance && JSON.stringify(nativeSource.approvedReference?.featureChecklist) === JSON.stringify(REFERENCE_FEATURES), 'Cycle 08 approved reference evidence is stale');
  invariant(nativeSource.demonessFrameCount === frames.length && nativeSource.uniqueFrameHashes === unique.size && nativeSource.minWidth === minWidth && nativeSource.minHeight === minHeight, 'Cycle 08 native source summary does not match its manifest');
  if (!verifyCandidateSources) return;
  const canonicalManifestPath = join(gameRoot, 'visual-references', 'cycle-08-sources', 'source-manifest.json');
  const canonicalBytes = await readFile(canonicalManifestPath);
  invariant(digest(canonicalBytes) === nativeSource.manifestSha256, 'Cycle 08 evidence source manifest differs from candidate source');
  const canonicalReferencePath = inside(gameRoot, approvedReference.path);
  const canonicalReferenceBytes = await readFile(canonicalReferencePath);
  invariant(digest(canonicalReferenceBytes) === approvedReference.sha256, 'Cycle 08 authoritative reference hash mismatch');
  const canonicalReferenceMetadata = await sharp(canonicalReferenceBytes, { failOn: 'error' }).metadata().catch(() => null);
  invariant(canonicalReferenceMetadata?.width === approvedReference.width && canonicalReferenceMetadata?.height === approvedReference.height, 'Cycle 08 authoritative reference dimensions mismatch');
  const identityPath = inside(gameRoot, sourceManifest.identityMaster.path);
  const identityBytes = await readFile(identityPath);
  invariant(digest(identityBytes) === sourceManifest.identityMaster.sha256, 'Cycle 08 identity master hash mismatch');
  const identityMetadata = await sharp(identityBytes, { failOn: 'error' }).metadata().catch(() => null);
  invariant(identityMetadata?.format === 'png' && identityMetadata.width === sourceManifest.identityMaster.width && identityMetadata.height === sourceManifest.identityMaster.height, 'Cycle 08 identity master dimensions mismatch');
  for (const frame of frames) {
    const path = inside(gameRoot, frame.path);
    const bytes = await readFile(path);
    invariant(digest(bytes) === frame.sha256, `Cycle 08 native source hash mismatch: ${frame.path}`);
    const metadata = await sharp(bytes, { failOn: 'error' }).metadata().catch(() => null);
    invariant(metadata?.format === 'png' && metadata.width === frame.width && metadata.height === frame.height, `Cycle 08 native source dimensions mismatch: ${frame.path}`);
  }
}

/**
 * Cycle 08 evidence is an immutable contract and cannot be satisfied by a
 * relabelled Cycle 07 report.
 * @param {{evidenceDir:string,distManifestPath?:string,verifyRuntimeAssets?:boolean,verifyCandidateSources?:boolean}} options
 */
export async function validateCorrectiveCycle08Evidence(options) {
  const evidenceDir = resolve(options.evidenceDir);
  invariant((await stat(evidenceDir)).isDirectory(), 'Cycle 08 evidence directory is missing');
  const distManifestPath = resolve(options.distManifestPath ?? join(gameRoot, 'dist/build-manifest.json'));
  const distManifestBytes = await readFile(distManifestPath);
  const distManifest = JSON.parse(distManifestBytes.toString('utf8'));
  const summary = await readJson(join(evidenceDir, 'summary.json'));

  invariant(summary.schemaVersion === 1 && summary.cycle === '08', 'Invalid Cycle 08 summary; stale Cycle 07 evidence is forbidden');
  invariant(summary.status === 'PASS', 'Cycle 08 summary is not PASS');
  invariant(distManifest.version === CYCLE_VERSION && distManifest.clean === true && COMMIT_SHA.test(String(distManifest.commitSha ?? '')) && BUILD_ID.test(String(distManifest.buildId ?? '')) && distManifest.buildId.startsWith(`${CYCLE_VERSION}+`) && SHA256.test(String(distManifest.sourceFingerprint ?? '')), 'Cycle 08 requires a clean exact 0.1.1 dist build');
  invariant(distManifest.buildId === `${CYCLE_VERSION}+${distManifest.commitSha.slice(0, 12)}`, 'Cycle 08 Build ID does not match the exact commit SHA');
  invariant(summary.version === CYCLE_VERSION, 'Cycle 08 summary version must be 0.1.1');
  invariant(summary.buildId === distManifest.buildId && basename(evidenceDir) === summary.buildId, 'Cycle 08 evidence must belong to the exact Build ID directory');
  invariant(summary.sourceFingerprint === distManifest.sourceFingerprint, 'Cycle 08 source fingerprint does not match dist build');
  invariant(summary.buildManifestSha256 === digest(distManifestBytes), 'Cycle 08 build-manifest hash mismatch');
  invariant(summary.defects?.critical === 0 && summary.defects?.high === 0, 'Cycle 08 has open Critical/High defects');

  invariant(Array.isArray(summary.files) && summary.files.length > 0, 'Cycle 08 evidence inventory is missing');
  const inventory = new Map();
  for (const entry of summary.files) {
    invariant(typeof entry.path === 'string' && !inventory.has(entry.path), `Cycle 08 duplicate/invalid inventory path: ${entry.path}`);
    await assertArtifact(inside(evidenceDir, entry.path), entry.sha256, entry.bytes, entry.path);
    inventory.set(entry.path, entry);
  }
  const actualFiles = (await walk(evidenceDir)).map((path) => relative(evidenceDir, path).split(sep).join('/')).filter((path) => path !== 'summary.json');
  invariant(actualFiles.length === inventory.size && actualFiles.every((path) => inventory.has(path)), 'Cycle 08 evidence contains unlisted or missing files');

  const owners = summary.passOwners;
  const ownerValues = [owners?.implementation, owners?.targetedQa, owners?.retestQa, owners?.independentQa, owners?.regressionQa];
  invariant(ownerValues.every((value) => typeof value === 'string' && value.length >= 3), 'Cycle 08 pass owners are incomplete');
  invariant(new Set(ownerValues).size === ownerValues.length, 'Cycle 08 passes must have different owners');
  for (const name of ['automation', 'assets', 'visual', 'issues', 'independent', 'regression', 'acceptance']) {
    invariant(typeof summary.passes?.[name] === 'string', `Cycle 08 ${name} pass is missing`);
  }

  /** @param {string} name */
  const loadPass = async (name) => {
    const pass = await readJson(inside(evidenceDir, summary.passes[name]));
    invariant(pass.buildId === summary.buildId && pass.sourceFingerprint === summary.sourceFingerprint, `Cycle 08 ${name} identity is stale`);
    invariant(pass.status === 'PASS', `Cycle 08 ${name} pass is not PASS`);
    return pass;
  };

  const automation = await loadPass('automation');
  invariant(Number.isInteger(automation.testsPassed) && automation.testsPassed > 0 && automation.testsFailed === 0 && automation.testsSkipped === 0, 'Cycle 08 automation results are incomplete');
  const commandResults = new Map((automation.commands ?? []).map((entry) => [entry?.name, entry]));
  for (const name of REQUIRED_COMMANDS) {
    const command = commandResults.get(name);
    invariant(command?.status === 'PASS' && command?.exitCode === 0, `Cycle 08 required command did not pass: ${name}`);
    await assertArtifact(inside(evidenceDir, command?.log?.path), command?.log?.sha256, command?.log?.bytes, `${name} log`);
  }

  const assets = await loadPass('assets');
  const budgets = assets.budgets;
  invariant(Number.isInteger(budgets?.artBytes) && budgets.artBytes <= budgets.artLimitBytes && budgets.artLimitBytes === 9.8 * 1024 * 1024, 'Cycle 08 art budget evidence is invalid');
  invariant(Number.isInteger(budgets?.decodedBytes) && budgets.decodedBytes <= budgets.decodedHardLimitBytes && budgets.decodedHardLimitBytes === 64 * 1024 * 1024, 'Cycle 08 decoded residency evidence is invalid');
  invariant(Number.isInteger(budgets?.packageBytes) && budgets.packageBytes <= budgets.packageLimitBytes && budgets.packageLimitBytes === 15 * 1024 * 1024, 'Cycle 08 package budget evidence is invalid');
  const nativeSource = assets.nativeSource;
  invariant(nativeSource?.demonessFrameCount === 32 && nativeSource?.uniqueFrameHashes === 32 && Number(nativeSource?.minWidth) >= 512 && Number(nativeSource?.minHeight) >= 832 && SHA256.test(String(nativeSource?.manifestSha256 ?? '')), 'Cycle 08 native Demoness source proof is invalid');
  await assertArtifact(inside(evidenceDir, nativeSource?.manifest?.path), nativeSource?.manifest?.sha256, nativeSource?.manifest?.bytes, 'Cycle 08 native source manifest');
  await assertArtifact(inside(evidenceDir, nativeSource?.approvedReference?.artifact?.path), nativeSource?.approvedReference?.artifact?.sha256, nativeSource?.approvedReference?.artifact?.bytes, 'Cycle 08 approved Demoness reference');
  invariant(nativeSource.approvedReference.artifact.sha256 === nativeSource.approvedReference.sha256, 'Cycle 08 approved reference artifact hash is inconsistent');
  invariant(nativeSource.manifest.sha256 === nativeSource.manifestSha256, 'Cycle 08 native source manifest hash is inconsistent');
  await verifyNativeSource(evidenceDir, nativeSource, options.verifyCandidateSources !== false);
  const atlases = new Map((assets.atlases ?? []).map((entry) => [entry?.id, entry]));
  invariant(atlases.size === assets.atlases?.length, 'Cycle 08 atlas ids must be unique');
  for (const expected of EXPECTED_ATLASES) {
    const atlas = atlases.get(expected.id);
    invariant(atlas?.version === expected.version && atlas?.frameCount === 8, `${expected.id}: wrong version or frame count`);
    exactArray(atlas.atlas, expected.atlas, `${expected.id}: atlas dimensions are wrong`);
    exactArray(atlas.cell, expected.cell, `${expected.id}: cell dimensions are wrong`);
    invariant(atlas.maxEdgeAlphaPixels === 0, `${expected.id}: alpha touches a cell edge`);
    invariant(Number.isFinite(atlas.maxMatteRatio) && atlas.maxMatteRatio <= 0.01, `${expected.id}: white contour matte exceeds 1%`);
    invariant(Number.isFinite(atlas.maxInternalNeutralResidueRatio) && atlas.maxInternalNeutralResidueRatio <= 0.005, `${expected.id}: internal-gap neutral residue exceeds 0.5%`);
    invariant(Number.isFinite(atlas.maxSourceToAtlasUpscale) && atlas.maxSourceToAtlasUpscale <= 1, `${expected.id}: source artwork is upscaled above the native 1.0x limit`);
    invariant(atlas.exactAlphaFrames === 8 && atlas.changedAlphaPixels === 0 && atlas.maxAlphaError === 0 && atlas.lowAlphaLeakPixels === 0, `${expected.id}: decoded WebP alpha does not exactly match the approved source masks`);
    if (expected.id.startsWith('CH-ASH-SERVANT-')) invariant(atlas.maxDetachedPartialAlphaPixels === 0, `${expected.id}: detached block/tile contour pixels remain`);
  }
  if (options.verifyRuntimeAssets !== false) await verifyRuntimeAssets(dirname(distManifestPath), atlases, budgets);
  const runtime = assets.runtime;
  exactArray(runtime?.demonessPreviousSize, [420, 700], 'Cycle 08 previous Demoness size is wrong');
  exactArray(runtime?.demonessSize, [504, 840], 'Cycle 08 Demoness must be exactly 20% larger');
  exactArray(runtime?.servantSize, [540, 590], 'Cycle 08 Servant runtime size drifted');
  invariant(Math.abs(Number(runtime?.demonessScaleFactor) - 1.2) < 1e-9, 'Cycle 08 Demoness scale factor must be 1.2');
  invariant(Number(runtime?.minVisibleHeightRatio) >= 1.25, 'Cycle 08 Demoness visible bbox is not at least 1.25x the Servant');
  invariant(runtime?.socketMetadataParity === true, 'Cycle 08 runtime socket metadata parity failed');
  invariant(Number(runtime?.maxRootDriftLogicalPx) <= 2 && Number(runtime?.maxAnatomicalScaleDriftPercent) <= 2, 'Cycle 08 root/anatomical stability failed');
  const upscale = new Map();
  for (const sample of assets.upscaleSamples ?? []) {
    const key = `${sample?.viewport}:DPR${sample?.dpr}`;
    invariant(!upscale.has(key), `Cycle 08 duplicate upscale sample: ${key}`);
    invariant(VIEWPORTS.includes(sample?.viewport) && DPRS.includes(sample?.dpr), `Cycle 08 invalid upscale sample: ${key}`);
    invariant(Number.isFinite(sample?.effectiveUpscale) && sample.effectiveUpscale > 0 && sample.effectiveUpscale <= 1.25, `Cycle 08 source upscale exceeds 1.25x: ${key}`);
    upscale.set(key, sample.effectiveUpscale);
  }
  for (const viewport of VIEWPORTS) for (const dpr of DPRS) invariant(upscale.has(`${viewport}:DPR${dpr}`), `Cycle 08 upscale matrix is missing ${viewport}:DPR${dpr}`);

  const visual = await loadPass('visual');
  invariant(visual.reviewOwner === owners.retestQa && Number.isFinite(instant(visual.reviewedAt, 'Cycle 08 visual review')), 'Cycle 08 visual review owner/timestamp is invalid');
  await assertArtifact(inside(evidenceDir, visual.renderManifest?.path), visual.renderManifest?.sha256, visual.renderManifest?.bytes, 'Cycle 08 render manifest');
  invariant(visual.renderManifestSha256 === visual.renderManifest.sha256, 'Cycle 08 visual review is not bound to its render manifest');
  const renderManifest = await readJson(inside(evidenceDir, visual.renderManifest.path));
  invariant(renderManifest.schemaVersion === 1 && renderManifest.cycle === '08' && renderManifest.version === CYCLE_VERSION && renderManifest.status === 'READY_FOR_QA', 'Cycle 08 render manifest schema/status is invalid');
  invariant(renderManifest.buildId === summary.buildId && renderManifest.commitSha === distManifest.commitSha && renderManifest.sourceFingerprint === summary.sourceFingerprint && renderManifest.buildManifestSha256 === summary.buildManifestSha256, 'Cycle 08 render manifest identity is stale');
  invariant(renderManifest.renderer === visual.renderer && renderManifest.rendererVersion === visual.rendererVersion, 'Cycle 08 reviewed renderer identity changed after review');
  invariant(visual.framesInspected?.['ash-servant'] === 32 && visual.framesInspected?.demoness === 32, 'Cycle 08 visual review must inspect all 32 frames per character');
  invariant(visual.referenceReview?.owner === owners.retestQa && visual.referenceReview?.referenceSha256 === nativeSource.approvedReference.sha256 && Number.isFinite(instant(visual.referenceReview?.completedAt, 'Cycle 08 reference review')), 'Cycle 08 reference review owner/hash/timestamp is invalid');
  invariant(typeof visual.referenceReview?.observation === 'string' && visual.referenceReview.observation.length >= 48 && REFERENCE_FEATURES.every((feature) => visual.referenceReview?.features?.[feature] === 'PASS'), 'Cycle 08 authoritative reference feature review is incomplete');
  invariant(visual.normalSpeedCycles >= 3 && visual.slowSpeedCycles >= 3, 'Cycle 08 visual review requires normal and 0.25x motion cycles');
  const findings = visual.findings;
  invariant(findings?.whiteEdgeDefects === 0 && findings?.internalGapResidueDefects === 0 && findings?.erasedHighlightDefects === 0 && findings?.blurDefects === 0 && findings?.morphDefects === 0 && findings?.clippingDefects === 0, 'Cycle 08 visual review has unresolved character defects');
  const screenshots = new Set();
  for (const screenshot of visual.screenshots ?? []) {
    invariant(SUBJECTS.includes(screenshot?.subject) && BACKGROUNDS.includes(screenshot?.background) && VIEWPORTS.includes(screenshot?.viewport) && DPRS.includes(screenshot?.dpr), 'Cycle 08 screenshot has invalid matrix metadata');
    const key = `${screenshot.subject}:${screenshot.background}:${screenshot.viewport}:DPR${screenshot.dpr}`;
    invariant(!screenshots.has(key), `Cycle 08 duplicate screenshot matrix entry: ${key}`);
    invariant(screenshot.frameCount === 32 && screenshot.renderer === 'sharp-decoded-webp-all-frame-matrix', `${key}: all-frame renderer coverage is missing`);
    invariant(screenshot.backgroundHex === BACKGROUND_HEX[screenshot.background], `${key}: solid background color is wrong`);
    const [viewportWidth, viewportHeight] = screenshot.viewport.split('x').map(Number);
    const expectedWidth = viewportWidth * screenshot.dpr;
    const expectedHeight = viewportHeight * screenshot.dpr;
    invariant(screenshot.physicalWidth === expectedWidth && screenshot.physicalHeight === expectedHeight, `${key}: declared physical dimensions do not match viewport/DPR`);
    const dimensions = await assertPng(inside(evidenceDir, screenshot.path), screenshot.sha256, key);
    invariant(dimensions.width === expectedWidth && dimensions.height === expectedHeight, `${key}: PNG dimensions do not match viewport/DPR`);
    screenshots.add(key);
  }
  for (const subject of SUBJECTS) for (const background of BACKGROUNDS) for (const viewport of VIEWPORTS) for (const dpr of DPRS) {
    const key = `${subject}:${background}:${viewport}:DPR${dpr}`;
    invariant(screenshots.has(key), `Cycle 08 screenshot matrix is missing ${key}`);
  }
  invariant(JSON.stringify(renderManifest.screenshots) === JSON.stringify(visual.screenshots), 'Cycle 08 reviewed screenshot matrix differs from its immutable render manifest');
  const motionKeys = new Set();
  for (const motion of visual.motionEvidence ?? []) {
    const key = `${motion?.subject}:${motion?.speed}`;
    invariant(SUBJECTS.includes(motion?.subject) && ['normal', 'slow'].includes(motion?.speed) && !motionKeys.has(key), `Cycle 08 invalid or duplicate motion evidence: ${key}`);
    invariant(motion.cycles === MOTION_CYCLES && motion.sourceFrameCount === 32 && motion.pageCount === MOTION_CYCLES * 32, `${key}: continuous motion must contain exactly three complete 32-frame cycles`);
    invariant(motion.frameDelayMs === MOTION_DELAYS[motion.speed] && motion.durationMs === motion.pageCount * motion.frameDelayMs, `${key}: continuous motion timing is invalid`);
    invariant(motion.status === 'PASS' && motion.artifactKey === key && typeof motion.owner === 'string' && motion.owner.length >= 3 && typeof motion.observation === 'string' && motion.observation.length >= 48, `${key}: human motion review is incomplete`);
    const metadata = await assertAnimatedWebp(inside(evidenceDir, motion?.path), motion?.sha256, motion?.bytes, `${key} motion evidence`);
    invariant(metadata.pages === motion.pageCount && metadata.width === motion.width && metadata.pageHeight === motion.height, `${key}: decoded WebP geometry/page count differs from the review`);
    invariant(Array.isArray(metadata.delay) && metadata.delay.length === motion.pageCount && metadata.delay.every((delay) => delay === motion.frameDelayMs), `${key}: decoded WebP frame timing differs from the review`);
    motionKeys.add(key);
  }
  for (const subject of SUBJECTS) for (const speed of ['normal', 'slow']) invariant(motionKeys.has(`${subject}:${speed}`), `Cycle 08 motion evidence is missing ${subject}:${speed}`);
  const reviewedMotionArtifacts = visual.motionEvidence.map((entry) => Object.fromEntries(Object.keys(renderManifest.motionEvidence[0] ?? {}).map((field) => [field, entry[field]])));
  invariant(JSON.stringify(renderManifest.motionEvidence) === JSON.stringify(reviewedMotionArtifacts), 'Cycle 08 reviewed motion artifacts differ from their immutable render manifest');

  const browserKeys = new Set();
  const browserCoverage = new Set();
  for (const capture of visual.browserCaptures ?? []) {
    const key = `${capture?.subject}:${capture?.speed}:${capture?.viewport}:DPR${capture?.dpr}`;
    invariant(SUBJECTS.includes(capture?.subject) && ['normal', 'slow'].includes(capture?.speed) && VIEWPORTS.includes(capture?.viewport) && DPRS.includes(capture?.dpr) && !browserKeys.has(key), `Cycle 08 invalid or duplicate browser capture: ${key}`);
    invariant(capture.buildId === summary.buildId && capture.sourceFingerprint === summary.sourceFingerprint, `${key}: browser capture identity is stale`);
    invariant(typeof capture.browser?.name === 'string' && capture.browser.name.length > 0 && typeof capture.browser?.version === 'string' && capture.browser.version.length > 0, `${key}: browser identity is incomplete`);
    instant(capture.capturedAt, `${key} browser capture`);
    invariant((capture.consoleErrors === 0 || (Array.isArray(capture.consoleErrors) && capture.consoleErrors.length === 0)) && (capture.consoleWarnings === 0 || (Array.isArray(capture.consoleWarnings) && capture.consoleWarnings.length === 0)), `${key}: browser console is not clean`);
    invariant((typeof capture.state === 'string' && capture.state.length > 0) || (capture.state && typeof capture.state === 'object'), `${key}: browser animation state is missing`);
    const [viewportWidth, viewportHeight] = capture.viewport.split('x').map(Number);
    const dimensions = await assertPng(inside(evidenceDir, capture.path), capture.sha256, `${key} browser capture`);
    invariant(dimensions.width === viewportWidth * capture.dpr && dimensions.height === viewportHeight * capture.dpr, `${key}: browser PNG dimensions do not match viewport/DPR`);
    const reviewedAt = instant(visual.reviewedAt, 'Cycle 08 visual review');
    invariant(instant(capture.capturedAt, `${key} browser capture`) <= reviewedAt, `${key}: browser capture was created after visual signoff`);
    browserKeys.add(key);
    browserCoverage.add(`${capture.subject}:${capture.speed}:${capture.viewport}`);
  }
  for (const subject of SUBJECTS) for (const speed of ['normal', 'slow']) for (const viewport of VIEWPORTS) {
    invariant(browserCoverage.has(`${subject}:${speed}:${viewport}`), `Cycle 08 production-browser matrix is missing ${subject}:${speed}:${viewport}`);
  }
  invariant(browserCoverage.size === 16 && browserKeys.size >= 16, 'Cycle 08 production-browser evidence must cover both subjects, both speeds, and all four viewports');

  const issuesPass = await loadPass('issues');
  invariant(Array.isArray(issuesPass.issues), 'Cycle 08 issue ledger is incomplete');
  const issues = new Map(issuesPass.issues.map((entry) => [entry?.id, entry]));
  invariant(issues.size === issuesPass.issues.length && REQUIRED_ISSUES.every((id) => issues.has(id)), 'Cycle 08 required issue chain is missing');
  let latestNeighboringRegression = -Infinity;
  for (const [id, issue] of issues) {
    invariant(typeof id === 'string' && ['Critical', 'High', 'Medium'].includes(issue?.severity) && issue?.status === 'VERIFIED', `${id}: invalid issue severity/status`);
    invariant(issue.report?.owner === owners.targetedQa && issue.report?.buildId === BASELINE_BUILD_ID && issue.report.buildId !== summary.buildId, `${id}: original report build/owner is invalid`);
    invariant(issue.report?.environment?.browser && issue.report?.environment?.version && issue.report?.environment?.os && VIEWPORTS.includes(issue.report?.environment?.viewport) && DPRS.includes(issue.report?.environment?.dpr), `${id}: issue environment is incomplete`);
    invariant(Array.isArray(issue.report?.acceptanceIds) && issue.report.acceptanceIds.length > 0, `${id}: acceptance links are missing`);
    const observedAt = instant(issue.report?.observedAt, `${id} report`);
    invariant(typeof issue.report?.steps === 'string' && issue.report.steps.length >= 32 && typeof issue.report?.expected === 'string' && issue.report.expected.length >= 32 && typeof issue.report?.actual === 'string' && issue.report.actual.length >= 32, `${id}: reproduction contract is incomplete`);
    invariant(Array.isArray(issue.report?.evidence) && issue.report.evidence.length > 0, `${id}: original evidence is missing`);
    for (const entry of issue.report.evidence) await assertPng(inside(evidenceDir, entry.path), entry.sha256, `${id} original evidence`);
    invariant(issue.fix?.owner === owners.implementation && issue.fix?.buildId === summary.buildId && COMMIT_SHA.test(String(issue.fix?.commitSha ?? '')) && summary.buildId.endsWith(issue.fix.commitSha.slice(0, 12)), `${id}: developer fix link is invalid`);
    const fixedAt = instant(issue.fix?.completedAt, `${id} fix`);
    invariant(typeof issue.fix?.summary === 'string' && issue.fix.summary.length >= 32, `${id}: developer fix summary is missing`);
    invariant(issue.independentRetest?.owner === owners.retestQa && issue.independentRetest?.status === 'PASS' && Array.isArray(issue.independentRetest?.evidence) && issue.independentRetest.evidence.length > 0, `${id}: independent retest link is missing`);
    const retestedAt = instant(issue.independentRetest?.completedAt, `${id} independent retest`);
    invariant(issue.independentRetest?.fixDisclosedBeforeObservation === false && typeof issue.independentRetest?.firstObservation === 'string' && issue.independentRetest.firstObservation.length >= 48, `${id}: independent retest was not blind or lacks a substantive observation`);
    for (const entry of issue.independentRetest.evidence) await assertPng(inside(evidenceDir, entry.path), entry.sha256, `${id} independent retest evidence`);
    invariant(issue.neighboringRegression?.owner === owners.retestQa && issue.neighboringRegression?.status === 'PASS' && issue.neighboringRegression?.scenarios?.length >= 2, `${id}: neighboring regression link is missing`);
    const regressedAt = instant(issue.neighboringRegression?.completedAt, `${id} neighboring regression`);
    invariant(observedAt < fixedAt && fixedAt < retestedAt && retestedAt < regressedAt, `${id}: issue→fix→independent retest→regression order failed`);
    latestNeighboringRegression = Math.max(latestNeighboringRegression, regressedAt);
  }

  const independent = await loadPass('independent');
  invariant(independent.owner === owners.independentQa && independent.independence === true && independent.blind === true && independent.fixDisclosedBeforeFirstObservations === false && independent.decision === 'PASS', 'Cycle 08 independent review is invalid');
  invariant(independent.findingsCritical === 0 && independent.findingsHigh === 0, 'Cycle 08 independent review has Critical/High findings');
  const observations = new Map((independent.observations ?? []).map((entry) => [entry?.issueId, entry]));
  invariant(REQUIRED_ISSUES.every((id) => observations.has(id)), 'Cycle 08 independent observations do not cover every required issue');
  const observationTexts = new Set();
  for (const id of REQUIRED_ISSUES) {
    const observation = observations.get(id);
    const observedAt = instant(observation?.observedAt, `${id} independent observation`);
    invariant(observedAt > latestNeighboringRegression, `${id}: independent observation predates targeted retest/neighboring regression completion`);
    invariant(typeof observation?.text === 'string' && observation.text.length >= 48, `${id}: independent observation is not substantive`);
    invariant(!observationTexts.has(observation.text), `${id}: independent observation text is duplicated`);
    observationTexts.add(observation.text);
    invariant(Array.isArray(observation?.evidence) && observation.evidence.length > 0, `${id}: independent observation evidence link is missing`);
    for (const entry of observation.evidence) await assertPng(inside(evidenceDir, entry.path), entry.sha256, `${id} independent observation`);
    invariant(observedAt <= instant(independent.completedAt, 'Cycle 08 independent review'), `${id}: observation is later than review completion`);
  }
  const verdict = independent.verdict;
  invariant(verdict?.whiteEdgeDefects === 0 && verdict?.internalGapResidueDefects === 0 && verdict?.erasedHighlightDefects === 0 && verdict?.demonessBlurDefects === 0 && verdict?.demonessHeightDominanceConfirmed === true && verdict?.socketParityConfirmed === true, 'Cycle 08 independent visual verdict failed');
  const independentCompletedAt = instant(independent.completedAt, 'Cycle 08 independent review');
  invariant(latestNeighboringRegression < independentCompletedAt, 'Cycle 08 independent review must follow issue retests and neighboring regression');

  const regression = await loadPass('regression');
  invariant(regression.owner === owners.regressionQa && regression.openCritical === 0 && regression.openHigh === 0, 'Cycle 08 regression pass is incomplete');
  invariant(REQUIRED_REGRESSIONS.every((id) => regression.scenarios?.includes(id)), 'Cycle 08 regression matrix is incomplete');
  invariant(regression.frozenFingerprints?.baselineBuildId === BASELINE_BUILD_ID, 'Cycle 08 frozen fingerprint baseline is wrong');
  invariant(regression.frozenFingerprints?.baselineCommit === 'a17cdd65fd5af4ec236fd777aa5dd4723664a897' && regression.frozenFingerprints?.candidateCommit === distManifest.commitSha, 'Cycle 08 frozen fingerprint commit identity is wrong');
  await assertArtifact(inside(evidenceDir, regression.fingerprintAudit?.path), regression.fingerprintAudit?.sha256, regression.fingerprintAudit?.bytes, 'Cycle 08 frozen fingerprint audit');
  const fingerprintArtifact = await readJson(inside(evidenceDir, regression.fingerprintAudit.path));
  invariant(fingerprintArtifact.schemaVersion === 1 && fingerprintArtifact.cycle === '08' && fingerprintArtifact.status === 'PASS' && fingerprintArtifact.baselineBuildId === BASELINE_BUILD_ID && fingerprintArtifact.baselineCommit === regression.frozenFingerprints.baselineCommit && fingerprintArtifact.candidateBuildId === summary.buildId && fingerprintArtifact.candidateCommit === distManifest.commitSha && fingerprintArtifact.commitSha === distManifest.commitSha && fingerprintArtifact.sourceFingerprint === summary.sourceFingerprint, 'Cycle 08 frozen fingerprint artifact identity is stale');
  const auditedFingerprints = options.verifyRuntimeAssets === false
    ? fingerprintArtifact
    : await auditCycle08Fingerprints({ candidateCommit: distManifest.commitSha });
  for (const name of ['gameplay', 'shell', 'audio', 'audioRegistry', 'platform', 'flame', 'environment', 'host', 'steamRenderer']) {
    const group = regression.frozenFingerprints?.groups?.[name];
    invariant(group?.status === 'PASS' && SHA256.test(String(group?.baselineSha256 ?? '')) && group.baselineSha256 === group.candidateSha256, `Cycle 08 frozen fingerprint changed: ${name}`);
    const artifactGroup = fingerprintArtifact.groups?.[name];
    invariant(artifactGroup?.status === 'PASS' && artifactGroup.baselineSha256 === group.baselineSha256 && artifactGroup.candidateSha256 === group.candidateSha256, `Cycle 08 frozen fingerprint artifact differs from regression: ${name}`);
    const actual = auditedFingerprints.groups?.[name];
    invariant(actual?.status === 'PASS' && actual.baselineSha256 === group.baselineSha256 && actual.candidateSha256 === group.candidateSha256, `Cycle 08 frozen fingerprint evidence is not reproducible: ${name}`);
  }
  invariant(independentCompletedAt < instant(regression.completedAt, 'Cycle 08 full regression'), 'Cycle 08 full regression must follow independent review');

  const acceptance = await loadPass('acceptance');
  invariant(acceptance.decision === 'PASS' && acceptance.openCritical === 0 && acceptance.openHigh === 0, 'Cycle 08 acceptance decision is incomplete');
  invariant(typeof acceptance.owner === 'string' && acceptance.owner.length >= 3 && instant(acceptance.completedAt, 'Cycle 08 acceptance') > instant(regression.completedAt, 'Cycle 08 full regression'), 'Cycle 08 acceptance owner/time must follow regression');
  const acceptanceEntries = acceptance.criteria ?? [];
  const acceptanceCriteria = new Map(acceptanceEntries.map((entry) => [entry?.id, entry]));
  invariant(acceptanceCriteria.size === acceptanceEntries.length && REQUIRED_ACCEPTANCE.every((id) => acceptanceCriteria.get(id)?.status === 'PASS'), 'Cycle 08 acceptance criteria are not all PASS');
  for (const id of REQUIRED_ACCEPTANCE) {
    const criterion = acceptanceCriteria.get(id);
    invariant(Array.isArray(criterion.evidence) && criterion.evidence.length > 0, `Cycle 08 acceptance ${id} has no exact evidence links`);
    for (const evidence of criterion.evidence) await assertArtifact(inside(evidenceDir, evidence?.path), evidence?.sha256, evidence?.bytes, `Cycle 08 acceptance ${id}`);
  }

  return Object.freeze({
    schemaVersion: 1,
    cycle: '08',
    buildId: summary.buildId,
    evidence: relative(gameRoot, evidenceDir).split(sep).join('/'),
    auditedAtlases: EXPECTED_ATLASES.length,
    visualScreenshots: screenshots.size,
    verifiedIssues: REQUIRED_ISSUES.length,
    status: 'PASS',
  });
}

async function main() {
  const evidenceDir = process.argv[2];
  invariant(evidenceDir, 'Usage: node scripts/validate-corrective-cycle-08-evidence.mjs <evidence-dir>');
  const report = await validateCorrectiveCycle08Evidence({ evidenceDir });
  console.log(`corrective cycle 08 evidence PASS (${report.buildId}, ${report.auditedAtlases} atlases, ${report.visualScreenshots} screenshots, ${report.verifiedIssues} verified issues)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
