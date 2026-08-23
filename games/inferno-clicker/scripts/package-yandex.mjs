import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, chmod, cp, lstat, mkdir, mkdtemp, readFile, rename, rm, utimes, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { buildIdentity, gameRoot, startVerifiedStaticServer, verifyBuildPayload, walk } from './lib.mjs';

const releaseDir = join(gameRoot, 'releases');
const manifestBytes = await readFile(join(gameRoot, 'dist/build-manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const reportDir = join(gameRoot, 'reports/yandex-release-cycle-09', manifest.buildId);
const automationBytes = await readFile(join(reportDir, 'automation-results.json'));
const gate = JSON.parse(automationBytes.toString('utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifestSha256 = sha256(manifestBytes);
const automationSha256 = sha256(automationBytes);
const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const currentIdentity = await buildIdentity();
invariant(currentIdentity.clean === true
  && currentIdentity.buildId === manifest.buildId
  && currentIdentity.commitSha === manifest.commitSha
  && currentIdentity.sourceFingerprint === manifest.sourceFingerprint,
'Current clean Git identity differs from the exact gated candidate.');
await verifyBuildPayload(join(gameRoot, 'dist'), manifest);

invariant(['PASS', 'PASS_WITH_EXTERNAL_BLOCKERS'].includes(gate.status)
  && gate.cycle === '09'
  && gate.target === 'yandex'
  && gate.buildId === manifest.buildId
  && gate.commitSha === manifest.commitSha
  && gate.sourceFingerprint === manifest.sourceFingerprint
  && gate.buildManifestSha256 === manifestSha256
  && gate.reproducibleBuild === true
  && gate.reproduciblePayload === true
  && gate.browserE2e === 'PASS',
'Exact Yandex gate evidence does not match the current dist build.');

const inventoryBytes = await readFile(join(reportDir, 'evidence-inventory.json'));
const inventory = JSON.parse(inventoryBytes.toString('utf8'));
const inventorySha256 = sha256(inventoryBytes);
invariant(sha256(inventoryBytes) === gate.evidenceInventorySha256
  && inventory.buildId === manifest.buildId
  && inventory.commitSha === manifest.commitSha
  && inventory.sourceFingerprint === manifest.sourceFingerprint
  && inventory.files?.length === gate.evidenceInventoryFiles,
'Gate evidence inventory identity is missing or stale.');
const inventoryPaths = inventory.files.map((item) => item.path);
invariant(JSON.stringify(inventoryPaths) === JSON.stringify([...inventoryPaths].sort())
  && new Set(inventoryPaths).size === inventoryPaths.length,
'Gate evidence inventory must have unique paths in canonical sorted order.');
for (const item of inventory.files) {
  invariant(Object.keys(item).sort().join(',') === 'bytes,path,sha256'
    && /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._+\-/]+$/u.test(item.path)
    && Number.isInteger(item.bytes) && item.bytes >= 0
    && /^[a-f0-9]{64}$/u.test(item.sha256),
  `Malformed evidence inventory item: ${JSON.stringify(item)}`);
  const bytes = await readFile(join(reportDir, item.path));
  invariant(bytes.length === item.bytes && sha256(bytes) === item.sha256, `Gate evidence changed after validation: ${item.path}`);
}

const acceptanceBytes = await readFile(join(gameRoot, 'docs/ACCEPTANCE_CRITERIA.md'));
const acceptanceText = acceptanceBytes.toString('utf8');
const acceptanceSha256 = sha256(acceptanceBytes);
const expectedAcceptanceIds = [
  'C09-A-01',
  ...[1, 2, 3, 4, 5, 6].map((value) => `C09-F-0${value}`),
  ...[1, 2, 3, 4, 5].map((value) => `C09-G-0${value}`),
  'C09-PERF-01', 'C09-PERF-02',
  'C09-Q-01', 'C09-Q-02', 'C09-Q-03',
  'C09-RLS-01', 'C09-RLS-02', 'C09-RLS-03', 'C09-RLS-04',
  'C09-V-01', 'C09-V-02', 'C09-V-03', 'C09-V-04',
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((value) => `C09-Y-0${value}`),
].sort();
const acceptanceLines = acceptanceText.split(/\r?\n/u).filter((line) => line.startsWith('| C09-'));
const rawAcceptanceRows = acceptanceLines.map((line) => {
  const match = line.match(/^\| (C09-[A-Z]+-\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/u);
  invariant(match && match.slice(1).every((cell) => cell.length > 0 && cell === cell.trim()),
    `Malformed Cycle 09 acceptance row: ${line}`);
  return { id: match[1], rawStatus: match[4] };
});
invariant(JSON.stringify(rawAcceptanceRows.map((item) => item.id).sort()) === JSON.stringify(expectedAcceptanceIds),
  `Cycle 09 acceptance must contain the exact ${expectedAcceptanceIds.length}-ID set.`);
const acceptanceRows = rawAcceptanceRows.map(({ id, rawStatus }) => {
  if (rawStatus === 'PASS' || rawStatus === 'READY_FOR_PACKAGE') return { id, status: rawStatus };
  const blocked = rawStatus.match(/^BLOCKED_EXTERNAL — (.+)$/u);
  if (blocked) return { id, status: 'BLOCKED_EXTERNAL', reason: blocked[1] };
  throw new Error(`${id} has a non-terminal or unsupported pre-package status: ${rawStatus}`);
}).sort((left, right) => left.id.localeCompare(right.id));
invariant(acceptanceRows.find((item) => item.id === 'C09-RLS-01')?.status === 'READY_FOR_PACKAGE'
  && acceptanceRows.find((item) => item.id === 'C09-RLS-02')?.status === 'READY_FOR_PACKAGE',
'C09-RLS-01/02 must be READY_FOR_PACKAGE until the archive audit exists.');
invariant(acceptanceRows.every((item) => ['C09-RLS-01', 'C09-RLS-02'].includes(item.id) || item.status !== 'READY_FOR_PACKAGE'),
'READY_FOR_PACKAGE is allowed only for C09-RLS-01/02.');
const blockedAcceptance = acceptanceRows.filter((item) => item.status === 'BLOCKED_EXTERNAL');
const expectedBlockers = [...(gate.externalBlockers ?? [])].sort();
invariant(Array.isArray(gate.externalBlockers)
  && gate.externalBlockers.every((item) => typeof item === 'string' && item.length > 0 && item === item.trim())
  && new Set(expectedBlockers).size === expectedBlockers.length,
'Gate external blocker inventory must be an array of unique, nonempty exact reasons.');
const commonBrowserCriteria = ['C09-Q-03', 'C09-RLS-04', 'C09-V-01'];
const commonDeviceCriteria = ['C09-PERF-01', 'C09-Q-03', 'C09-RLS-04', 'C09-V-01'];
const consoleCriteria = [
  'C09-RLS-03', 'C09-RLS-04',
  'C09-Y-01', 'C09-Y-02', 'C09-Y-03', 'C09-Y-04', 'C09-Y-05', 'C09-Y-06', 'C09-Y-07',
].sort();
const blockerPolicies = [
  ...['Yandex Browser', 'Mozilla Firefox', 'Opera', 'Apple Safari'].map((label) => ({
    pattern: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')} executed Cycle 09 production run evidence$`, 'u'),
    criteria: commonBrowserCriteria,
  })),
  { pattern: /^Android physical device or real-device cloud exact-build run$/u, criteria: commonDeviceCriteria },
  { pattern: /^iOS physical device or real-device cloud exact-build run$/u, criteria: commonDeviceCriteria },
  { pattern: /^authorized Yandex Games Console exact-RC draft\/debug trace$/u, criteria: consoleCriteria },
  {
    pattern: /^Host compositor calibration cannot prove one or more required FPS thresholds\.$/u,
    criteria: ['C09-PERF-01', 'C09-Q-03', 'C09-RLS-04'],
  },
];
const expectedBlockerMappings = expectedBlockers.map((blocker) => {
  const matches = blockerPolicies.filter((policy) => policy.pattern.test(blocker));
  invariant(matches.length === 1, `Unknown or ambiguous external blocker category: ${blocker}`);
  return { blocker, criteria: [...matches[0].criteria].sort() };
});
const blockersByCriterion = new Map();
for (const mapping of expectedBlockerMappings) {
  for (const id of mapping.criteria) {
    const blockers = blockersByCriterion.get(id) ?? [];
    blockers.push(mapping.blocker);
    blockersByCriterion.set(id, blockers);
  }
}
const expectedBlockedIds = [...blockersByCriterion.keys()].sort();
invariant(JSON.stringify(blockedAcceptance.map((item) => item.id).sort()) === JSON.stringify(expectedBlockedIds),
'Blocked acceptance IDs differ from the static blocker-category policy.');
for (const criterion of blockedAcceptance) {
  const expectedReason = [...blockersByCriterion.get(criterion.id)].sort().join('; ');
  invariant(criterion.reason === expectedReason,
    `${criterion.id} BLOCKED_EXTERNAL reason must be the exact mapped blocker list: ${expectedReason}`);
}
if (gate.status === 'PASS') invariant(expectedBlockers.length === 0 && blockedAcceptance.length === 0, 'A PASS gate cannot retain external blockers.');
else invariant(expectedBlockers.length > 0 && blockedAcceptance.length > 0, 'External gate blockers are absent from the acceptance contract.');

const submissionManifestBytes = await readFile(join(gameRoot, 'releases/yandex-submission-1.0.0/media/submission-media-manifest.json'));
const submissionManifestSha256 = sha256(submissionManifestBytes);
invariant(submissionManifestSha256 === gate.submissionMediaManifestSha256,
'Submission media changed after the exact gate.');

const stopReportBytes = await readFile(join(reportDir, 'local-rc-stop-report.json'));
const stopReport = JSON.parse(stopReportBytes.toString('utf8'));
const expectedStopStatus = gate.status === 'PASS_WITH_EXTERNAL_BLOCKERS' ? 'READY_FOR_PACKAGE_WITH_EXTERNAL_BLOCKERS' : 'READY_FOR_PACKAGE';
invariant(stopReport.schemaVersion === 1
  && stopReport.kind === 'local-rc-stop-report'
  && stopReport.status === expectedStopStatus
  && stopReport.promotable === false
  && stopReport.build?.buildId === manifest.buildId
  && stopReport.build?.commitSha === manifest.commitSha
  && stopReport.build?.sourceFingerprint === manifest.sourceFingerprint
  && stopReport.build?.buildManifestSha256 === manifestSha256
  && stopReport.gate?.automationResultsSha256 === automationSha256
  && stopReport.gate?.evidenceInventorySha256 === inventorySha256
  && stopReport.acceptance?.sha256 === acceptanceSha256
  && stopReport.submissionMediaManifestSha256 === submissionManifestSha256,
'Local RC stop report is missing or bound to another candidate.');
invariant(JSON.stringify(stopReport.acceptance?.criteria) === JSON.stringify(acceptanceRows), 'Stop report acceptance statuses differ from the reviewed contract.');
invariant(stopReport.issues?.criticalOpen === 0 && stopReport.issues?.highOpen === 0, 'Critical or High issues remain open.');
invariant(JSON.stringify([...(stopReport.externalBlockers ?? [])].sort()) === JSON.stringify(expectedBlockers), 'Stop report external blockers differ from the exact gate.');
const blockerMappings = stopReport.acceptance?.blockedMappings ?? [];
invariant(Array.isArray(blockerMappings), 'Stop report blocker mappings must be an array.');
const canonicalBlockerMappings = blockerMappings.map((item) => {
  invariant(item && Object.keys(item).sort().join(',') === 'blocker,criteria'
    && typeof item.blocker === 'string' && Array.isArray(item.criteria)
    && item.criteria.every((id) => typeof id === 'string')
    && new Set(item.criteria).size === item.criteria.length,
  `Malformed stop-report blocker mapping: ${JSON.stringify(item)}`);
  return { blocker: item.blocker, criteria: [...item.criteria].sort() };
}).sort((left, right) => (left.blocker < right.blocker ? -1 : left.blocker > right.blocker ? 1 : 0));
invariant(JSON.stringify(canonicalBlockerMappings) === JSON.stringify(expectedBlockerMappings),
'Stop-report blocker mappings differ from the static exact category policy.');
const issueLedgerBytes = await readFile(join(gameRoot, 'docs/CYCLE09_ISSUES.md'));
const issueLedgerText = issueLedgerBytes.toString('utf8');
const expectedIssueSeverities = {
  'C09-DOC-001': 'Medium',
  'C09-REL-001': 'High',
  'C09-REL-002': 'High',
  'C09-REL-003': 'Medium',
  'C09-REL-004': 'Medium',
  'C09-REL-005': 'Medium',
  'C09-REL-006': 'Medium',
  'C09-REL-007': 'Medium',
  'C09-REL-008': 'Medium',
  'C09-REL-009': 'Medium',
  'C09-REL-010': 'High',
  'C09-REL-011': 'Medium',
  'C09-REL-012': 'Medium',
  'C09-SUB-001': 'High',
  'C09-VIS-001': 'High',
  'C09-VIS-002': 'High',
};
const expectedIssueIds = Object.keys(expectedIssueSeverities).sort();
const issueLines = issueLedgerText.split(/\r?\n/u).filter((line) => line.startsWith('| C09-'));
invariant(issueLines.length === expectedIssueIds.length,
  `Cycle 09 issue ledger must contain exactly ${expectedIssueIds.length} data rows, including malformed rows.`);
const issueRows = issueLines.map((line) => {
  const match = line.match(/^\| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/u);
  invariant(match && match.slice(1).every((cell) => cell.length > 0 && cell === cell.trim()),
    `Malformed Cycle 09 issue row: ${line}`);
  const [id, severity, environment, reproduction, expected, acceptance, fix, independentRetest, status] = match.slice(1);
  invariant(/^C09-[A-Z]+-\d{3}$/u.test(id)
    && ['Critical', 'High', 'Medium', 'Low'].includes(severity)
    && status === 'CLOSED',
  `Cycle 09 issue row has invalid ID, severity or non-CLOSED status: ${line}`);
  return { id, severity, environment, reproduction, expected, acceptance, fix, independentRetest, status };
})
  .sort((left, right) => left.id.localeCompare(right.id));
invariant(JSON.stringify(issueRows.map((item) => item.id)) === JSON.stringify(expectedIssueIds)
  && issueRows.every((item) => item.severity === expectedIssueSeverities[item.id]),
'Cycle 09 issue ledger IDs/severities differ from the exact reviewed set.');
const issueOpenCounts = Object.fromEntries(['Critical', 'High', 'Medium', 'Low']
  .map((severity) => [`${severity.toLowerCase()}Open`, issueRows.filter((item) => item.severity === severity && item.status !== 'CLOSED').length]));
issueOpenCounts.totalOpen = Object.values(issueOpenCounts).reduce((sum, value) => sum + value, 0);
const issueSummaryLines = issueLedgerText.split(/\r?\n/u).filter((line) => line.startsWith('Open issue counts'));
invariant(issueSummaryLines.length === 1, 'Cycle 09 issue ledger must have exactly one canonical open-count summary.');
const issueSummary = issueSummaryLines[0].match(/^Open issue counts(?: while retest is pending)?: Critical (\d+); High (\d+); Medium (\d+)(?:; Low (\d+))?\. These counts must become Critical 0 \/ High 0 before local RC packaging; external environment blockers remain separate and never close an issue\.$/u);
invariant(issueSummary, `Malformed Cycle 09 issue summary: ${issueSummaryLines[0]}`);
const issueSummaryCounts = {
  criticalOpen: Number(issueSummary[1]),
  highOpen: Number(issueSummary[2]),
  mediumOpen: Number(issueSummary[3]),
  lowOpen: issueSummary[4] === undefined ? 0 : Number(issueSummary[4]),
};
invariant(Object.entries(issueSummaryCounts).every(([key, value]) => issueOpenCounts[key] === value),
'Cycle 09 issue summary counts differ from the exact ledger rows.');
invariant(Object.entries(issueOpenCounts).every(([key, value]) => stopReport.issues?.[key] === value)
  && stopReport.issues?.totalIssues === issueRows.length
  && stopReport.issues?.closedTotal === issueRows.length
  && issueOpenCounts.totalOpen === 0,
'Stop report issue counts differ from the exact closed Cycle 09 ledger.');
const issueLedgerSha256 = sha256(issueLedgerBytes);
invariant(stopReport.issues?.ledgerSha256 === issueLedgerSha256, 'Stop report is not bound to the reviewed issue ledger.');
const signoffs = stopReport.signoffs ?? [];
const reviewerSignoff = signoffs.find((item) => item.role === 'Independent Reviewer');
const qaSignoff = signoffs.find((item) => item.role === 'QA');
const releaseSignoff = signoffs.find((item) => item.role === 'Release Agent');
const expectedSignoffKeys = [
  'acceptanceSha256', 'automationResultsSha256', 'buildId', 'buildManifestSha256', 'commitSha',
  'decision', 'evidenceInventorySha256', 'id', 'independent', 'issueLedgerSha256', 'reviewerId',
  'role', 'signedAt', 'sourceFingerprint', 'submissionMediaManifestSha256',
].sort().join(',');
const gateCompletedAt = Date.parse(gate.completedAt);
const clockToleranceMs = 5 * 60_000;
const latestAllowedSignoff = Date.now() + clockToleranceMs;
invariant(Number.isFinite(gateCompletedAt) && gateCompletedAt <= latestAllowedSignoff,
'Gate completion timestamp is invalid or unreasonably in the future.');
invariant(signoffs.length === 3
  && JSON.stringify(signoffs.map((item) => item.role).sort()) === JSON.stringify(['Independent Reviewer', 'QA', 'Release Agent'])
  && new Set(signoffs.map((item) => item.id)).size === 3
  && new Set(signoffs.map((item) => item.reviewerId)).size === 3
  && reviewerSignoff?.independent === true && reviewerSignoff.reviewerId !== 'root'
  && qaSignoff?.independent === true && qaSignoff.reviewerId !== 'root'
  && releaseSignoff?.independent === false && releaseSignoff.reviewerId === 'root'
  && signoffs.every((item) => typeof item.id === 'string'
    && item.id === item.id.trim() && /^[A-Za-z0-9][A-Za-z0-9._@/+-]{1,127}$/u.test(item.id)
    && typeof item.reviewerId === 'string' && item.reviewerId === item.reviewerId.trim()
    && /^[A-Za-z0-9][A-Za-z0-9._@/+-]{1,127}$/u.test(item.reviewerId)
    && Object.keys(item).sort().join(',') === expectedSignoffKeys
    && item.decision === 'APPROVE_LOCAL_RC'
    && Number.isFinite(Date.parse(item.signedAt))
    && Date.parse(item.signedAt) >= gateCompletedAt
    && Date.parse(item.signedAt) <= latestAllowedSignoff
    && item.buildId === manifest.buildId
    && item.commitSha === manifest.commitSha
    && item.sourceFingerprint === manifest.sourceFingerprint
    && item.buildManifestSha256 === manifestSha256
    && item.automationResultsSha256 === automationSha256
    && item.acceptanceSha256 === acceptanceSha256
    && item.submissionMediaManifestSha256 === submissionManifestSha256
    && item.evidenceInventorySha256 === inventorySha256
    && item.issueLedgerSha256 === issueLedgerSha256),
'QA, independent Reviewer and Release Agent did not sign the exact local RC evidence.');
invariant(submissionManifestSha256 === gate.submissionMediaManifestSha256
  && stopReport.submissionMediaManifestSha256 === gate.submissionMediaManifestSha256,
'Submission media changed after the exact gate/review.');

const repeatAudit = spawnSync(process.execPath, ['scripts/release-audit-yandex.mjs'], {
  cwd: gameRoot,
  encoding: 'utf8',
  env: { ...process.env, INFERNO_CYCLE09_EVIDENCE_DIR: reportDir },
  maxBuffer: 192 * 1024 * 1024,
});
if (repeatAudit.status !== 0) throw new Error(`Exact evidence re-audit failed before packaging.\n${repeatAudit.stdout ?? ''}${repeatAudit.stderr ?? ''}`);

await mkdir(releaseDir, { recursive: true });
const archiveName = 'inferno-clicker-1.0.0-rc.zip';
const archive = join(releaseDir, archiveName);
const checksum = `${archive}.sha256`;
const humanReportPath = join(releaseDir, 'inferno-clicker-1.0.0-rc-report.md');
const packageReportPath = join(reportDir, 'package-results.json');
async function exists(path) { try { await access(path); return true; } catch { return false; } }
if (await exists(archive)) throw new Error(`Refusing to overwrite release candidate: ${archive}`);
// The archive is the publication marker. Any sidecar without it is an orphan left by an
// interrupted pre-publication sequence and is removed before a clean two-pass retry.
await Promise.all([
  rm(checksum, { force: true }),
  rm(packageReportPath, { force: true }),
  rm(humanReportPath, { force: true }),
]);

const packageTempRoot = await mkdtemp(join(releaseDir, '.inferno-yandex-package-'));
const firstArchive = join(packageTempRoot, 'candidate-a.zip');
const secondArchive = join(packageTempRoot, 'candidate-b.zip');
const tempChecksum = join(packageTempRoot, `${archiveName}.sha256`);
const tempReport = join(packageTempRoot, 'package-results.json');
const tempHumanReport = join(packageTempRoot, 'inferno-clicker-1.0.0-rc-report.md');
const extractionRoot = join(packageTempRoot, 'extracted');
const normalizedRoot = join(packageTempRoot, 'normalized-dist');
await mkdir(extractionRoot, { recursive: true });
invariant(Array.isArray(manifest.files) && manifest.files.length > 0
  && manifest.files.every((item) => item && typeof item.path === 'string'
    && /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._+\-/]+$/u.test(item.path)
    && Number.isInteger(item.bytes) && item.bytes >= 0 && /^[a-f0-9]{64}$/u.test(item.sha256)),
'Build manifest file records are malformed or unsafe.');
const manifestPaths = manifest.files.map((entry) => entry.path);
invariant(JSON.stringify(manifestPaths) === JSON.stringify([...manifestPaths].sort())
  && new Set(manifestPaths).size === manifestPaths.length
  && !manifestPaths.includes('build-manifest.json'),
'Build manifest payload paths must be unique, sorted, and exclude its own manifest file.');
const expectedRelative = [...manifest.files.map((entry) => entry.path), 'build-manifest.json'].sort();

// Normalize the complete payload in a private staging tree. ZIP timestamps and modes
// must not inherit a rebuild time or a developer machine's filesystem metadata.
await cp(join(gameRoot, 'dist'), normalizedRoot, { recursive: true, force: false, errorOnExist: true });
const normalizedFiles = await walk(normalizedRoot, () => true);
const normalizedRelative = normalizedFiles.map((path) => relative(normalizedRoot, path).split(sep).join('/')).sort();
invariant(JSON.stringify(normalizedRelative) === JSON.stringify(expectedRelative),
'Normalized staging inventory differs from the exact build manifest.');
const fixedArchiveTime = new Date('2000-01-01T00:00:00.000Z');
for (const path of normalizedFiles) {
  const metadata = await lstat(path);
  invariant(metadata.isFile() && !metadata.isSymbolicLink(), `Normalized staging contains a non-regular file: ${path}`);
  await utimes(path, fixedArchiveTime, fixedArchiveTime);
  if (process.platform !== 'win32') await chmod(path, 0o644);
}

function createArchive(path) {
  const result = process.platform === 'win32'
    ? spawnSync('tar', ['-a', '-c', '-f', path, ...expectedRelative], { cwd: normalizedRoot, encoding: 'utf8' })
    : spawnSync('zip', ['-q', '-X', path, ...expectedRelative], { cwd: normalizedRoot, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'ZIP creation failed.');
}

let verifiedServer;
try {
  createArchive(firstArchive);
  createArchive(secondArchive);
  const [archiveBytes, comparisonBytes] = await Promise.all([readFile(firstArchive), readFile(secondArchive)]);
  invariant(sha256(archiveBytes) === sha256(comparisonBytes), 'Two normalized archive builds produced different bytes.');
  const digest = sha256(archiveBytes);

  const listing = process.platform === 'win32'
    ? spawnSync('tar', ['-tf', firstArchive], { encoding: 'utf8' })
    : spawnSync('unzip', ['-Z1', firstArchive], { encoding: 'utf8' });
  if (listing.status !== 0) throw new Error(listing.stderr || 'ZIP listing failed.');
  const allEntries = String(listing.stdout).split(/\r?\n/u).filter(Boolean).map((entry) => entry.replace(/^\.\//u, '').replaceAll('\\', '/'));
  invariant(allEntries.every((entry) => !/^(?:[A-Za-z]:|\/)|(?:^|\/)\.\.(?:\/|$)/u.test(entry)), 'ZIP contains an unsafe absolute or parent path.');
  invariant(allEntries.every((entry) => !entry.endsWith('/')), 'ZIP unexpectedly contains directory metadata entries.');
  invariant(JSON.stringify([...allEntries].sort()) === JSON.stringify(expectedRelative), 'ZIP inventory differs from the exact build manifest.');
  const verbose = spawnSync('tar', ['-tvf', firstArchive], { encoding: 'utf8' });
  if (verbose.status !== 0) throw new Error(verbose.stderr || 'ZIP metadata listing failed.');
  const metadataLines = String(verbose.stdout).split(/\r?\n/u).filter(Boolean);
  invariant(metadataLines.length === allEntries.length && metadataLines.every((line) => line.trimStart().startsWith('-')),
    'ZIP contains a symlink, hardlink or non-regular entry.');

  const extract = spawnSync('tar', ['-xf', firstArchive, '-C', extractionRoot], { encoding: 'utf8' });
  if (extract.status !== 0) throw new Error(extract.stderr || extract.stdout || 'ZIP extraction failed.');
  const extractedManifestBytes = await readFile(join(extractionRoot, 'build-manifest.json'));
  invariant(sha256(extractedManifestBytes) === manifestSha256, 'Extracted build manifest differs from the gated manifest.');
  await verifyBuildPayload(extractionRoot, JSON.parse(extractedManifestBytes.toString('utf8')));
  const actualFiles = await walk(extractionRoot, () => true);
  const actualRelative = actualFiles.map((path) => relative(extractionRoot, path).split(sep).join('/')).sort();
  invariant(JSON.stringify(actualRelative) === JSON.stringify(expectedRelative), 'Extracted ZIP file inventory differs from the build manifest.');
  const extractedMetadata = await Promise.all(actualFiles.map((path) => lstat(path)));
  invariant(extractedMetadata.every((metadata) => metadata.isFile() && !metadata.isSymbolicLink()),
    'Fresh extraction contains a symlink, hardlink facade or non-regular file.');
  for (const item of manifest.files) {
    const bytes = await readFile(join(extractionRoot, item.path));
    invariant(bytes.length === item.bytes && sha256(bytes) === item.sha256, `Extracted ZIP byte mismatch: ${item.path}`);
  }
  const extractedBytes = extractedMetadata.reduce((sum, metadata) => sum + metadata.size, 0);
  invariant(extractedBytes === manifest.unpackedBytes, `Extracted byte total drift: ${extractedBytes} != ${manifest.unpackedBytes}`);

  verifiedServer = await startVerifiedStaticServer(extractionRoot);
  const rootResponse = await fetch(`${verifiedServer.baseUrl}/`);
  invariant(rootResponse.ok && rootResponse.headers.get('x-inferno-server-nonce') === verifiedServer.nonce, 'Extracted ZIP HTTP server identity failed.');
  invariant(rootResponse.headers.get('content-type')?.startsWith('text/html'), 'Extracted root has the wrong MIME type.');
  invariant((await rootResponse.text()).includes('./game.js'), 'Extracted root does not reference the production bundle.');
  const representativeAsset = manifest.files.find((item) => /\.(?:webp|png)$/u.test(item.path));
  invariant(representativeAsset, 'Build manifest has no representative raster asset.');
  const smoke = [
    { path: '/game.js', type: 'text/javascript' },
    { path: '/styles.css', type: 'text/css' },
    { path: `/${representativeAsset.path}`, type: representativeAsset.path.endsWith('.webp') ? 'image/webp' : 'image/png' },
  ];
  for (const request of smoke) {
    const response = await fetch(`${verifiedServer.baseUrl}${request.path}`);
    invariant(response.ok && response.headers.get('x-inferno-server-nonce') === verifiedServer.nonce, `Extracted HTTP smoke failed: ${request.path}`);
    invariant(response.headers.get('content-type')?.startsWith(request.type), `Wrong MIME for ${request.path}: ${response.headers.get('content-type')}`);
    invariant((await response.arrayBuffer()).byteLength > 0, `Empty extracted response: ${request.path}`);
  }
  const missing = await fetch(`${verifiedServer.baseUrl}/definitely-missing-cycle09`);
  invariant(missing.status === 404 && missing.headers.get('x-inferno-server-nonce') === verifiedServer.nonce,
    `Extracted server must return an owned 404, got ${missing.status}.`);

  const packageReport = {
    schemaVersion: 1,
    packagedAt: new Date().toISOString(),
    status: gate.status === 'PASS_WITH_EXTERNAL_BLOCKERS' ? 'RC_READY_WITH_EXTERNAL_BLOCKERS' : 'RC_READY',
    designation: 'release candidate; promote these exact bytes only after Yandex draft verification',
    promotable: false,
    gateStatus: gate.status,
    externalBlockers: expectedBlockers,
    blockedMappings: expectedBlockerMappings,
    archive: archiveName,
    bytes: archiveBytes.length,
    sha256: digest,
    entries: allEntries.length,
    buildId: manifest.buildId,
    commitSha: manifest.commitSha,
    sourceFingerprint: manifest.sourceFingerprint,
    buildManifestSha256: manifestSha256,
    automationResultsSha256: automationSha256,
    acceptanceSha256,
    submissionMediaManifestSha256,
    evidenceInventorySha256: inventorySha256,
    issueLedgerSha256,
    localRcStopReportSha256: sha256(stopReportBytes),
    prePackageAcceptance: acceptanceRows,
    postPackageAcceptance: [
      { id: 'C09-RLS-01', status: 'PASS', evidence: 'normalized exact-build ZIP identity, SHA-256 and rollback binding' },
      { id: 'C09-RLS-02', status: 'PASS', evidence: 'fresh extraction, exact inventory/hash audit and owned HTTP smoke' },
    ],
    signoffs,
    gateReport: `reports/yandex-release-cycle-09/${manifest.buildId}/automation-results.json`,
    reproduciblePayload: true,
    reproducibleArchiveBytes: true,
    archiveAudit: {
      freshExtraction: true,
      exactInventoryAndHashes: true,
      regularFilesOnly: true,
      unpackedBytes: manifest.unpackedBytes,
      ownedEphemeralHttpServer: true,
      httpSmoke: ['/', '/game.js', '/styles.css', 'representative raster asset', '404'],
    },
  };
  const blockerLines = packageReport.externalBlockers.length > 0
    ? packageReport.externalBlockers.map((blocker) => `- ${blocker}`).join('\n')
    : '- None.';
  const signoffLines = signoffs.map((item) => `- ${item.role}: reviewer ${item.reviewerId}, sign-off ${item.id}, ${item.decision}, ${item.signedAt}`).join('\n');
  const humanReport = `# Yandex local release candidate — «Зажги» / Ignite 1.0.0

Status: **${packageReport.status}**. This is a local release candidate and is not promotable until the exact archive SHA is verified in a Yandex Games draft.

## Exact identity

- Build ID: \`${manifest.buildId}\`
- Commit: \`${manifest.commitSha}\`
- Source fingerprint: \`${manifest.sourceFingerprint}\`
- Archive: \`${archiveName}\`
- Archive bytes: ${archiveBytes.length}
- Archive SHA-256: \`${digest}\`
- Build manifest SHA-256: \`${manifestSha256}\`
- Automation results SHA-256: \`${automationSha256}\`
- Acceptance contract SHA-256: \`${acceptanceSha256}\`
- Submission manifest SHA-256: \`${submissionManifestSha256}\`
- Evidence inventory SHA-256: \`${inventorySha256}\`
- Issue ledger SHA-256: \`${issueLedgerSha256}\`
- Rollback: immutable 0.1.1, SHA-256 \`a0d6d9851707e1f9990ba76f333f991c64c25605dd23ae4728c3953517eac984\`.

## Verification

- Exact clean Yandex release gate: ${gate.status}.
- Reproducible payload: PASS.
- Two independently written normalized archive byte streams: PASS.
- Fresh extraction, exact file inventory and hashes: PASS.
- Traversal/link/non-regular-entry rejection: PASS.
- Extracted owned-server HTTP/MIME/404 smoke: PASS.
- C09-RLS-01 post-package audit: PASS.
- C09-RLS-02 post-package audit: PASS.

## External blockers

${blockerLines}

## Exact-build sign-offs

${signoffLines}

## Decision

The archive remains \`promotable=false\`. Create and verify a Yandex Games draft with these exact bytes, then run \`npm run verify:draft:yandex -- --evidence=<console-evidence.json>\`. Moderation submission and public publication are outside this cycle.
`;
  await Promise.all([
    writeFile(tempChecksum, `${digest}  ${archiveName}\n`),
    writeFile(tempReport, `${JSON.stringify(packageReport, null, 2)}\n`),
    writeFile(tempHumanReport, humanReport, 'utf8'),
  ]);

  // Rename the archive last: its appearance is the atomic publication point.
  try {
    await rename(tempChecksum, checksum);
    await rename(tempReport, packageReportPath);
    await rename(tempHumanReport, humanReportPath);
    await rename(firstArchive, archive);
  } catch (error) {
    await Promise.all([
      rm(checksum, { force: true }),
      rm(packageReportPath, { force: true }),
      rm(humanReportPath, { force: true }),
      rm(archive, { force: true }),
    ]);
    throw error;
  }
  console.log(`package:yandex ${packageReport.status} (${archiveBytes.length} bytes, sha256 ${digest})`);
} finally {
  await verifiedServer?.stop();
  await rm(packageTempRoot, { recursive: true, force: true });
}
