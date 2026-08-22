// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { validateCorrectiveCycle08Evidence } from '../../scripts/validate-corrective-cycle-08-evidence.mjs';

const buildId = '0.1.1+123456789abc';
const commitSha = `123456789abc${'d'.repeat(28)}`;
const sourceFingerprint = 'f'.repeat(64);
const viewports = ['390x844', '768x1024', '1366x768', '800x360'];
const subjects = ['ash-servant', 'demoness'];
const backgrounds = ['black', 'dark-red', 'neutral-gray'];
const issueIds = [
  'C08-01-servant-white-matte',
  'C08-02-servant-internal-residue',
  'C08-03-demoness-white-matte',
  'C08-04-demoness-sharpness-scale',
];
const png = (label, width = 1, height = 1) => sharp({ create: { width, height, channels: 4, background: { r: label.length % 255, g: 16, b: 32, alpha: 1 } } }).png().toBuffer();
/** @param {number} frameDelayMs */
const animatedWebp = (frameDelayMs) => {
  const width = 2;
  const pageHeight = 2;
  const pages = 96;
  const raw = Buffer.alloc(width * pageHeight * 4 * pages, 255);
  for (let page = 0; page < pages; page += 1) {
    for (let offset = page * width * pageHeight * 4; offset < (page + 1) * width * pageHeight * 4; offset += 4) {
      raw[offset] = page * 9;
      raw[offset + 1] = 255 - page * 7;
      raw[offset + 2] = page * 5;
    }
  }
  return sharp(raw, { raw: { width, height: pageHeight * pages, channels: 4, pageHeight } })
    .webp({ lossless: true, loop: 0, delay: Array.from({ length: pages }, () => frameDelayMs) })
    .toBuffer();
};
const sha = (value) => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), 'inferno-c08-evidence-'));
  const evidenceDir = join(parent, buildId);
  await mkdir(evidenceDir, { recursive: true });
  const distManifest = { version: '0.1.1', buildId, commitSha, sourceFingerprint, clean: true };
  const distBytes = Buffer.from(`${JSON.stringify(distManifest)}\n`);
  const distManifestPath = join(parent, 'build-manifest.json');
  await writeFile(distManifestPath, distBytes);
  const inventory = [];

  /** @param {string} path @param {unknown} value */
  async function putJson(path, value) {
    const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    await mkdir(dirname(join(evidenceDir, path)), { recursive: true });
    await writeFile(join(evidenceDir, path), bytes);
    const entry = { path, bytes: bytes.length, sha256: sha(bytes) };
    inventory.push(entry);
    return entry;
  }
  /** @param {string} path @param {Buffer|string} value */
  async function putArtifact(path, value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    await mkdir(dirname(join(evidenceDir, path)), { recursive: true });
    await writeFile(join(evidenceDir, path), bytes);
    const entry = { path, bytes: bytes.length, sha256: sha(bytes) };
    inventory.push(entry);
    return entry;
  }
  /** @param {string} path @param {string} label @param {number} [width] @param {number} [height] */
  async function putPng(path, label, width = 1, height = 1) {
    const entry = await putArtifact(path, await png(label, width, height));
    return { path, bytes: entry.bytes, sha256: entry.sha256 };
  }

  const commandNames = ['npm run lint', 'npm run typecheck', 'npm test', 'npm run assets:audit', 'npm run animation:audit', 'npm run fingerprint:audit:cycle08', 'npm run build', 'npm run test:e2e', 'npm run release:audit'];
  const commands = [];
  for (const [index, name] of commandNames.entries()) {
    const log = await putArtifact(`automation/command-${index}.log`, `${name}\nPASS\n`);
    commands.push({ name, status: 'PASS', exitCode: 0, log });
  }
  await putJson('automation.json', {
    buildId, sourceFingerprint, status: 'PASS', testsPassed: 240, testsFailed: 0, testsSkipped: 0, commands,
  });

  const atlases = [
    ...['idle', 'inhale', 'blow', 'recovery'].map((clip) => ({ id: `CH-ASH-SERVANT-${clip.toUpperCase()}-C08`, version: 'v6', atlas: [1024, 640], cell: [256, 320], frameCount: 8, maxEdgeAlphaPixels: 0, maxMatteRatio: 0.004, maxInternalNeutralResidueRatio: 0.002, maxSourceToAtlasUpscale: 1, exactAlphaFrames: 8, changedAlphaPixels: 0, maxAlphaError: 0, lowAlphaLeakPixels: 0, maxDetachedPartialAlphaPixels: 0 })),
    ...['idle', 'cast', 'hold', 'recovery'].map((clip) => ({ id: `CH-DEMONESS-${clip.toUpperCase()}-C08`, version: 'v7', atlas: [2048, 1664], cell: [512, 832], frameCount: 8, maxEdgeAlphaPixels: 0, maxMatteRatio: 0.004, maxInternalNeutralResidueRatio: 0.002, maxSourceToAtlasUpscale: 1, exactAlphaFrames: 8, changedAlphaPixels: 0, maxAlphaError: 0, lowAlphaLeakPixels: 0 })),
  ];
  const upscaleSamples = viewports.flatMap((viewport, viewportIndex) => [1, 2].map((dpr) => ({ viewport, dpr, effectiveUpscale: 0.35 + viewportIndex * 0.15 + dpr * 0.1 })));
  const nativeFrames = Array.from({ length: 32 }, (_, index) => ({ path: `visual-references/cycle-08-sources/demoness-frames/frame-${index}.png`, width: 983 + index, height: 1535 + index, sha256: index.toString(16).padStart(64, '0') }));
  const approvedReferenceBytes = await sharp({ create: { width: 925, height: 1644, channels: 3, background: { r: 40, g: 8, b: 8 } } }).jpeg().toBuffer();
  const approvedReferenceArtifact = await putArtifact('assets/approved-demoness-reference.jpg', approvedReferenceBytes);
  const referenceFeatures = ['face', 'crown-hair', 'silhouette', 'closed-high-neck-costume', 'ember-copper-palette', 'proportions', 'hands', 'scale-dominance'];
  const approvedReference = {
    path: 'visual-references/stage-references/stage-5-demoness-reference-view.jpg',
    role: 'Authoritative user-approved Stage 5 Demoness reference',
    width: 925,
    height: 1644,
    channels: 3,
    hasAlpha: false,
    sha256: approvedReferenceArtifact.sha256,
    provenance: 'User-supplied Stage 5 reference retained verbatim and used as the identity and costume authority for the native C08 redraw.',
    featureChecklist: referenceFeatures,
  };
  const nativeManifest = await putJson('assets/native-source-manifest.json', {
    schemaVersion: 1, cycle: '08', generationMode: 'built-in OpenAI ImageGen', approvedReference,
    identityMaster: { path: 'visual-references/cycle-08-sources/demoness-identity-master.png', width: 987, height: 1593, sha256: 'f'.repeat(64) },
    demonessFrames: nativeFrames,
    nativeSourceGate: { targetCell: [512, 832], maxSourceToAtlasUpscale: 1, oldRasterUpscaleUsed: false },
  });
  await putJson('assets.json', {
    buildId, sourceFingerprint, status: 'PASS', atlases, upscaleSamples,
    budgets: { artBytes: 10_000_000, artLimitBytes: 9.8 * 1024 * 1024, decodedBytes: 64_000_000, decodedHardLimitBytes: 64 * 1024 * 1024, packageBytes: 12_000_000, packageLimitBytes: 15 * 1024 * 1024 },
    nativeSource: {
      generationMode: 'built-in OpenAI ImageGen', identityMasterSha256: 'f'.repeat(64), oldRasterUpscaleUsed: false,
      targetCell: [512, 832], maxSourceToAtlasUpscale: 1,
      demonessFrameCount: 32, uniqueFrameHashes: 32, minWidth: 983, minHeight: 1535,
      approvedReference: { ...approvedReference, artifact: approvedReferenceArtifact },
      manifestPath: nativeManifest.path, manifestSha256: nativeManifest.sha256, manifest: nativeManifest,
    },
    runtime: {
      demonessPreviousSize: [420, 700], demonessSize: [504, 840], servantSize: [540, 590], demonessScaleFactor: 1.2,
      minVisibleHeightRatio: 1.31, socketMetadataParity: true, maxRootDriftLogicalPx: 2, maxAnatomicalScaleDriftPercent: 2,
    },
  });

  const screenshots = [];
  for (const subject of subjects) for (const background of backgrounds) for (const viewport of viewports) for (const dpr of [1, 2]) {
    const id = `${subject}-${background}-${viewport}-dpr${dpr}`;
    const [width, height] = viewport.split('x').map(Number);
    const backgroundHex = { black: '#000000', 'dark-red': '#350b0b', 'neutral-gray': '#777777' }[background];
    screenshots.push({ ...(await putPng(`visual/${id}.png`, id, width * dpr, height * dpr)), subject, background, backgroundHex, viewport, dpr, physicalWidth: width * dpr, physicalHeight: height * dpr, frameCount: 32, renderer: 'sharp-decoded-webp-all-frame-matrix' });
  }
  const motionEvidence = [];
  for (const subject of subjects) for (const speed of ['normal', 'slow']) {
    const frameDelayMs = speed === 'normal' ? 100 : 400;
    const entry = await putArtifact(`visual/motion/${subject}-${speed}.webp`, await animatedWebp(frameDelayMs));
    motionEvidence.push({
      artifactKey: `${subject}:${speed}`,
      subject,
      speed,
      cycles: 3,
      sourceFrameCount: 32,
      pageCount: 96,
      frameDelayMs,
      durationMs: 96 * frameDelayMs,
      width: 2,
      height: 2,
      ...entry,
    });
  }
  const renderer = 'sharp-decoded-webp-all-frame-matrix';
  const rendererVersion = sharp.versions.sharp;
  const renderManifest = await putJson('visual/render-manifest.json', {
    schemaVersion: 1,
    cycle: '08',
    version: '0.1.1',
    status: 'READY_FOR_QA',
    buildId,
    commitSha,
    sourceFingerprint,
    buildManifestSha256: sha(distBytes),
    renderer,
    rendererVersion,
    backgrounds: { black: '#000000', 'dark-red': '#350b0b', 'neutral-gray': '#777777' },
    screenshots,
    motionEvidence,
  });
  const browserCaptures = [];
  for (const subject of subjects) for (const speed of ['normal', 'slow']) for (const [viewportIndex, viewport] of viewports.entries()) {
    const dpr = viewportIndex % 2 + 1;
    const [width, height] = viewport.split('x').map(Number);
    const artifact = await putPng(`visual/browser/${subject}-${speed}-${viewport}-dpr${dpr}.png`, `${subject}-${speed}-${viewport}`, width * dpr, height * dpr);
    browserCaptures.push({
      ...artifact,
      subject,
      speed,
      viewport,
      dpr,
      browser: { name: 'Chromium', version: 'fixture-128' },
      capturedAt: '2026-08-22T13:00:00.000Z',
      state: { clip: speed === 'normal' ? 'idle' : 'recovery', playbackRate: speed === 'normal' ? 1 : 0.25 },
      consoleErrors: 0,
      consoleWarnings: 0,
      buildId,
      sourceFingerprint,
    });
  }
  await putJson('visual.json', {
    buildId, sourceFingerprint, status: 'PASS', renderer, rendererVersion, screenshots, browserCaptures,
    renderManifestSha256: renderManifest.sha256, renderManifest,
    motionEvidence: motionEvidence.map((entry) => ({
      ...entry,
      status: 'PASS',
      owner: 'qa-retest-c08',
      observation: `Reviewed ${entry.artifactKey} for three complete cycles; contour, internal gaps, anatomy, scale, and motion remain stable.`,
    })),
    reviewOwner: 'qa-retest-c08', reviewedAt: '2026-08-22T13:30:00.000Z',
    referenceReview: {
      owner: 'qa-retest-c08', referenceSha256: approvedReference.sha256, completedAt: '2026-08-22T13:25:00.000Z',
      observation: 'The native redraw preserves every authoritative identity, costume, palette, proportion, hand, and scale feature without blur or morphing.',
      features: Object.fromEntries(referenceFeatures.map((feature) => [feature, 'PASS'])),
    },
    framesInspected: { 'ash-servant': 32, demoness: 32 }, normalSpeedCycles: 3, slowSpeedCycles: 3,
    findings: { whiteEdgeDefects: 0, internalGapResidueDefects: 0, erasedHighlightDefects: 0, blurDefects: 0, morphDefects: 0, clippingDefects: 0 },
  });

  const owners = { implementation: 'developer-c08', targetedQa: 'qa-triage-c08', retestQa: 'qa-retest-c08', independentQa: 'qa-blind-c08', regressionQa: 'qa-regression-c08' };
  const issueRecords = [];
  const retestEvidence = [];
  for (let index = 0; index < issueIds.length; index += 1) {
    const id = issueIds[index];
    const before = await putPng(`issues/${id}-before.png`, `${id}-before`);
    const after = await putPng(`issues/${id}-after.png`, `${id}-after`);
    retestEvidence.push(after);
    issueRecords.push({
      id, severity: 'High', status: 'VERIFIED',
      report: {
        owner: owners.targetedQa, buildId: '0.1.0+a17cdd65fd5a', observedAt: `2026-08-22T10:0${index}:00.000Z`,
        environment: { browser: 'Chromium', version: 'fixture', os: 'Windows 11', viewport: viewports[index], dpr: index % 2 + 1 },
        acceptanceIds: [`C08:${id}`],
        steps: 'Render all authored frames on each required dark and neutral background, then inspect the linked defect region.',
        expected: 'Every external contour and internal silhouette gap remains clean, transparent, sharp, and anatomically stable.',
        actual: 'The superseded build shows a visible white residue, insufficient sharpness, or incorrect character scale in the linked capture.',
        evidence: [before],
      },
      fix: { owner: owners.implementation, buildId, commitSha, completedAt: `2026-08-22T11:0${index}:00.000Z`, summary: 'Rebuilt the affected Cycle 08 atlas and synchronized the runtime placement and anatomical socket metadata.' },
      independentRetest: { owner: owners.retestQa, status: 'PASS', completedAt: `2026-08-22T12:0${index}:00.000Z`, fixDisclosedBeforeObservation: false, firstObservation: 'The first blind replay shows a clean stable silhouette with no recurrence of the linked contour, gap, sharpness, or scale defect.', evidence: [after] },
      neighboringRegression: { owner: owners.retestQa, status: 'PASS', completedAt: `2026-08-22T13:0${index}:00.000Z`, scenarios: ['pause-freeze', 'viewport-dpr-matrix'] },
    });
  }
  await putJson('issues.json', { buildId, sourceFingerprint, status: 'PASS', issues: issueRecords });

  await putJson('independent.json', {
    buildId, sourceFingerprint, status: 'PASS', owner: owners.independentQa, independence: true, blind: true, fixDisclosedBeforeFirstObservations: false, decision: 'PASS',
    completedAt: '2026-08-22T14:30:00.000Z', findingsCritical: 0, findingsHigh: 0,
    observations: issueIds.map((issueId, index) => ({ issueId, observedAt: `2026-08-22T14:1${index}:00.000Z`, text: `For ${issueId}, the blind Cycle 08 capture keeps contours, internal gaps, character sharpness, relative height, and effect sockets visibly correct.`, evidence: [retestEvidence[index]] })),
    verdict: { whiteEdgeDefects: 0, internalGapResidueDefects: 0, erasedHighlightDefects: 0, demonessBlurDefects: 0, demonessHeightDominanceConfirmed: true, socketParityConfirmed: true },
  });
  const fingerprintGroups = Object.fromEntries(['gameplay', 'shell', 'audio', 'audioRegistry', 'platform', 'flame', 'environment', 'host', 'steamRenderer'].map((name, index) => {
    const digest = String(index + 1).repeat(64).slice(0, 64);
    return [name, { status: 'PASS', baselineSha256: digest, candidateSha256: digest }];
  }));
  const fingerprintAudit = await putJson('automation/fingerprint-audit-cycle08.json', {
    schemaVersion: 1, cycle: '08', status: 'PASS', baselineBuildId: '0.1.0+a17cdd65fd5a', baselineCommit: 'a17cdd65fd5af4ec236fd777aa5dd4723664a897',
    candidateBuildId: buildId, candidateCommit: commitSha, commitSha, sourceFingerprint, groups: fingerprintGroups,
  });
  await putJson('regression.json', {
    buildId, sourceFingerprint, status: 'PASS', owner: owners.regressionQa, completedAt: '2026-08-22T15:00:00.000Z', openCritical: 0, openHigh: 0,
    scenarios: ['contour-dark-backgrounds', 'internal-gaps-all-frames', 'viewport-dpr-matrix', 'socket-origin-parity', 'pause-freeze', 'cancel-cleanup', 'reduced-motion-semantic-parity', 'gameplay-timing-parity'],
    frozenFingerprints: {
      baselineBuildId: '0.1.0+a17cdd65fd5a',
      baselineCommit: 'a17cdd65fd5af4ec236fd777aa5dd4723664a897',
      candidateCommit: commitSha,
      groups: fingerprintGroups,
    },
    fingerprintAudit,
  });
  await putJson('acceptance.json', {
    buildId, sourceFingerprint, status: 'PASS', decision: 'PASS', owner: 'release-acceptance-c08', completedAt: '2026-08-22T15:30:00.000Z', openCritical: 0, openHigh: 0,
    criteria: ['F-10', 'G-09', 'V-25', 'V-26', 'V-27', 'V-28', 'V-29', 'V-30', 'A-06', 'PERF-09', 'Y-07', 'Q-09', 'Q-10', 'RLS-07', 'RLS-08'].map((id) => ({ id, status: 'PASS', evidence: [renderManifest] })),
  });

  const summary = {
    schemaVersion: 1, cycle: '08', version: '0.1.1', status: 'PASS', buildId, sourceFingerprint, buildManifestSha256: sha(distBytes),
    defects: { critical: 0, high: 0 }, passOwners: owners,
    passes: { automation: 'automation.json', assets: 'assets.json', visual: 'visual.json', issues: 'issues.json', independent: 'independent.json', regression: 'regression.json', acceptance: 'acceptance.json' },
    files: inventory,
  };
  await writeFile(join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return { evidenceDir, distManifestPath, verifyRuntimeAssets: false, verifyCandidateSources: false };
}

