import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { gameRoot, walk } from './lib.mjs';

const tests = await walk(join(gameRoot, 'tests'), (path) => path.endsWith('.test.js'));
if (!tests.length) {
  console.error('No test files found');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: gameRoot, stdio: 'inherit' });
process.exit(result.status ?? 1);
