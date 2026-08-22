// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateCorrectiveCycle07Evidence } from '../../scripts/validate-corrective-cycle-07-evidence.mjs';

const buildId = '0.1.0+123456789abc';
const commitSha = `123456789abc${'d'.repeat(28)}`;
const sourceFingerprint = 'f'.repeat(64);
const viewports = ['390x844', '768x1024', '1366x768', '800x360'];
const issueIds = [
  'C07-01-servant-scale',
  'C07-02-servant-steam-origin',
  'C07-03-demoness-sharpness',
  'C07-04-demoness-steam-origin',
];
const png = (label) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(label)]);
const sha = (value) => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), 'inferno-c07-evidence-'));
  const evidenceDir = join(parent, buildId);
  await mkdir(evidenceDir, { recursive: true });
  const distManifest = { buildId, commitSha, sourceFingerprint, clean: true };
  const distBytes = Buffer.from(`${JSON.stringify(distManifest)}\n`);
  const distManifestPath = join(parent, 'build-manifest.json');
  await writeFile(distManifestPath, distBytes);
  const inventory = [];

  /** @param {string} path @param {unknown} value */
  async function putJson(path, value) {
    const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    await mkdir(join(evidenceDir, path, '..'), { recursive: true });
    await writeFile(join(evidenceDir, path), bytes);
    inventory.push({ path, bytes: bytes.length, sha256: sha(bytes) });
  }
  /** @param {string} path @param {string} label */
  async function putPng(path, label) {
    const bytes = png(label);
    await mkdir(join(evidenceDir, path, '..'), { recursive: true });
    await writeFile(join(evidenceDir, path), bytes);
    inventory.push({ path, bytes: bytes.length, sha256: sha(bytes) });
    return { path, sha256: sha(bytes) };
  }
  /** @param {string} path @param {string} label */
  async function putClip(path, label) {
    const bytes = Buffer.from(`webm-fixture:${label}`);
    await mkdir(join(evidenceDir, path, '..'), { recursive: true });
    await writeFile(join(evidenceDir, path), bytes);
    const entry = { path, bytes: bytes.length, sha256: sha(bytes) };
    inventory.push(entry);
    return entry;
  }

  const scenarios = [];
  let scenarioIndex = 0;
  for (const subject of ['ash-servant', 'demoness']) {
    for (const speed of ['normal', 'slow']) {
      for (const viewport of viewports) {
        const id = `${subject}-${speed}-${viewport}-${scenarioIndex}`;
        const clip = await putClip(`motion/${id}/capture.webm`, id);
        const frames = [];
        for (let frameIndex = 0; frameIndex < 12; frameIndex += 1) {
          const file = await putPng(`motion/${id}/frame-${String(frameIndex).padStart(2, '0')}.png`, `${id}-${frameIndex}`);
          frames.push({ ...file, captureMs: frameIndex * 1_000, phase: frameIndex < 2 ? 'prepare' : frameIndex < 9 ? 'steam' : 'recovery' });
        }
        const common = { emissionKind: 'steam', pauseFrozen: true, cleanupCount: 0, reducedMotionSemanticParity: true };
        const metrics = subject === 'ash-servant'
          ? { ...common, origin: 'mouth', snowflakeEvents: 0, maxSourceDistanceLogicalPx: 8, maxScaleDriftPercent: 2, rootDriftLogicalPx: 2 }
          : { ...common, origins: ['left-hand', 'right-hand'], iceShardEvents: 0, maxSourceDistanceLogicalPx: { leftHand: 12, rightHand: 12 }, blurDefects: 0, morphDefects: 0, maxDprAdjustedUpscale: 1.25 };
        scenarios.push({ id, subject, speed, viewport, dpr: scenarioIndex % 2 ? 2 : 1, browser: { name: 'Chromium', version: 'fixture' }, captureFps: 30, durationMs: 12_000, completeCycles: 3, clip, frames, metrics });
        scenarioIndex += 1;
      }
    }
  }
  await putJson('motion.json', { buildId, sourceFingerprint, status: 'PASS', scenarios });

  const screenshots = [];
  for (let index = 0; index < 8; index += 1) screenshots.push(await putPng(`screens/${index}.png`, `screen-${index}`));
  await putJson('visual.json', {
    buildId, sourceFingerprint, status: 'PASS', screenshots, viewports, legacySemanticsDetected: false,
    servant: { effect: 'steam', origin: 'mouth', snowflakeEvents: 0, maxScaleDriftPercent: 2 },
    demoness: { effect: 'steam', origins: ['left-hand', 'right-hand'], iceShardEvents: 0, blurDefects: 0, morphDefects: 0, maxDprAdjustedUpscale: 1.25 },
  });

  const owners = { implementation: 'developer-c07', targetedQa: 'qa-triage-c07', retestQa: 'qa-retest-c07', independentQa: 'qa-blind-c07', regressionQa: 'qa-regression-c07' };
  const issueRecords = [];
  for (let index = 0; index < issueIds.length; index += 1) {
    const id = issueIds[index];
    const before = await putPng(`issues/${id}-before.png`, `${id}-before`);
    const beforeClip = await putClip(`issues/${id}-before.webm`, `${id}-before`);
    const matchingScenario = scenarios.find((scenario) => index < 2 ? scenario.subject === 'ash-servant' : scenario.subject === 'demoness');
    const linkedFrame = matchingScenario.frames[4];
    issueRecords.push({
      id, severity: 'High', status: 'VERIFIED',
      report: {
        owner: owners.targetedQa,
        buildId: '0.1.0+aaaaaaaaaaaa',
        environment: { browser: 'Chromium', version: 'fixture', os: 'Windows 11', viewport: viewports[index], dpr: index % 2 ? 2 : 1 },
        acceptanceIds: [`C07:${id}`],
        observedAt: `2026-08-22T10:0${index}:00.000Z`,
        steps: 'Trigger the complete character presentation sequence three times at normal speed and inspect the effect origin.',
        expected: 'The authored character remains stable and the steam begins at the required anatomical socket without legacy particles.',
        actual: 'The original capture visibly violates the required scale, origin, or sharpness contract during the active presentation.',
        motionEvidence: beforeClip,
        evidence: [{ ...before, timestamp: `2026-08-22T10:0${index}:10.000Z` }],
      },
      fix: { owner: owners.implementation, buildId, completedAt: `2026-08-22T11:0${index}:00.000Z`, commitSha, summary: 'Rebuilt the affected authored presentation path and replaced its legacy emitter and transform behavior with the approved contract.' },
      independentRetest: { owner: owners.retestQa, completedAt: `2026-08-22T12:0${index}:00.000Z`, status: 'PASS', firstObservation: 'The complete replay now follows the required anatomical origin and visual stability contract without reproducing the reported defect.', fixDisclosedBeforeObservation: false, frameLinks: [{ path: linkedFrame.path, scenarioId: matchingScenario.id, captureMs: linkedFrame.captureMs }] },
      neighboringRegression: { owner: owners.retestQa, completedAt: `2026-08-22T13:0${index}:00.000Z`, status: 'PASS', scenarios: ['pause-freeze', 'reduced-motion-semantic-parity'] },
    });
  }
  await putJson('issues.json', { buildId, sourceFingerprint, status: 'PASS', issues: issueRecords });

  const observationText = [
    'The servant keeps the same body scale throughout the complete exhale sequence and returns without a visible size jump.',
    'A continuous steam plume begins at the servant mouth in every linked frame and no particle appears near either horn.',
    'The demoness face, crown, hands, and costume edges stay sharply resolved through cast, hold, and recovery poses.',
    'Two steam streams begin at the visible demoness palms and travel toward the flame without solid projectiles or icicles.',
  ];
  const firstObservations = issueIds.map((issueId, index) => {
    const matchingScenario = scenarios.find((scenario) => index < 2 ? scenario.subject === 'ash-servant' : scenario.subject === 'demoness');
    const linkedFrame = matchingScenario.frames[6];
    return { issueId, observedAt: `2026-08-22T14:1${index}:00.000Z`, text: observationText[index], frameLinks: [{ path: linkedFrame.path, scenarioId: matchingScenario.id, captureMs: linkedFrame.captureMs }] };
  });
  await putJson('independent.json', {
    buildId, sourceFingerprint, status: 'PASS', independence: true, decision: 'PASS', reviewerId: owners.independentQa,
    blind: true, hudHidden: true, debugLabelsHidden: true, fixDisclosedBeforeFirstObservations: false, completedAt: '2026-08-22T14:30:00.000Z', findingsCritical: 0, findingsHigh: 0,
    firstObservations,
    semanticVerdict: {
      servantEffect: 'steam', servantOrigin: 'mouth', servantSnowflakeObservations: 0, servantScaleShrinkObservations: 0,
      demonessEffect: 'steam', demonessOrigins: ['left-hand', 'right-hand'], demonessIceShardObservations: 0,
      demonessBlurDefects: 0, demonessMorphDefects: 0, ambiguousCauseTargetCount: 0,
    },
  });
  await putJson('regression.json', { buildId, sourceFingerprint, status: 'PASS', owner: owners.regressionQa, completedAt: '2026-08-22T15:00:00.000Z', openCritical: 0, openHigh: 0, scenarios: ['pause-freeze', 'cancel-cleanup', 'reduced-motion-semantic-parity', 'flame-response-timing', 'gameplay-timing-parity'] });
  await putJson('automation.json', { buildId, sourceFingerprint, status: 'PASS', testsPassed: 200, testsFailed: 0, commands: [{ name: 'npm test', status: 'PASS' }] });
  const summary = {
    schemaVersion: 1, cycle: '07', status: 'PASS', buildId, sourceFingerprint,
    buildManifestSha256: sha(distBytes), defects: { critical: 0, high: 0 }, passOwners: owners,
    passes: { automation: 'automation.json', motion: 'motion.json', visual: 'visual.json', issues: 'issues.json', independent: 'independent.json', regression: 'regression.json' },
    files: inventory,
  };
  await writeFile(join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return { evidenceDir, distManifestPath };
}

