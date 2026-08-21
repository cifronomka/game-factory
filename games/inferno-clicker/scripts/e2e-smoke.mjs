import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { gameRoot } from './lib.mjs';

const port = 4189;
const child = spawn(process.execPath, ['scripts/serve.mjs', '--root', 'dist', '--port', String(port)], { cwd: gameRoot, stdio: 'ignore' });
try {
  await delay(250);
  const index = await fetch(`http://127.0.0.1:${port}/`);
  const html = await index.text();
  if (!index.ok || !html.includes('app/main.js') || !html.includes('build-id')) throw new Error('production entry failed');
  const main = await fetch(`http://127.0.0.1:${port}/app/main.js`);
  if (!main.ok || !(await main.text()).startsWith('// @ts-check')) throw new Error('main module failed');
  const platformIndex = await fetch(`http://127.0.0.1:${port}/app/platforms/index.js`);
  const platformSource = await platformIndex.text();
  if (!platformIndex.ok || platformSource.includes("./dev/index.js")) throw new Error('production platform index retains dev import');
  const missing = await fetch(`http://127.0.0.1:${port}/missing.asset`);
  if (missing.status !== 404) throw new Error('404 policy failed');
  console.log('E2E static-server smoke PASS');
} finally {
  child.kill('SIGTERM');
}
