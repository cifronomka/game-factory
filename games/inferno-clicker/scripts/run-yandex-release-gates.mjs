import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { gameRoot, walk } from './lib.mjs';

const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const reportRoot = join(gameRoot, 'reports/yandex-release-cycle-09');
const outputDir = join(reportRoot, `.staging-${process.pid}-${Date.now()}`);
await mkdir(outputDir, { recursive: true });
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const commands = [
  ['npm run lint', ['run', 'lint']],
  ['npm run typecheck', ['run', 'typecheck']],
  ['npm test', ['test']],
  ['npm run assets:build:yandex-background', ['run', 'assets:build:yandex-background']],
  ['npm run assets:build:cycle09', ['run', 'assets:build:cycle09']],
  ['npm run assets:build:cycle09-flame', ['run', 'assets:build:cycle09-flame']],
  ['npm run assets:build:cycle09-flare', ['run', 'assets:build:cycle09-flare']],
  ['npm run assets:build:yandex-compat', ['run', 'assets:build:yandex-compat']],
  ['npm run assets:manifest:yandex', ['run', 'assets:manifest:yandex']],
  ['npm run build:yandex:test', ['run', 'build:yandex:test']],
  ['npm run compat:audit:yandex', ['run', 'compat:audit:yandex']],
  ['npm run visual:matrix:yandex', ['run', 'visual:matrix:yandex']],
  ['npm run visual:runtime:yandex', ['run', 'visual:runtime:yandex']],
  ['npm run test:e2e:yandex', ['run', 'test:e2e:yandex']],
  ['npm run build:yandex', ['run', 'build:yandex']],
  ['npm run test:e2e:yandex:production', ['run', 'test:e2e:yandex:production']],
  ['npm run environment:audit:yandex', ['run', 'environment:audit:yandex']],
  ['npm run soak:yandex -- --allow-environment-blocker', ['run', 'soak:yandex', '--', '--allow-environment-blocker']],
  ['npm run release:audit:yandex', ['run', 'release:audit:yandex']],
];

function safeName(name, index) {
  return `${String(index + 1).padStart(2, '0')}-${name.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')}.log`;
}