/** @param {string} root @param {string} path @param {(value:any)=>void} mutate */
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

test('Cycle 08 validator accepts exact-build alpha, scale, viewport and independent QA evidence', async () => {
  const value = await fixture();
  const report = await validateCorrectiveCycle08Evidence(value);
  assert.equal(report.status, 'PASS');
  assert.equal(report.auditedAtlases, 8);
  assert.equal(report.visualScreenshots, 48);
  assert.equal(report.verifiedIssues, 4);
});

test('Cycle 08 validator rejects relabelled or stale Cycle 07 evidence', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'summary.json', (summary) => { summary.cycle = '07'; });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /stale Cycle 07 evidence is forbidden/);
});

test('Cycle 08 validator rejects alpha touching a cell edge', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'assets.json', (assets) => { assets.atlases[0].maxEdgeAlphaPixels = 1; });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /alpha touches a cell edge/);
});

test('Cycle 08 validator rejects lossy decoded alpha and detached Servant contour tiles', async () => {
  for (const mutate of [
    (assets) => { assets.atlases.find((atlas) => atlas.id === 'CH-DEMONESS-IDLE-C08').changedAlphaPixels = 1; },
    (assets) => { assets.atlases.find((atlas) => atlas.id === 'CH-ASH-SERVANT-IDLE-C08').maxDetachedPartialAlphaPixels = 1; },
  ]) {
    const value = await fixture();
    await editJson(value.evidenceDir, 'assets.json', mutate);
    await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /decoded WebP alpha|block\/tile contour/i);
  }
});

