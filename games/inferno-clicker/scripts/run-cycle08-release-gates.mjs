// @ts-check

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditCycle08Fingerprints } from './cycle08-fingerprint-audit.mjs';
import { gameRoot } from './lib.mjs';

const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const required = Object.freeze([
  ['npm run lint', ['run', 'lint']],
  ['npm run typecheck', ['run', 'typecheck']],
  ['npm test', ['test']],
  ['npm run assets:audit', ['run', 'assets:audit']],
  ['npm run animation:audit', ['run', 'animation:audit']],
  ['npm run fingerprint:audit:cycle08', ['run', 'fingerprint:audit:cycle08']],
  ['npm run build', ['run', 'build']],
  ['npm run test:e2e', ['run', 'test:e2e']],
  ['npm run release:audit', ['run', 'release:audit']],
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeName(name, index) {
  return `${String(index + 1).padStart(2, '0')}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.log`;
}

async function runCommand(name, args, outputDir, index) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: gameRoot,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    maxBuffer: 128 * 1024 * 1024,
  });
  const completedAt = new Date().toISOString();
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `${result.error.stack ?? result.error.message}\n` : ''}`;
  const logPath = join(outputDir, safeName(name, index));
  await writeFile(logPath, output || `${name}: no output\n`);
  const bytes = await readFile(logPath);
  const command = {
    name,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status ?? -1,
    startedAt,
    completedAt,
    logPath,
    log: { path: basename(logPath), bytes: bytes.length, sha256: sha256(bytes) },
  };
  if (result.status !== 0) {
    const error = new Error(`${name} failed with exit code ${command.exitCode}`);
    // @ts-ignore attach structured command evidence for the caller
    error.command = command;
    throw error;
  }
  return command;
}

function parseTestCounts(output) {
  const pick = (label) => Number(output.match(new RegExp(`(?:^|\\n)ℹ ${label} (\\d+)`, 'u'))?.[1] ?? output.match(new RegExp(`(?:^|\\n)# ${label} (\\d+)`, 'u'))?.[1]);
  const passed = pick('pass');
  const failed = pick('fail');
  const skipped = pick('skipped');
  invariant(Number.isInteger(passed) && passed > 0 && failed === 0 && skipped === 0, 'Unable to prove zero-failure/zero-skip test counts from npm test log');
  return { testsPassed: passed, testsFailed: failed, testsSkipped: skipped };
}

export async function runCycle08ReleaseGates(options) {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const commands = [];
  try {
    for (const [index, [name, args]] of required.entries()) commands.push(await runCommand(name, args, outputDir, index));
    const manifestPath = join(gameRoot, 'dist', 'build-manifest.json');
    const firstManifest = await readFile(manifestPath);
    const manifest = JSON.parse(firstManifest.toString('utf8'));
    invariant(manifest.version === '0.1.1' && manifest.clean === true && /^0\.1\.1\+[a-f0-9]{12}$/.test(manifest.buildId), 'Release gates require a clean exact 0.1.1 build');
    const fingerprintAudit = {
      ...await auditCycle08Fingerprints({ candidateCommit: manifest.commitSha }),
      candidateBuildId: manifest.buildId,
      commitSha: manifest.commitSha,
      sourceFingerprint: manifest.sourceFingerprint,
    };
    const fingerprintAuditPath = join(outputDir, 'fingerprint-audit-cycle08.json');
    const fingerprintAuditBytes = Buffer.from(`${JSON.stringify(fingerprintAudit, null, 2)}\n`);
    await writeFile(fingerprintAuditPath, fingerprintAuditBytes);

    const repeatBuild = await runCommand('npm run build (reproducibility)', ['run', 'build'], outputDir, commands.length);
    commands.push(repeatBuild);
    const secondManifest = await readFile(manifestPath);
    invariant(sha256(firstManifest) === sha256(secondManifest), 'Repeated clean build changed dist/build-manifest.json');
    commands.push(await runCommand('npm run release:audit (reproducibility)', ['run', 'release:audit'], outputDir, commands.length));

    const testCommand = commands.find((entry) => entry.name === 'npm test');
    invariant(testCommand, 'npm test evidence is missing');
    const testLog = await readFile(testCommand.logPath, 'utf8');
    const report = {
      schemaVersion: 1,
      cycle: '08',
      version: manifest.version,
      buildId: manifest.buildId,
      commitSha: manifest.commitSha,
      sourceFingerprint: manifest.sourceFingerprint,
      status: 'PASS',
      startedAt,
      completedAt: new Date().toISOString(),
      ...parseTestCounts(testLog),
      commands,
      fingerprintAuditPath,
      fingerprintAudit: { path: basename(fingerprintAuditPath), bytes: fingerprintAuditBytes.length, sha256: sha256(fingerprintAuditBytes) },
      reproducibility: {
        status: 'PASS',
        firstBuildManifestSha256: sha256(firstManifest),
        secondBuildManifestSha256: sha256(secondManifest),
      },
    };
    await writeFile(join(outputDir, 'automation-results.json'), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    const report = {
      schemaVersion: 1,
      cycle: '08',
      status: 'FAIL',
      startedAt,
      completedAt: new Date().toISOString(),
      commands,
      error: error instanceof Error ? error.message : String(error),
    };
    await writeFile(join(outputDir, 'automation-results.json'), `${JSON.stringify(report, null, 2)}\n`);
    throw error;
  }
}

async function main() {
  const outputDir = process.argv[2];
  invariant(outputDir, 'Usage: node scripts/run-cycle08-release-gates.mjs <output-directory>');
  const report = await runCycle08ReleaseGates({ outputDir });
  console.log(`Cycle 08 exact release gates PASS (${report.buildId}, ${report.testsPassed} tests, reproducible manifest)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
