import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const gameRoot = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]+$/, '');

export async function walk(root, predicate = () => true) {
  const entries = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    const path = join(root, item.name);
    if (item.isDirectory()) entries.push(...await walk(path, predicate));
    else if (predicate(path)) entries.push(path);
  }
  return entries.sort();
}

export function projectPath(path) {
  return relative(gameRoot, path).split(sep).join('/');
}

export async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

export async function fileInfo(path) {
  const info = await stat(path);
  return { path: projectPath(path), bytes: info.size, sha256: await sha256(path) };
}

export async function buildIdentity() {
  const packageJson = JSON.parse(await readFile(join(gameRoot, 'package.json'), 'utf8'));
  const repositoryRoot = resolve(gameRoot, '../..');
  const gitDir = join(repositoryRoot, '.git');
  const head = (await readFile(join(gitDir, 'HEAD'), 'utf8')).trim();
  let commitSha = head;
  if (head.startsWith('ref: ')) {
    const ref = head.slice(5);
    try {
      commitSha = (await readFile(join(gitDir, ref), 'utf8')).trim();
    } catch {
      const packed = await readFile(join(gitDir, 'packed-refs'), 'utf8');
      commitSha = packed.split(/\r?\n/).find((line) => line.endsWith(` ${ref}`))?.split(' ')[0] ?? '';
    }
  }
  if (!/^[a-f0-9]{40}$/i.test(commitSha)) throw new Error('Unable to resolve Git commit for build identity');
  const shortCommitSha = commitSha.slice(0, 12);
  const runtimeRoots = ['index.html', 'package.json', 'src', 'assets', 'scripts'];
  const runtimeFiles = [];
  for (const root of runtimeRoots) {
    const path = join(gameRoot, root);
    const info = await stat(path);
    if (info.isDirectory()) runtimeFiles.push(...await walk(path, () => true));
    else runtimeFiles.push(path);
  }
  const fingerprint = createHash('sha256');
  for (const path of runtimeFiles.sort()) {
    fingerprint.update(projectPath(path));
    fingerprint.update('\0');
    fingerprint.update(await readFile(path));
    fingerprint.update('\0');
  }
  const sourceFingerprint = fingerprint.digest('hex');
  const gitExecutable = process.env.GIT_EXECUTABLE || 'git';
  const status = spawnSync(gitExecutable, ['status', '--porcelain', '--', '.gitignore', 'games/inferno-clicker'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  const clean = status.status === 0 && status.stdout.trim() === '';
  return {
    version: String(packageJson.version),
    commitSha,
    shortCommitSha,
    sourceFingerprint,
    clean,
    buildId: clean ? `${packageJson.version}+${shortCommitSha}` : `${packageJson.version}+working.${sourceFingerprint.slice(0, 12)}`,
  };
}