test('Cycle 08 validator rejects missing or excessive internal-gap residue metrics', async () => {
  for (const mutation of [
    (assets) => { delete assets.atlases[0].maxInternalNeutralResidueRatio; },
    (assets) => { assets.atlases[0].maxInternalNeutralResidueRatio = 0.006; },
  ]) {
    const value = await fixture();
    await editJson(value.evidenceDir, 'assets.json', mutation);
    await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /internal-gap neutral residue exceeds/);
  }
});

test('Cycle 08 validator rejects a Demoness that is not exactly 20% larger', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'assets.json', (assets) => { assets.runtime.demonessSize = [500, 830]; });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /exactly 20% larger/);
});

test('Cycle 08 validator rejects insufficient visible bbox dominance', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'assets.json', (assets) => { assets.runtime.minVisibleHeightRatio = 1.249; });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /visible bbox is not at least 1.25x/);
});

test('Cycle 08 validator rejects a low-resolution source hidden behind a larger atlas cell', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'assets.json', (assets) => { assets.atlases.find((atlas) => atlas.id === 'CH-DEMONESS-IDLE-C08').maxSourceToAtlasUpscale = 1.53; });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /source artwork is upscaled above the native 1.0x limit/);
});

test('Cycle 08 validator rejects an incomplete viewport and DPR matrix', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'assets.json', (assets) => { assets.upscaleSamples = assets.upscaleSamples.filter((sample) => !(sample.viewport === '800x360' && sample.dpr === 2)); });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /upscale matrix is missing 800x360:DPR2/);
});

