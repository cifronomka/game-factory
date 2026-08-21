// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateCorrectiveCycle06Evidence } from '../../scripts/validate-corrective-cycle-06-evidence.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'inferno-c06-evidence-'));
  const evidence = join(root, 'evidence');
  await mkdir(join(evidence, 'screens'), { recursive: true });
  const dist = { buildId: '0.1.0+abc123', sourceFingerprint: 'f'.repeat(64) };
  const distBytes = Buffer.from(`${JSON.stringify(dist)}\n`);
  await writeFile(join(root, 'build-manifest.json'), distBytes);
  const screenshots = [];
  for (let index = 0; index < 5; index += 1) {
    const bytes = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.from(`fixture-${index}`)]);
    const path = `screens/${index}.png`;
    await writeFile(join(evidence, path), bytes);
    screenshots.push({ path, sha256: sha(bytes) });
  }
  await writeFile(join(evidence, 'automation.json'), JSON.stringify({ status: 'PASS', testsPassed: 170, testsFailed: 0, commands: [{ name: 'npm test', status: 'PASS' }], decodedTextureBytes: 57_605_120, performance: { falseDowngrades: 0, toastVisible: false } }));
  await writeFile(join(evidence, 'visual.json'), JSON.stringify({ status: 'PASS', screenshots, whiteMatteDefects: 0, ghostFrames: 0, ribbonRemnants: 0, steamBeforeContact: 0, hostMotionRegions: 2, viewports: ['390x844', '1366x768'] }));
  await writeFile(join(evidence, 'independent.json'), JSON.stringify({ status: 'PASS', independence: true, decision: 'PASS', reviewerId: 'independent-qa', findingsCritical: 0, findingsHigh: 0 }));
  await writeFile(join(evidence, 'summary.json'), JSON.stringify({ schemaVersion: 1, cycle: '06', status: 'PASS', buildId: dist.buildId, sourceFingerprint: dist.sourceFingerprint, buildManifestSha256: sha(distBytes), defects: { critical: 0, high: 0 }, passes: { automation: 'automation.json', visual: 'visual.json', independent: 'independent.json' } }));
  return { evidenceDir: evidence, distManifestPath: join(root, 'build-manifest.json') };
}

test('Cycle 06 evidence validator accepts one exact build with three complete passes', async () => {
  const value = await fixture();
  const report = await validateCorrectiveCycle06Evidence(value);
  assert.equal(report.status, 'PASS');
  assert.equal(report.screenshots, 5);
});

test('Cycle 06 evidence validator rejects a corrupt screenshot inventory', async () => {
  const value = await fixture();
  const visualPath = join(value.evidenceDir, 'visual.json');
  const visual = JSON.parse(await readFile(visualPath, 'utf8'));
  visual.screenshots[0].sha256 = '0'.repeat(64);
  await writeFile(visualPath, JSON.stringify(visual));
  await assert.rejects(() => validateCorrectiveCycle06Evidence(value), /Screenshot hash mismatch/);
});
