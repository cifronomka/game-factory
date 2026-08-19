import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { gameRoot, projectPath, walk } from './lib.mjs';

const roots = ['src', 'scripts', 'tests'].map((name) => join(gameRoot, name));
const files = (await Promise.all(roots.map((root) => walk(root, (path) => /\.(?:js|mjs)$/.test(path))))).flat();
const forbidden = [/\bTODO\b/, /\bFIXME\b/, /debugger\s*;/, /document\.write\s*\(/];
const failures = [];

for (const file of files) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (syntax.status !== 0) failures.push(`${projectPath(file)}: ${syntax.stderr.trim()}`);
  const source = await readFile(file, 'utf8');
  for (const pattern of forbidden) if (pattern.test(source)) failures.push(`${projectPath(file)}: forbidden ${pattern}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`lint PASS (${files.length} modules)`);