test('Cycle 08 validator rejects a screenshot whose real PNG dimensions do not match viewport and DPR', async () => {
  const value = await fixture();
  const visual = JSON.parse(await readFile(join(value.evidenceDir, 'visual.json'), 'utf8'));
  const screenshot = visual.screenshots.find((entry) => entry.viewport === '390x844' && entry.dpr === 2);
  const bytes = await png('wrong-size', 390, 844);
  await writeFile(join(value.evidenceDir, screenshot.path), bytes);
  screenshot.sha256 = sha(bytes);
  const visualBytes = Buffer.from(`${JSON.stringify(visual, null, 2)}\n`);
  await writeFile(join(value.evidenceDir, 'visual.json'), visualBytes);
  const summaryPath = join(value.evidenceDir, 'summary.json');
  const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
  const screenshotEntry = summary.files.find((entry) => entry.path === screenshot.path);
  screenshotEntry.bytes = bytes.length;
  screenshotEntry.sha256 = sha(bytes);
  const visualEntry = summary.files.find((entry) => entry.path === 'visual.json');
  visualEntry.bytes = visualBytes.length;
  visualEntry.sha256 = sha(visualBytes);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /PNG dimensions do not match viewport\/DPR/);
});

test('Cycle 08 validator rejects an incomplete production-browser capture matrix', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'visual.json', (visual) => {
    visual.browserCaptures = visual.browserCaptures.filter((capture) => !(capture.subject === 'demoness' && capture.speed === 'slow' && capture.viewport === '800x360'));
  });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /production-browser matrix is missing demoness:slow:800x360/);
});