async function editJson(root, path, mutate) {
  const absolute = join(root, path);
  const value = JSON.parse(await readFile(absolute, 'utf8'));
  mutate(value);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await writeFile(absolute, bytes);
  if (path !== 'summary.json') {
    const summaryPath = join(root, 'summary.json');
    const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
    const entry = summary.files.find((candidate) => candidate.path === path);
    entry.bytes = bytes.length;
    entry.sha256 = sha(bytes);
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
}

test('Cycle 07 validator accepts exact-build motion, blind review, and complete issue chains', async () => {
  const value = await fixture();
  const report = await validateCorrectiveCycle07Evidence(value);
  assert.equal(report.status, 'PASS');
  assert.equal(report.motionScenarios, 16);
  assert.equal(report.verifiedIssues, 4);
});

test('Cycle 07 validator rejects missing pass evidence', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'summary.json', (summary) => { delete summary.passes.visual; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /visual pass is missing/);
});

test('Cycle 07 validator rejects stale pass identity', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'automation.json', (automation) => { automation.buildId = '0.1.0+stale0000000'; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /automation identity is stale/);
});

test('Cycle 07 validator rejects corrupt inventoried evidence', async () => {
  const value = await fixture();
  await writeFile(join(value.evidenceDir, 'screens/0.png'), 'tampered');
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /artifact hash\/size mismatch/);
});

