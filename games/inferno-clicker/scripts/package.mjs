import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gameRoot } from './lib.mjs';
import { validateCorrectiveCycle08Evidence } from './validate-corrective-cycle-08-evidence.mjs';

const releaseDir = join(gameRoot, 'releases');
await mkdir(releaseDir, { recursive: true });
const gate = JSON.parse(await readFile(join(gameRoot, 'reports/release-gate.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(gameRoot, 'dist/build-manifest.json'), 'utf8'));
const evidenceDir = join(gameRoot, 'reports', 'corrective-cycle-08', manifest.buildId);
const summaryBytes = await readFile(join(evidenceDir, 'summary.json'));
const summarySha256 = createHash('sha256').update(summaryBytes).digest('hex');
if (
  gate.cycle !== '08'
  || gate.buildId !== manifest.buildId
  || gate.approved !== true
  || gate.summarySha256 !== summarySha256
  || typeof gate.reviewerSignoff !== 'string'
  || gate.reviewerSignoff.length < 3
  || typeof gate.releaseAgentSignoff !== 'string'
  || gate.releaseAgentSignoff.length < 3
) throw new Error(`Release gate is not approved with exact Cycle 08 evidence for ${manifest.buildId}`);
await validateCorrectiveCycle08Evidence({ evidenceDir });
const acceptanceSource = await readFile(join(gameRoot, 'docs', 'ACCEPTANCE_CRITERIA.md'), 'utf8');
for (const id of ['F-10', 'G-09', 'V-25', 'V-26', 'V-27', 'V-28', 'V-29', 'V-30', 'A-06', 'PERF-09', 'Y-07', 'Q-09', 'Q-10', 'RLS-07', 'RLS-08']) {
  const row = acceptanceSource.split(/\r?\n/).find((line) => line.startsWith(`| ${id} |`));
  if (!row || !/\| PASS \|\s*$/.test(row)) throw new Error(`Acceptance criterion ${id} is not PASS in docs/ACCEPTANCE_CRITERIA.md`);
}
if (!/\*\*Current decision:\*\* DONE = YES\b/.test(acceptanceSource)) throw new Error('Cycle 08 acceptance document does not declare DONE = YES');
const releaseAudit = spawnSync(process.execPath, [join(gameRoot, 'scripts', 'release-audit.mjs')], { cwd: gameRoot, encoding: 'utf8' });
if (releaseAudit.status !== 0) throw new Error(releaseAudit.stderr || releaseAudit.stdout || 'release audit failed');
const version = String(manifest.version);
const archiveName = `inferno-clicker-${version}.zip`;
const archive = join(releaseDir, archiveName);
for (const path of [archive, `${archive}.sha256`]) {
  await access(path).then(() => { throw new Error(`Refusing to overwrite historical release artifact: ${path}`); }).catch((error) => {
    if (error?.code !== 'ENOENT') throw error;
  });
}
const zip = process.platform === 'win32'
  ? spawnSync('tar', ['-a', '-c', '-f', archive, '.'], { cwd: join(gameRoot, 'dist'), encoding: 'utf8' })
  : spawnSync('zip', ['-q', '-r', archive, '.'], { cwd: join(gameRoot, 'dist'), encoding: 'utf8' });
if (zip.status !== 0) throw new Error(zip.stderr || 'zip failed');
const bytes = await readFile(archive);
const digest = createHash('sha256').update(bytes).digest('hex');
await writeFile(`${archive}.sha256`, `${digest}  ${archiveName}\n`);
console.log(`package PASS (${bytes.length} bytes, sha256 ${digest})`);