test('Cycle 08 validator rejects visual signoff bound to another render manifest', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'visual.json', (visual) => { visual.renderManifestSha256 = '0'.repeat(64); });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /visual review is not bound to its render manifest/);
});

test('Cycle 08 validator rejects motion review metadata with the wrong slow timing', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'visual.json', (visual) => {
    const slow = visual.motionEvidence.find((entry) => entry.subject === 'demoness' && entry.speed === 'slow');
    slow.frameDelayMs = 100;
    slow.durationMs = slow.pageCount * slow.frameDelayMs;
  });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /continuous motion timing is invalid/);
});

test('Cycle 08 validator rejects skipped tests and a forged command exit code', async () => {
  for (const mutation of [
    (automation) => { automation.testsSkipped = 1; },
    (automation) => { automation.commands[0].exitCode = 1; },
  ]) {
    const value = await fixture();
    await editJson(value.evidenceDir, 'automation.json', mutation);
    await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /automation results are incomplete|required command did not pass/);
  }
});

test('Cycle 08 validator rejects a changed frozen runtime fingerprint', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'regression.json', (regression) => { regression.frozenFingerprints.groups.audio.candidateSha256 = 'f'.repeat(64); });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /frozen fingerprint changed: audio/);
});

test('Cycle 08 validator rejects cleanup that erases legitimate authored highlights', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'visual.json', (visual) => { visual.findings.erasedHighlightDefects = 1; });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /unresolved character defects/);
});