async function run(name, args, index) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: gameRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      INFERNO_CYCLE09_EVIDENCE_DIR: outputDir,
    },
    maxBuffer: 192 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `${result.error.stack ?? result.error.message}\n` : ''}`;
  const logName = safeName(name, index);
  const logPath = join(outputDir, logName);
  await writeFile(logPath, output || `${name}: no output\n`);
  const bytes = await readFile(logPath);
  const command = {
    name,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status ?? -1,
    startedAt,
    completedAt: new Date().toISOString(),
    log: { path: logName, bytes: bytes.length, sha256: sha256(bytes) },
  };
  if (result.status !== 0) throw Object.assign(new Error(`${name} failed with exit code ${command.exitCode}`), { command });
  return command;
}

const startedAt = new Date().toISOString();
const results = [];
try {
  for (const [index, [name, args]] of commands.entries()) results.push(await run(name, args, index));
  const manifestPath = join(gameRoot, 'dist/build-manifest.json');
  const firstManifest = await readFile(manifestPath);
  const manifest = JSON.parse(firstManifest.toString('utf8'));
  if (manifest.version !== '1.0.0' || manifest.target !== 'yandex' || manifest.clean !== true) {
    throw new Error(`Release gates require a clean exact Yandex 1.0.0 build, got ${manifest.buildId}.`);
  }
  results.push(await run('npm run build:yandex reproducibility', ['run', 'build:yandex'], results.length));
  const secondManifest = await readFile(manifestPath);
  if (sha256(firstManifest) !== sha256(secondManifest)) throw new Error('Repeated Yandex build changed build-manifest.json.');
  results.push(await run('npm run release:audit:yandex reproducibility', ['run', 'release:audit:yandex'], results.length));

  const testLogName = results.find((item) => item.name === 'npm test')?.log.path;
  const testLog = testLogName ? await readFile(join(outputDir, testLogName), 'utf8') : '';
  const testsPassed = Number(testLog.match(/(?:^|\n)ℹ pass (\d+)/u)?.[1] ?? 0);
  const testsFailed = Number(testLog.match(/(?:^|\n)ℹ fail (\d+)/u)?.[1] ?? -1);
  const testsSkipped = Number(testLog.match(/(?:^|\n)ℹ skipped (\d+)/u)?.[1] ?? -1);
  if (testsPassed <= 0 || testsFailed !== 0 || testsSkipped !== 0) throw new Error('Unable to prove a zero-failure, zero-skip test run.');
  const soak = JSON.parse(await readFile(join(outputDir, 'soak-yandex.json'), 'utf8'));
  const environment = JSON.parse(await readFile(join(outputDir, 'environment-audit.json'), 'utf8'));
  if (!['PASS', 'BLOCKED_ENV'].includes(soak.status) || soak.releaseEligible !== true) throw new Error('Release soak has no valid terminal evidence.');
  if (!['PASS', 'BLOCKED_EXTERNAL'].includes(environment.status)) throw new Error('Environment audit has an invalid status.');
  const externalBlockers = [...(environment.missingRequiredEnvironments || [])];
  if (soak.status === 'BLOCKED_ENV') externalBlockers.push('Host compositor calibration cannot prove one or more required FPS thresholds.');

  const inventoryFiles = await walk(outputDir, () => true);
  const inventory = {
    schemaVersion: 1,
    cycle: '09',
    buildId: manifest.buildId,
    commitSha: manifest.commitSha,
    sourceFingerprint: manifest.sourceFingerprint,
    files: await Promise.all(inventoryFiles.map(async (path) => {
      const bytes = await readFile(path);
      return {
        path: relative(outputDir, path).split(sep).join('/'),
        bytes: bytes.length,
        sha256: sha256(bytes),
      };
    })),
  };
  const inventoryBytes = Buffer.from(`${JSON.stringify(inventory, null, 2)}\n`);
  await writeFile(join(outputDir, 'evidence-inventory.json'), inventoryBytes);
  const submissionMediaManifestBytes = await readFile(join(gameRoot, 'releases/yandex-submission-1.0.0/media/submission-media-manifest.json'));

  const report = {
    schemaVersion: 1,
    cycle: '09',
    target: 'yandex',
    version: manifest.version,
    buildId: manifest.buildId,
    commitSha: manifest.commitSha,
    sourceFingerprint: manifest.sourceFingerprint,
    buildManifestSha256: sha256(firstManifest),
    unpackedBytes: manifest.unpackedBytes,
    status: externalBlockers.length > 0 ? 'PASS_WITH_EXTERNAL_BLOCKERS' : 'PASS',
    startedAt,
    completedAt: new Date().toISOString(),
    testsPassed,
    testsFailed,
    testsSkipped,
    browserE2e: 'PASS',
    releaseSoak: soak.status,
    environmentStatus: environment.status,
    externalBlockers,
    reproducibleBuild: true,
    reproduciblePayload: true,
    reproducibleArchiveBytes: false,
    archivePolicy: 'create one validated RC and promote those exact bytes without rebuilding',
    evidenceInventory: 'evidence-inventory.json',
    evidenceInventorySha256: sha256(inventoryBytes),
    evidenceInventoryFiles: inventory.files.length,
    submissionMediaManifestSha256: sha256(submissionMediaManifestBytes),
    evidenceDirectory: `reports/yandex-release-cycle-09/${manifest.buildId}`,
    commands: results,
    packageAlwaysSeparate: true,
  };
  await writeFile(join(outputDir, 'automation-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  const exactOutputDir = join(reportRoot, manifest.buildId);
  try {
    await access(exactOutputDir);
    throw new Error(`Refusing to overwrite immutable exact-build evidence: ${exactOutputDir}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await rename(outputDir, exactOutputDir);
  console.log(`Yandex release gates ${report.status} (${report.buildId}, ${testsPassed} tests, browser E2E, soak ${report.releaseSoak}, reproducible build; evidence ${report.evidenceDirectory})`);
} catch (error) {
  if (error?.command) results.push(error.command);
  await writeFile(join(outputDir, 'automation-results.json'), `${JSON.stringify({
    schemaVersion: 1,
    cycle: '09',
    target: 'yandex',
    status: 'FAIL',
    startedAt,
    completedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    commands: results,
  }, null, 2)}\n`);
  throw error;
}
