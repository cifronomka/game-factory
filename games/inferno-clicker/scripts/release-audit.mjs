import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { gameRoot, walk } from './lib.mjs';

const dist = join(gameRoot, 'dist');
const manifest = JSON.parse(await readFile(join(dist, 'build-manifest.json'), 'utf8'));
if (!/^0\.1\.0\+(?:[a-f0-9]{12}|working\.[a-f0-9]{12})$/.test(manifest.buildId) || !/^[a-f0-9]{40}$/.test(manifest.commitSha) || !/^[a-f0-9]{64}$/.test(manifest.sourceFingerprint) || !Array.isArray(manifest.files)) throw new Error('Invalid build manifest');
const htmlSource = await readFile(join(dist, 'index.html'), 'utf8');
if (!htmlSource.includes(`<meta name="build-id" content="${manifest.buildId}">`)) throw new Error('Build identity is missing from index.html');

const actualFiles = await walk(dist, () => true);
const listedFiles = new Set(manifest.files.map((entry) => entry.path));
const releasePath = (path) => path.slice(dist.length + 1).split(sep).join('/');
const unlistedFiles = actualFiles
  .map(releasePath)
  .filter((path) => path !== 'build-manifest.json' && !listedFiles.has(path));
if (unlistedFiles.length) throw new Error(`Unlisted release files: ${unlistedFiles.join(', ')}`);
const forbiddenPath = /(?:^|\/)(?:src|tests|docs|visual-references|node_modules|dev)(?:\/|$)|(?:\.map|\.env|\.gitkeep|\.DS_Store)$/i;
const badPaths = actualFiles
  .map(releasePath)
  .filter((path) => forbiddenPath.test(path));
if (badPaths.length) throw new Error(`Forbidden release paths: ${badPaths.join(', ')}`);

for (const entry of manifest.files) {
  if (typeof entry.path !== 'string' || entry.path.startsWith('/') || entry.path.includes('..')) throw new Error(`Unsafe manifest path: ${entry.path}`);
  const path = join(dist, entry.path);
  const bytes = await readFile(path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== entry.sha256 || bytes.length !== entry.bytes) throw new Error(`Manifest mismatch: ${entry.path}`);
}

const textFiles = actualFiles.filter((path) => /\.(?:html|js|css|json)$/i.test(path));
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*['"][^'"]{12,}/i,
];
for (const path of textFiles) {
  const source = await readFile(path, 'utf8');
  if (/\b(?:TO[D]O|FIX[M]E)\b|debugger\s*;|allowDevMocks|DevPlatformService/.test(source)) throw new Error(`Dev marker in release: ${releasePath(path)}`);
  for (const pattern of secretPatterns) if (pattern.test(source)) throw new Error(`Potential secret in release: ${releasePath(path)}`);
  if (path.endsWith('.js')) {
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const target = resolve(dirname(path), match[1]);
      await access(target).catch(() => { throw new Error(`Broken import ${match[1]} in ${releasePath(path)}`); });
    }
  }
}

const total = (await Promise.all(actualFiles.map(async (path) => (await stat(path)).size))).reduce((sum, value) => sum + value, 0);
if (total > 15 * 1024 * 1024) throw new Error(`Release package budget exceeded: ${total}`);
if (manifest.clean !== true) throw new Error(`Release identity BLOCKED: ${manifest.buildId} was built from an uncommitted source tree`);
console.log(`release audit PASS (${actualFiles.length} files, ${total} bytes)`);