test('Cycle 07 validator rejects still-only evidence', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'motion.json', (motion) => { motion.scenarios = []; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /motion evidence; still-only evidence is forbidden/);
});

test('Cycle 07 validator rejects missing blind first observations', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'independent.json', (review) => { delete review.firstObservations; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /blind first observations are missing/);
});

test('Cycle 07 validator rejects blind observations without timestamped frame links', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'independent.json', (review) => { review.firstObservations[0].frameLinks = []; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /timestamp\/frame links are missing/);
});

test('Cycle 07 validator rejects fix disclosure before blind observations', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'independent.json', (review) => { review.fixDisclosedBeforeFirstObservations = true; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /fix details were disclosed/);
});

test('Cycle 07 validator rejects old snow semantics', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'motion.json', (motion) => { motion.scenarios[0].metrics.emissionKind = 'snowflakes'; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /old snow\/ice semantics are forbidden/);
});

test('Cycle 07 validator rejects old ice semantics', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'motion.json', (motion) => { motion.scenarios.find((scenario) => scenario.subject === 'demoness').metrics.emissionKind = 'ice-shards'; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /old snow\/ice semantics are forbidden/);
});

test('Cycle 07 validator rejects identical pass owners', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'summary.json', (summary) => { summary.passOwners.independentQa = summary.passOwners.implementation; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /passes must have different owners/);
});

test('Cycle 07 validator rejects missing issue-to-fix-to-independent-retest link', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'issues.json', (issues) => { delete issues.issues[0].independentRetest; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /independent retest.*missing|missing or owned by the implementer/);
});

test('Cycle 07 validator rejects an issue chain without a developer fix', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'issues.json', (issues) => { delete issues.issues[0].fix; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /fix: missing or invalid timestamp|fix owner\/commit\/build is invalid/);
});

test('Cycle 07 validator rejects missing neighboring regression link', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'issues.json', (issues) => { delete issues.issues[0].neighboringRegression; });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /neighboring regression is missing/);
});

test('Cycle 07 validator rejects an incomplete additional issue chain', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'issues.json', (issues) => {
    const extra = structuredClone(issues.issues[0]);
    extra.id = 'C07-05-extra-renderer-defect';
    delete extra.independentRetest;
    issues.issues.push(extra);
  });
  await assert.rejects(() => validateCorrectiveCycle07Evidence(value), /independent retest is missing/);
});
