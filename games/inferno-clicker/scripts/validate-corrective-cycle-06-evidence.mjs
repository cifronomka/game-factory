// @ts-check

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameRoot } from './lib.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

function inside(root, candidate) {
  const absolute = resolve(root, candidate);
  invariant(absolute === root || absolute.startsWith(`${root}${sep}`), `Unsafe evidence path: ${candidate}`);
  return absolute;
}

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }

export async function validateCorrectiveCycle06Evidence(options) {
  const evidenceDir = resolve(options.evidenceDir);
  invariant((await stat(evidenceDir)).isDirectory(), 'Evidence directory is missing');
  const distManifestPath = resolve(options.distManifestPath ?? join(gameRoot, 'dist/build-manifest.json'));
  const distManifestBytes = await readFile(distManifestPath);
  const distManifest = JSON.parse(distManifestBytes.toString('utf8'));
  const summary = await readJson(join(evidenceDir, 'summary.json'));
  invariant(summary.schemaVersion === 1 && summary.cycle === '06', 'Invalid Cycle 06 summary');
  invariant(summary.status === 'PASS', 'Cycle 06 summary is not PASS');
  invariant(summary.buildId === distManifest.buildId, 'Evidence build id does not match dist build');
  invariant(summary.sourceFingerprint === distManifest.sourceFingerprint, 'Evidence source fingerprint does not match dist build');
  invariant(summary.buildManifestSha256 === digest(distManifestBytes), 'Evidence build-manifest hash mismatch');
  invariant(summary.defects?.critical === 0 && summary.defects?.high === 0, 'Open Critical/High defects remain');

  const automation = await readJson(inside(evidenceDir, summary.passes?.automation));
  invariant(automation.status === 'PASS' && automation.testsPassed >= 170 && automation.testsFailed === 0, 'Automation pass is incomplete');
  invariant(automation.commands?.every((entry) => entry.status === 'PASS'), 'One or more required commands failed');
  invariant(automation.decodedTextureBytes <= 64 * 1024 * 1024, 'Decoded texture residency exceeds 64 MiB');
  invariant(automation.performance?.falseDowngrades === 0 && automation.performance?.toastVisible === false, 'Performance quality contract failed');

  const visual = await readJson(inside(evidenceDir, summary.passes?.visual));
  invariant(visual.status === 'PASS' && Array.isArray(visual.screenshots) && visual.screenshots.length >= 5, 'Visual pass is incomplete');
  invariant(visual.whiteMatteDefects === 0 && visual.ghostFrames === 0 && visual.ribbonRemnants === 0, 'Character visual defects remain');
  invariant(visual.steamBeforeContact === 0 && visual.hostMotionRegions >= 2, 'Impact/host visual contract failed');
  invariant(new Set(visual.viewports).has('390x844') && new Set(visual.viewports).has('1366x768'), 'Required mobile/desktop viewports are missing');
  for (const screenshot of visual.screenshots) {
    invariant(typeof screenshot.path === 'string' && SHA256.test(String(screenshot.sha256 ?? '')), 'Invalid screenshot inventory entry');
    const bytes = await readFile(inside(evidenceDir, screenshot.path));
    invariant(bytes.subarray(0, 8).equals(PNG_MAGIC), `Invalid PNG evidence: ${screenshot.path}`);
    invariant(digest(bytes) === screenshot.sha256, `Screenshot hash mismatch: ${screenshot.path}`);
  }

  const independent = await readJson(inside(evidenceDir, summary.passes?.independent));
  invariant(independent.status === 'PASS' && independent.independence === true && independent.decision === 'PASS', 'Independent review did not pass');
  invariant(typeof independent.reviewerId === 'string' && independent.reviewerId.length >= 3, 'Independent reviewer id is missing');
  invariant(independent.findingsCritical === 0 && independent.findingsHigh === 0, 'Independent review has Critical/High findings');

  return Object.freeze({
    schemaVersion: 1,
    cycle: '06',
    buildId: summary.buildId,
    evidence: relative(gameRoot, evidenceDir).split(sep).join('/'),
    screenshots: visual.screenshots.length,
    testsPassed: automation.testsPassed,
    decodedTextureBytes: automation.decodedTextureBytes,
    status: 'PASS',
  });
}

async function main() {
  const evidenceDir = process.argv[2];
  invariant(evidenceDir, 'Usage: node scripts/validate-corrective-cycle-06-evidence.mjs <evidence-dir>');
  const report = await validateCorrectiveCycle06Evidence({ evidenceDir });
  console.log(`corrective cycle 06 evidence PASS (${report.buildId}, ${report.screenshots} screenshots, ${report.testsPassed} tests)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