test('Cycle 08 validator rejects missing independent retest evidence link', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'issues.json', (issues) => { delete issues.issues[0].independentRetest; });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /independent retest link is missing/);
});

test('Cycle 08 validator rejects missing neighboring regression link', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'issues.json', (issues) => { delete issues.issues[0].neighboringRegression; });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /neighboring regression link is missing/);
});

test('Cycle 08 validator rejects a missing independent issue observation', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'independent.json', (review) => { review.observations.pop(); });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /do not cover every required issue/);
});

test('Cycle 08 validator rejects native provenance bound to a different approved reference', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'assets/native-source-manifest.json', (manifest) => {
    manifest.approvedReference.path = 'visual-references/stage-references/substituted-reference.jpg';
  });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /native source manifest: artifact hash\/size mismatch|approved reference provenance is incomplete/);
});

test('Cycle 08 validator rejects a failed authoritative reference feature review', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'visual.json', (visual) => { visual.referenceReview.features.hands = 'FAIL'; });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /authoritative reference feature review is incomplete/);
});

test('Cycle 08 validator rejects an acceptance PASS without exact hash-bound evidence', async () => {
  const value = await fixture();
  await editJson(value.evidenceDir, 'acceptance.json', (acceptance) => { acceptance.criteria[0].evidence = []; });
  await assert.rejects(() => validateCorrectiveCycle08Evidence(value), /acceptance F-10 has no exact evidence links/);
});
