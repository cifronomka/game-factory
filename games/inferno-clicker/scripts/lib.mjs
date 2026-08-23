import { createHash, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
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

export async function startVerifiedStaticServer(root, options = {}) {
  const nonce = randomBytes(18).toString('hex');
  const timeoutMs = options.timeoutMs ?? 10_000;
  const child = spawn(process.execPath, ['scripts/serve.mjs', '--root', resolve(root), '--port', '0', '--nonce', nonce], {
    cwd: gameRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let settled = false;
  const ready = new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      rejectReady(new Error(`Static server handshake timed out. ${output}`));
    }, timeoutMs);
    const consume = (chunk) => {
      output += chunk.toString();
      const match = output.match(/INFERNO_SERVER_READY (\{[^\r\n]+\})/u);
      if (!match || settled) return;
      try {
        const handshake = JSON.parse(match[1]);
        if (handshake.nonce !== nonce || handshake.root !== resolve(root) || !Number.isInteger(handshake.port) || handshake.port <= 0) {
          throw new Error('Static server returned a mismatched handshake.');
        }
        settled = true;
        clearTimeout(timer);
        resolveReady(handshake);
      } catch (error) {
        settled = true;
        clearTimeout(timer);
        rejectReady(error);
      }
    };
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    child.once('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectReady(new Error(`Static server exited before handshake (${code ?? signal}). ${output}`));
    });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectReady(error);
    });
  });
  try {
    const handshake = await ready;
    const baseUrl = `http://127.0.0.1:${handshake.port}`;
    const response = await fetch(`${baseUrl}/`);
    if (!response.ok || response.headers.get('x-inferno-server-nonce') !== nonce) {
      throw new Error(`Static server nonce probe failed (${response.status}).`);
    }
    await response.arrayBuffer();
    let stopPromise;
    const stop = () => {
      if (stopPromise) return stopPromise;
      stopPromise = new Promise((resolveStop, rejectStop) => {
        if (child.exitCode !== null || child.signalCode !== null) { resolveStop(); return; }
        let forced = false;
        const forceTimer = setTimeout(() => {
          forced = true;
          child.kill('SIGKILL');
        }, options.stopTimeoutMs ?? 3_000);
        const finalTimer = setTimeout(() => {
          rejectStop(new Error(`Static server did not exit after ${forced ? 'forced' : 'graceful'} termination. ${output}`));
        }, (options.stopTimeoutMs ?? 3_000) + 3_000);
        child.once('exit', () => {
          clearTimeout(forceTimer);
          clearTimeout(finalTimer);
          resolveStop();
        });
        child.kill();
      });
      return stopPromise;
    };
    return Object.freeze({
      process: child,
      baseUrl,
      nonce,
      output: () => output,
      stop,
    });
  } catch (error) {
    child.kill();
    throw error;
  }
}

export async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

export async function fileInfo(path) {
  const info = await stat(path);
  return { path: projectPath(path), bytes: info.size, sha256: await sha256(path) };
}

export async function verifyBuildPayload(root, manifest, options = {}) {
  const rootPath = resolve(root);
  const manifestFilename = options.manifestFilename ?? 'build-manifest.json';
  const rootInfo = await lstat(rootPath);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error(`Build root must be a real directory: ${rootPath}`);
  }
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.files)) {
    throw new Error('Build manifest must contain a files array.');
  }

  const expected = new Map();
  const expectedCaseFolded = new Set();
  for (const entry of manifest.files) {
    if (!entry || typeof entry !== 'object') throw new Error('Build manifest contains an invalid file entry.');
    const path = entry.path;
    const canonical = typeof path === 'string'
      && path.length > 0
      && !path.includes('\\')
      && !posix.isAbsolute(path)
      && posix.normalize(path) === path
      && path !== '.'
      && path !== manifestFilename
      && !path.startsWith('../');
    if (!canonical) throw new Error(`Build manifest contains an unsafe or non-canonical path: ${String(path)}`);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) {
      throw new Error(`Build manifest contains an invalid byte count for ${path}.`);
    }
    if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(entry.sha256)) {
      throw new Error(`Build manifest contains an invalid SHA-256 for ${path}.`);
    }
    const caseFolded = path.toLocaleLowerCase('en-US');
    if (expected.has(path) || expectedCaseFolded.has(caseFolded)) {
      throw new Error(`Build manifest contains a duplicate or case-colliding path: ${path}`);
    }
    expected.set(path, entry);
    expectedCaseFolded.add(caseFolded);
  }

  const actual = new Map();
  const actualCaseFolded = new Set();
  let manifestPath;
  async function collect(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      const relativePath = relative(rootPath, path).split(sep).join('/');
      if (item.isSymbolicLink()) throw new Error(`Build payload must not contain symbolic links: ${relativePath}`);
      if (item.isDirectory()) {
        await collect(path);
        continue;
      }
      if (!item.isFile()) throw new Error(`Build payload contains a non-file entry: ${relativePath}`);
      const caseFolded = relativePath.toLocaleLowerCase('en-US');
      if (actualCaseFolded.has(caseFolded)) throw new Error(`Build payload contains a case-colliding path: ${relativePath}`);
      actualCaseFolded.add(caseFolded);
      if (relativePath === manifestFilename) manifestPath = path;
      else actual.set(relativePath, path);
    }
  }
  await collect(rootPath);
  if (!manifestPath) throw new Error(`Build payload is missing ${manifestFilename}.`);

  const manifestBytes = await readFile(manifestPath);
  let diskManifest;
  try {
    diskManifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Build manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (JSON.stringify(diskManifest) !== JSON.stringify(manifest)) {
    throw new Error('Supplied build manifest does not match the manifest stored in the payload.');
  }

  const expectedPaths = [...expected.keys()].sort();
  const actualPaths = [...actual.keys()].sort();
  if (expectedPaths.length !== actualPaths.length
    || expectedPaths.some((path, index) => path !== actualPaths[index])) {
    const missing = expectedPaths.filter((path) => !actual.has(path));
    const unexpected = actualPaths.filter((path) => !expected.has(path));
    throw new Error(`Build payload file set does not match its manifest (missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}).`);
  }

  let payloadBytes = 0;
  for (const path of expectedPaths) {
    const bytes = await readFile(actual.get(path));
    const entry = expected.get(path);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== entry.bytes || digest !== entry.sha256) {
      throw new Error(`Build payload integrity mismatch for ${path}.`);
    }
    payloadBytes += bytes.length;
  }
  const unpackedBytes = payloadBytes + manifestBytes.length;
  if (!Number.isSafeInteger(manifest.unpackedBytes) || manifest.unpackedBytes !== unpackedBytes) {
    throw new Error(`Build unpacked byte count mismatch: manifest=${String(manifest.unpackedBytes)}, actual=${unpackedBytes}.`);
  }
  return Object.freeze({ fileCount: actualPaths.length, payloadBytes, unpackedBytes });
}

export async function buildIdentity() {
  const packageJson = JSON.parse(await readFile(join(gameRoot, 'package.json'), 'utf8'));
  const repositoryRoot = resolve(gameRoot, '../..');
  const gitExecutable = process.env.GIT_EXECUTABLE || 'git';
  const revision = spawnSync(gitExecutable, ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' });
  const commitSha = revision.status === 0 ? revision.stdout.trim() : '';
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
