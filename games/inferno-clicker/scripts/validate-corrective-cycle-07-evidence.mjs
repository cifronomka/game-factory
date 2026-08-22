// @ts-check

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameRoot } from './lib.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const BUILD_ID = /^0\.1\.0\+[a-f0-9]{12}$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const REQUIRED_VIEWPORTS = Object.freeze(['390x844', '768x1024', '1366x768', '800x360']);
const REQUIRED_ISSUES = Object.freeze([
  'C07-01-servant-scale',
  'C07-02-servant-steam-origin',
  'C07-03-demoness-sharpness',
  'C07-04-demoness-steam-origin',
]);
const REQUIRED_REGRESSIONS = Object.freeze([
  'pause-freeze',
  'cancel-cleanup',
  'reduced-motion-semantic-parity',
  'flame-response-timing',
  'gameplay-timing-parity',
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
/** @param {unknown} value @param {string} label @param {number} minimum */
function substantive(value, label, minimum = 32) {
  invariant(typeof value === 'string' && value.trim().length >= minimum && new Set(value.trim().toLowerCase().split(/\s+/)).size >= 6, `${label}: observation is not substantive`);
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
/** @param {string} path @param {string} expectedSha @param {string} label */
async function assertPng(path, expectedSha, label) {
  invariant(SHA256.test(String(expectedSha ?? '')), `${label}: invalid SHA-256`);
  const bytes = await readFile(path);
  invariant(bytes.length > PNG_MAGIC.length && bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC), `${label}: invalid PNG evidence`);
  invariant(digest(bytes) === expectedSha, `${label}: PNG hash mismatch`);
}
/** @param {string} path @param {string} expectedSha @param {number} expectedBytes @param {string} label */
async function assertArtifact(path, expectedSha, expectedBytes, label) {
  invariant(SHA256.test(String(expectedSha ?? '')) && Number.isInteger(expectedBytes) && expectedBytes > 0, `${label}: invalid artifact inventory`);
  const bytes = await readFile(path);
  invariant(bytes.length === expectedBytes && digest(bytes) === expectedSha, `${label}: artifact hash/size mismatch`);
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

/**
 * Cycle 07 is intentionally a separate immutable contract. Cycle 05/06 reports
 * retain their historical validators and cannot be relabelled to satisfy C07.
 * @param {{evidenceDir:string,distManifestPath?:string}} options
 */
export async function validateCorrectiveCycle07Evidence(options) {
  const evidenceDir = resolve(options.evidenceDir);
  invariant((await stat(evidenceDir)).isDirectory(), 'Cycle 07 evidence directory is missing');
  const distManifestPath = resolve(options.distManifestPath ?? join(gameRoot, 'dist/build-manifest.json'));
  const distManifestBytes = await readFile(distManifestPath);
  const distManifest = JSON.parse(distManifestBytes.toString('utf8'));
  const summary = await readJson(join(evidenceDir, 'summary.json'));

  invariant(summary.schemaVersion === 1 && summary.cycle === '07', 'Invalid Cycle 07 summary');
  invariant(summary.status === 'PASS', 'Cycle 07 summary is not PASS');
  invariant(distManifest.clean === true && COMMIT_SHA.test(String(distManifest.commitSha ?? '')) && BUILD_ID.test(String(distManifest.buildId ?? '')) && SHA256.test(String(distManifest.sourceFingerprint ?? '')), 'Cycle 07 requires a clean exact dist build');
  invariant(summary.buildId === distManifest.buildId && basename(evidenceDir) === summary.buildId, 'Cycle 07 evidence must belong to the exact Build ID directory');
  invariant(summary.sourceFingerprint === distManifest.sourceFingerprint, 'Cycle 07 source fingerprint does not match dist build');
  invariant(summary.buildManifestSha256 === digest(distManifestBytes), 'Cycle 07 build-manifest hash mismatch');
  invariant(summary.defects?.critical === 0 && summary.defects?.high === 0, 'Cycle 07 has open Critical/High defects');
  invariant(Array.isArray(summary.files) && summary.files.length > 0, 'Cycle 07 evidence inventory is missing');
  const inventory = new Map();
  for (const entry of summary.files) {
    invariant(typeof entry.path === 'string' && !inventory.has(entry.path), `Cycle 07 duplicate/invalid inventory path: ${entry.path}`);
    await assertArtifact(inside(evidenceDir, entry.path), entry.sha256, entry.bytes, entry.path);
    inventory.set(entry.path, entry);
  }
  const actualFiles = (await walk(evidenceDir))
    .map((path) => path.slice(evidenceDir.length + 1).split(sep).join('/'))
    .filter((path) => path !== 'summary.json');
  invariant(actualFiles.length === inventory.size && actualFiles.every((path) => inventory.has(path)), 'Cycle 07 evidence contains unlisted or missing files');

  const owners = summary.passOwners;
  const ownerValues = [owners?.implementation, owners?.targetedQa, owners?.retestQa, owners?.independentQa, owners?.regressionQa];
  invariant(ownerValues.every((value) => typeof value === 'string' && value.length >= 3), 'Cycle 07 pass owners are incomplete');
  invariant(new Set(ownerValues).size === ownerValues.length, 'Cycle 07 passes must have different owners');

  const requiredPasses = ['automation', 'motion', 'visual', 'issues', 'independent', 'regression'];
  for (const name of requiredPasses) invariant(typeof summary.passes?.[name] === 'string', `Cycle 07 ${name} pass is missing`);

  const automation = await readJson(inside(evidenceDir, summary.passes.automation));
  invariant(automation.buildId === summary.buildId && automation.sourceFingerprint === summary.sourceFingerprint, 'Cycle 07 automation identity is stale');
  invariant(automation.status === 'PASS' && Number.isInteger(automation.testsPassed) && automation.testsPassed > 0 && automation.testsFailed === 0, 'Cycle 07 automation pass is incomplete');
  invariant(Array.isArray(automation.commands) && automation.commands.length > 0 && automation.commands.every((entry) => entry?.status === 'PASS' && typeof entry.name === 'string'), 'Cycle 07 required commands did not all pass');

  const motion = await readJson(inside(evidenceDir, summary.passes.motion));
  invariant(motion.buildId === summary.buildId && motion.sourceFingerprint === summary.sourceFingerprint, 'Cycle 07 motion identity is stale');
  invariant(motion.status === 'PASS' && Array.isArray(motion.scenarios) && motion.scenarios.length >= 16, 'Cycle 07 requires motion evidence; still-only evidence is forbidden');
  const frameIndex = new Map();
  const scenarioIds = new Set();
  const viewports = new Set();
  const subjectSpeedViewports = new Set();
  for (const scenario of motion.scenarios) {
    invariant(typeof scenario.id === 'string' && !scenarioIds.has(scenario.id), 'Cycle 07 motion scenario ids must be unique');
    scenarioIds.add(scenario.id);
    invariant(['ash-servant', 'demoness'].includes(scenario.subject) && ['normal', 'slow'].includes(scenario.speed), `${scenario.id}: invalid subject/speed`);
    subjectSpeedViewports.add(`${scenario.subject}:${scenario.speed}:${scenario.viewport}`);
    invariant(REQUIRED_VIEWPORTS.includes(scenario.viewport), `${scenario.id}: required viewport is missing`);
    viewports.add(scenario.viewport);
    invariant(Number.isFinite(scenario.dpr) && scenario.dpr > 0 && scenario.browser?.name && scenario.browser?.version, `${scenario.id}: browser/DPR metadata is missing`);
    invariant(Number.isInteger(scenario.completeCycles) && scenario.completeCycles >= 3, `${scenario.id}: requires at least three complete cycles`);
    invariant(Number.isFinite(scenario.captureFps) && scenario.captureFps >= 30 && Number.isFinite(scenario.durationMs) && scenario.durationMs >= 3_000, `${scenario.id}: continuous browser capture must be at least 30 FPS`);
    await assertArtifact(inside(evidenceDir, scenario.clip?.path), scenario.clip?.sha256, scenario.clip?.bytes, `${scenario.id} continuous clip`);
    invariant(Array.isArray(scenario.frames) && scenario.frames.length >= 12, `${scenario.id}: requires at least 12 timestamped motion frames`);
    let priorCaptureMs = -Infinity;
    for (const frame of scenario.frames) {
      invariant(Number.isFinite(frame.captureMs) && frame.captureMs > priorCaptureMs, `${scenario.id}: frame timestamps must increase`);
      priorCaptureMs = frame.captureMs;
      invariant(typeof frame.phase === 'string' && frame.phase.length >= 3, `${scenario.id}: frame phase is missing`);
      invariant(typeof frame.path === 'string' && !frameIndex.has(frame.path), `${scenario.id}: duplicate or invalid frame path`);
      await assertPng(inside(evidenceDir, frame.path), frame.sha256, `${scenario.id}/${frame.captureMs}`);
      frameIndex.set(frame.path, { scenarioId: scenario.id, captureMs: frame.captureMs });
    }
    invariant(priorCaptureMs <= scenario.durationMs, `${scenario.id}: sampled frame lies outside the continuous clip`);
    const metrics = scenario.metrics;
    invariant(metrics?.emissionKind === 'steam', `${scenario.id}: old snow/ice semantics are forbidden; emission must be steam`);
    invariant(metrics.pauseFrozen === true && metrics.cleanupCount === 0 && metrics.reducedMotionSemanticParity === true, `${scenario.id}: pause/cleanup/reduced-motion steam lifecycle failed`);
    if (scenario.subject === 'ash-servant') {
      invariant(metrics.origin === 'mouth' && metrics.snowflakeEvents === 0, `${scenario.id}: Servant must emit steam from the mouth with no snowflakes`);
      invariant(metrics.maxSourceDistanceLogicalPx <= 8, `${scenario.id}: Servant steam origin is farther than 8 logical px from the mouth`);
      invariant(metrics.maxScaleDriftPercent <= 2 && metrics.rootDriftLogicalPx <= 2, `${scenario.id}: Servant scale/root stability failed`);
    } else {
      invariant(Array.isArray(metrics.origins) && [...metrics.origins].sort().join(',') === 'left-hand,right-hand' && metrics.iceShardEvents === 0, `${scenario.id}: Demoness must emit steam from both hands with no ice shards`);
      invariant(metrics.maxSourceDistanceLogicalPx?.leftHand <= 12 && metrics.maxSourceDistanceLogicalPx?.rightHand <= 12, `${scenario.id}: Demoness steam origin is farther than 12 logical px from a hand`);
      invariant(metrics.blurDefects === 0 && metrics.morphDefects === 0 && metrics.maxDprAdjustedUpscale <= 1.25, `${scenario.id}: Demoness sharpness/upscale gate failed`);
    }
  }
  for (const viewport of REQUIRED_VIEWPORTS) invariant(viewports.has(viewport), `Cycle 07 motion viewport is missing: ${viewport}`);
  for (const subject of ['ash-servant', 'demoness']) {
    for (const speed of ['normal', 'slow']) {
      for (const viewport of REQUIRED_VIEWPORTS) {
        const combination = `${subject}:${speed}:${viewport}`;
        invariant(subjectSpeedViewports.has(combination), `Cycle 07 motion scenario is missing: ${combination}`);
      }
    }
  }

  const visual = await readJson(inside(evidenceDir, summary.passes.visual));
  invariant(visual.buildId === summary.buildId && visual.sourceFingerprint === summary.sourceFingerprint, 'Cycle 07 visual identity is stale');
  invariant(visual.status === 'PASS' && Array.isArray(visual.screenshots) && visual.screenshots.length >= 8, 'Cycle 07 visual pass is incomplete');
  invariant(visual.legacySemanticsDetected === false, 'Cycle 07 visual pass detected old snow/ice semantics');
  invariant(visual.servant?.effect === 'steam' && visual.servant?.origin === 'mouth' && visual.servant?.snowflakeEvents === 0 && visual.servant?.maxScaleDriftPercent <= 2, 'Cycle 07 Servant visual contract failed');
  invariant(visual.demoness?.effect === 'steam' && [...(visual.demoness?.origins ?? [])].sort().join(',') === 'left-hand,right-hand' && visual.demoness?.iceShardEvents === 0, 'Cycle 07 Demoness steam visual contract failed');
  invariant(visual.demoness?.blurDefects === 0 && visual.demoness?.morphDefects === 0 && visual.demoness?.maxDprAdjustedUpscale <= 1.25, 'Cycle 07 Demoness sharpness visual contract failed');
  invariant(REQUIRED_VIEWPORTS.every((viewport) => visual.viewports?.includes(viewport)), 'Cycle 07 visual viewport matrix is incomplete');
  for (const screenshot of visual.screenshots) await assertPng(inside(evidenceDir, screenshot.path), screenshot.sha256, screenshot.path);

  const issuesPass = await readJson(inside(evidenceDir, summary.passes.issues));
  invariant(issuesPass.buildId === summary.buildId && issuesPass.sourceFingerprint === summary.sourceFingerprint, 'Cycle 07 issue-ledger identity is stale');
  invariant(issuesPass.status === 'PASS' && Array.isArray(issuesPass.issues), 'Cycle 07 issue ledger is incomplete');
  const issues = new Map(issuesPass.issues.map((entry) => [entry.id, entry]));
  invariant(issues.size === issuesPass.issues.length, 'Cycle 07 issue ids must be unique');
  for (const id of REQUIRED_ISSUES) invariant(issues.has(id), `Cycle 07 required issue is missing: ${id}`);
  for (const [id, issue] of issues) {
    invariant(typeof id === 'string' && id.length >= 6, 'Cycle 07 issue id is invalid');
    invariant(['Critical', 'High', 'Medium'].includes(issue.severity) && issue.status === 'VERIFIED', `${id}: invalid severity/status`);
    invariant(issue.report?.owner === owners.targetedQa, `${id}: issue report is not owned by targeted QA`);
    invariant(BUILD_ID.test(String(issue.report?.buildId ?? '')) && issue.report.buildId !== summary.buildId, `${id}: original issue must identify its superseded exact build`);
    invariant(issue.report?.environment?.browser && issue.report?.environment?.version && issue.report?.environment?.os && REQUIRED_VIEWPORTS.includes(issue.report?.environment?.viewport) && Number.isFinite(issue.report?.environment?.dpr), `${id}: issue environment is incomplete`);
    invariant(Array.isArray(issue.report?.acceptanceIds) && issue.report.acceptanceIds.length > 0, `${id}: linked acceptance criteria are missing`);
    const observedAt = instant(issue.report?.observedAt, `${id} report`);
    substantive(issue.report?.steps, `${id} reproduction steps`);
    substantive(issue.report?.expected, `${id} expected result`);
    substantive(issue.report?.actual, `${id} actual result`);
    invariant(Array.isArray(issue.report?.evidence) && issue.report.evidence.length > 0, `${id}: original issue evidence is missing`);
    await assertArtifact(inside(evidenceDir, issue.report?.motionEvidence?.path), issue.report?.motionEvidence?.sha256, issue.report?.motionEvidence?.bytes, `${id} original continuous motion`);
    for (const entry of issue.report.evidence) {
      instant(entry.timestamp, `${id} original evidence`);
      await assertPng(inside(evidenceDir, entry.path), entry.sha256, `${id} original evidence`);
    }
    invariant(issue.fix?.owner === owners.implementation && COMMIT_SHA.test(String(issue.fix?.commitSha ?? '')) && issue.fix?.buildId === summary.buildId && summary.buildId.endsWith(issue.fix.commitSha.slice(0, 12)), `${id}: fix owner/commit/build is invalid`);
    const fixedAt = instant(issue.fix.completedAt, `${id} fix`);
    substantive(issue.fix?.summary, `${id} fix summary`);
    invariant(issue.independentRetest?.owner === owners.retestQa && issue.independentRetest?.status === 'PASS', `${id}: independent retest is missing or owned by the implementer`);
    const retestedAt = instant(issue.independentRetest.completedAt, `${id} independent retest`);
    substantive(issue.independentRetest.firstObservation, `${id} independent retest first observation`, 48);
    invariant(issue.independentRetest.fixDisclosedBeforeObservation === false, `${id}: fix was disclosed before independent retest observation`);
    invariant(Array.isArray(issue.independentRetest.frameLinks) && issue.independentRetest.frameLinks.length > 0, `${id}: independent retest frame links are missing`);
    assertFrameLinks(issue.independentRetest.frameLinks, frameIndex, `${id} independent retest`);
    invariant(issue.neighboringRegression?.owner === owners.retestQa && issue.neighboringRegression?.status === 'PASS' && issue.neighboringRegression?.scenarios?.length >= 2, `${id}: neighboring regression is missing`);
    const regressedAt = instant(issue.neighboringRegression.completedAt, `${id} neighboring regression`);
    invariant(observedAt < fixedAt && fixedAt < retestedAt && retestedAt < regressedAt, `${id}: required issue→fix→independent retest→neighboring regression order failed`);
  }

  const independent = await readJson(inside(evidenceDir, summary.passes.independent));
  invariant(independent.buildId === summary.buildId && independent.sourceFingerprint === summary.sourceFingerprint, 'Cycle 07 independent-review identity is stale');
  invariant(independent.status === 'PASS' && independent.independence === true && independent.decision === 'PASS', 'Cycle 07 independent review did not pass');
  invariant(independent.reviewerId === owners.independentQa && independent.blind === true && independent.hudHidden === true && independent.debugLabelsHidden === true, 'Cycle 07 independent review is not blind or independently owned');
  invariant(independent.fixDisclosedBeforeFirstObservations === false, 'Cycle 07 fix details were disclosed before blind first observations');
  invariant(independent.findingsCritical === 0 && independent.findingsHigh === 0, 'Cycle 07 independent review has Critical/High findings');
  invariant(Array.isArray(independent.firstObservations) && independent.firstObservations.length >= REQUIRED_ISSUES.length, 'Cycle 07 blind first observations are missing');
  const observationIssues = new Set();
  const observationTexts = new Set();
  for (const observation of independent.firstObservations) {
    invariant(REQUIRED_ISSUES.includes(observation.issueId), `Unknown Cycle 07 blind observation issue: ${observation.issueId}`);
    observationIssues.add(observation.issueId);
    instant(observation.observedAt, `${observation.issueId} blind observation`);
    substantive(observation.text, `${observation.issueId} blind first observation`, 48);
    observationTexts.add(observation.text.trim().toLowerCase());
    invariant(Array.isArray(observation.frameLinks) && observation.frameLinks.length > 0, `${observation.issueId}: timestamp/frame links are missing`);
    assertFrameLinks(observation.frameLinks, frameIndex, `${observation.issueId} blind observation`);
  }
  invariant(REQUIRED_ISSUES.every((id) => observationIssues.has(id)) && observationTexts.size === independent.firstObservations.length, 'Cycle 07 blind first observations must be distinct and cover every issue');
  const verdict = independent.semanticVerdict;
  invariant(verdict?.servantEffect === 'steam' && verdict?.servantOrigin === 'mouth' && verdict?.servantSnowflakeObservations === 0 && verdict?.servantScaleShrinkObservations === 0, 'Cycle 07 blind review did not confirm Servant steam/scale semantics');
  invariant(verdict?.demonessEffect === 'steam' && [...(verdict?.demonessOrigins ?? [])].sort().join(',') === 'left-hand,right-hand' && verdict?.demonessIceShardObservations === 0, 'Cycle 07 blind review did not confirm Demoness hand-steam semantics');
  invariant(verdict?.demonessBlurDefects === 0 && verdict?.demonessMorphDefects === 0 && verdict?.ambiguousCauseTargetCount === 0, 'Cycle 07 blind review found visual ambiguity/blur/morph defects');
  const independentCompletedAt = instant(independent.completedAt, 'Cycle 07 independent blind review');
  const latestNeighboringRegression = Math.max(...[...issues].map(([id, issue]) => instant(issue.neighboringRegression.completedAt, `${id} neighboring regression`)));
  invariant(latestNeighboringRegression < independentCompletedAt, 'Cycle 07 independent blind review must follow targeted retest and neighboring regression');

  const regression = await readJson(inside(evidenceDir, summary.passes.regression));
  invariant(regression.buildId === summary.buildId && regression.sourceFingerprint === summary.sourceFingerprint, 'Cycle 07 regression identity is stale');
  invariant(regression.status === 'PASS' && regression.owner === owners.regressionQa && regression.openCritical === 0 && regression.openHigh === 0, 'Cycle 07 regression pass is incomplete');
  invariant(REQUIRED_REGRESSIONS.every((id) => regression.scenarios?.includes(id)), 'Cycle 07 neighboring regression matrix is incomplete');
  invariant(independentCompletedAt < instant(regression.completedAt, 'Cycle 07 full regression'), 'Cycle 07 full regression must follow independent blind review');

  return Object.freeze({
    schemaVersion: 1,
    cycle: '07',
    buildId: summary.buildId,
    evidence: relative(gameRoot, evidenceDir).split(sep).join('/'),
    motionScenarios: motion.scenarios.length,
    blindObservations: independent.firstObservations.length,
    verifiedIssues: REQUIRED_ISSUES.length,
    status: 'PASS',
  });
}

/** @param {unknown[]} links @param {Map<string,{scenarioId:string,captureMs:number}>} frameIndex @param {string} label */
function assertFrameLinks(links, frameIndex, label) {
  for (const link of links) {
    const frame = frameIndex.get(link?.path);
    invariant(frame && link.scenarioId === frame.scenarioId && link.captureMs === frame.captureMs, `${label}: timestamp/frame link does not resolve to captured motion evidence`);
  }
}

async function main() {
  const evidenceDir = process.argv[2];
  invariant(evidenceDir, 'Usage: node scripts/validate-corrective-cycle-07-evidence.mjs <evidence-dir>');
  const report = await validateCorrectiveCycle07Evidence({ evidenceDir });
  console.log(`corrective cycle 07 evidence PASS (${report.buildId}, ${report.motionScenarios} motion scenarios, ${report.verifiedIssues} verified issues)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
