import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { gameRoot, projectPath, walk } from './lib.mjs';

const modules = await walk(join(gameRoot, 'src'), (path) => path.endsWith('.js'));
const failures = [];
for (const file of modules) {
  const source = await readFile(file, 'utf8');
  if (!source.startsWith('// @ts-check')) failures.push(`${projectPath(file)}: missing // @ts-check`);
  for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    let target = resolve(dirname(file), match[1]);
    if (!target.endsWith('.js') && !target.endsWith('.json')) target += '.js';
    try { await access(target); } catch { failures.push(`${projectPath(file)}: missing import ${match[1]}`); }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`contract check PASS (${modules.length} browser modules)`);
