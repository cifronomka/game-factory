// @ts-check

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = resolve(gameRoot, '../..');
const gamePrefix = relative(repositoryRoot, gameRoot).split(sep).join('/');
const acceptedC07Commit = 'a17cdd65fd5af4ec236fd777aa5dd4723664a897';

export const cycle08FingerprintGroups = Object.freeze({
  gameplay: Object.freeze(['src/core', 'src/app', 'src/main.js']),
  shell: Object.freeze([
    'index.html',
    'src/presentation/index.js',
    'src/presentation/presentationController.js',
    'src/presentation/scene/layerOrder.js',
    'src/presentation/scene/optionalBitmap.js',
    'src/presentation/scene/spriteAnimator.js',
    'src/presentation/sceneVisualStateMapper.js',
    'src/presentation/types.js',
    'src/presentation/ui',
    'src/styles.css',
  ]),
  audio: Object.freeze(['src/presentation/audio', 'assets/audio']),
  platform: Object.freeze(['src/platforms']),
  flame: Object.freeze(['src/presentation/scene/flameRig.js', 'assets/flame']),
  environment: Object.freeze(['src/presentation/scene/environmentScene.js', 'assets/backgrounds']),
  host: Object.freeze([
    'src/presentation/scene/infernoScene.js',
    'assets/characters/character-inferno-host-main-v4.webp',
    'assets/characters/character-inferno-host-main-v4.json',
    'assets/characters/character-inferno-host-sentinel-v4.webp',
    'assets/characters/character-inferno-host-sentinel-v4.json',
  ]),
  steamRenderer: Object.freeze(['src/presentation/scene/steamEmitter.js']),
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function git(args, encoding = 'utf8') {
  const result = spawnSync(process.env.GIT_EXECUTABLE || 'git', args, {
    cwd: repositoryRoot,
    encoding,
    maxBuffer: 128 * 1024 * 1024,
  });
  invariant(result.status === 0, String(result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
  return result.stdout;
}

function pathsAtCommit(commit, roots) {
  const scoped = roots.map((path) => `${gamePrefix}/${path}`);
  const output = git(['ls-tree', '-r', '--name-only', commit, '--', ...scoped]);
  return String(output).split(/\r?\n/).filter(Boolean).sort();
}

function digestEntries(entries) {
  const hash = createHash('sha256');
  for (const entry of entries) {
    hash.update(entry.path);
    hash.update('\0');
    hash.update(entry.bytes);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

function baselineEntries(commit, paths) {
  return paths.map((path) => ({
    path,
    bytes: /** @type {Buffer} */ (git(['show', `${commit}:${path}`], null)),
  }));
}

export async function auditCycle08Fingerprints(options = {}) {
  const baselineCommit = options.baselineCommit ?? acceptedC07Commit;
  const candidateCommit = options.candidateCommit ?? 'HEAD';
  invariant(baselineCommit === acceptedC07Commit, 'Cycle 08 fingerprint baseline must be the accepted C07 commit');
  invariant(candidateCommit === 'HEAD' || /^[a-f0-9]{40}$/.test(candidateCommit), 'Cycle 08 fingerprint candidate must be HEAD or a full Git commit SHA');
  git(['cat-file', '-e', `${baselineCommit}^{commit}`]);
  git(['cat-file', '-e', `${candidateCommit}^{commit}`]);

  const results = {};
  for (const [name, roots] of Object.entries(cycle08FingerprintGroups)) {
    const scoped = roots.map((path) => `${gamePrefix}/${path}`);
    if (candidateCommit === 'HEAD') {
      const dirty = spawnSync(process.env.GIT_EXECUTABLE || 'git', ['diff', '--quiet', 'HEAD', '--', ...scoped], { cwd: repositoryRoot });
      invariant(dirty.status === 0, `${name}: frozen working-tree paths differ from HEAD`);
      const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...scoped]);
      invariant(String(untracked).trim() === '', `${name}: frozen working-tree paths contain untracked changes`);
    }
    const paths = pathsAtCommit(baselineCommit, roots);
    invariant(paths.length > 0, `${name}: frozen fingerprint group is empty`);
    const currentPaths = pathsAtCommit(candidateCommit, roots);
    invariant(JSON.stringify(currentPaths) === JSON.stringify(paths), `${name}: frozen file inventory changed`);
    const baselineSha256 = digestEntries(baselineEntries(baselineCommit, paths));
    const candidateSha256 = digestEntries(baselineEntries(candidateCommit, paths));
    invariant(candidateSha256 === baselineSha256, `${name}: frozen fingerprint changed from accepted C07`);
    results[name] = { status: 'PASS', files: paths.length, baselineSha256, candidateSha256 };
  }

  const manifestPath = `${gamePrefix}/assets/assets-manifest.json`;
  const selectAudioRegistry = (commit) => {
    const manifest = JSON.parse(String(git(['show', `${commit}:${manifestPath}`])));
    return Buffer.from(JSON.stringify({ audioAssets: manifest.audioAssets }));
  };
  const baselineAudioRegistry = selectAudioRegistry(baselineCommit);
  const candidateAudioRegistry = selectAudioRegistry(candidateCommit);
  const baselineAudioRegistrySha256 = sha256Buffer(baselineAudioRegistry);
  const candidateAudioRegistrySha256 = sha256Buffer(candidateAudioRegistry);
  invariant(candidateAudioRegistrySha256 === baselineAudioRegistrySha256, 'audioRegistry: frozen audio manifest mapping changed');
  results.audioRegistry = { status: 'PASS', files: 1, baselineSha256: baselineAudioRegistrySha256, candidateSha256: candidateAudioRegistrySha256 };

  return {
    schemaVersion: 1,
    cycle: '08',
    baselineBuildId: '0.1.0+a17cdd65fd5a',
    baselineCommit,
    candidateCommit: String(git(['rev-parse', candidateCommit])).trim(),
    groups: results,
    status: 'PASS',
  };
}

async function main() {
  const report = await auditCycle08Fingerprints();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
