// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  analyzeCycle08FramePixels,
  assertCycle08RenderManifestBinding,
  buildCycle08MatrixDescriptors,
  generateCycle08Evidence,
  parseCycle08EvidenceArgs,
  renderCycle08EvidenceReviewBundle,
  renderCycle08MatrixPng,
  renderCycle08MotionWebp,
} from '../../scripts/generate-cycle08-evidence.mjs';

const commitSha = `123456789abc${'d'.repeat(28)}`;
const sourceFingerprint = 'f'.repeat(64);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function manifestFixture(clean = true) {
  const root = await mkdtemp(join(tmpdir(), 'inferno-c08-generator-'));
  const distDir = join(root, 'dist');
  await mkdir(distDir, { recursive: true });
  const manifestPath = join(distDir, 'build-manifest.json');
  const manifest = {
    version: '0.1.1',
    commitSha,
    sourceFingerprint,
    clean,
    buildId: clean ? '0.1.1+123456789abc' : '0.1.1+working.ffffffffffff',
    files: [],
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  return { root, distDir, manifestPath };
}

async function transparentFrames() {
  const frames = [];
  for (let index = 0; index < 32; index += 1) {
    frames.push(await sharp({ create: { width: 12, height: 16, channels: 4, background: { r: index * 7 % 255, g: 60, b: 30, alpha: 0.85 } } }).png().toBuffer());
  }
  return frames;
}

test('Cycle 08 generator CLI requires human QA, automation, and baseline inputs', () => {
  assert.throws(() => parseCycle08EvidenceArgs([]), /--qa-review/);
  assert.throws(() => parseCycle08EvidenceArgs(['--qa-review', 'qa.json', '--automation-results', 'automation.json']), /--baseline-evidence-dir/);
  assert.equal(parseCycle08EvidenceArgs(['--help']).help, true);
  assert.deepEqual(parseCycle08EvidenceArgs(['--render-only', 'review-bundle']), {
    help: false,
    renderOnly: true,
    renderOutputDir: 'review-bundle',
    gameRoot: undefined,
    distDir: undefined,
    distManifestPath: undefined,
    assetsManifestPath: undefined,
  });
  assert.throws(() => parseCycle08EvidenceArgs(['--render-only', 'review-bundle', '--qa-review', 'qa.json']), /cannot be combined/);
  assert.throws(() => parseCycle08EvidenceArgs([
    '--qa-review', 'qa.json',
    '--automation-results', 'automation.json',
    '--baseline-evidence-dir', 'baseline',
  ]), /--rendered-evidence-dir/);
});

test('Cycle 08 generator fails closed before reading review inputs for a dirty dist build', async () => {
  const value = await manifestFixture(false);
  await assert.rejects(() => generateCycle08Evidence({
    gameRoot: value.root,
    distDir: value.distDir,
    distManifestPath: value.manifestPath,
    qaReviewPath: join(value.root, 'missing-qa.json'),
    automationResultsPath: join(value.root, 'missing-automation.json'),
    baselineEvidenceDir: join(value.root, 'missing-baseline'),
    renderedEvidenceDir: join(value.root, 'missing-render-bundle'),
  }), /clean exact dist build/);
});

test('Cycle 08 generator fails closed when required review inputs are omitted', async () => {
  await assert.rejects(() => generateCycle08Evidence(/** @type {any} */ ({})), /qa-review/);
  await assert.rejects(() => renderCycle08EvidenceReviewBundle(/** @type {any} */ ({})), /render-only/);
});

test('Cycle 08 final generation is cryptographically bound to the pre-reviewed render manifest', () => {
  const reviewed = Buffer.from('{"cycle":"08","artifact":"reviewed"}\n');
  const review = { renderManifestSha256: sha256(reviewed) };
  assert.equal(assertCycle08RenderManifestBinding(review, reviewed), review.renderManifestSha256);
  assert.throws(() => assertCycle08RenderManifestBinding(review, Buffer.from('{"cycle":"08","artifact":"regenerated"}\n')), /exact render-manifest SHA-256/);
});

test('Cycle 08 matrix schema contains exactly 48 physical viewport/DPR entries', () => {
  const descriptors = buildCycle08MatrixDescriptors();
  assert.equal(descriptors.length, 48);
  assert.equal(new Set(descriptors.map((entry) => `${entry.subject}:${entry.background}:${entry.viewport}:DPR${entry.dpr}`)).size, 48);
  for (const descriptor of descriptors) {
    assert.equal(descriptor.frameCount, 32);
    assert.equal(descriptor.physicalWidth, descriptor.viewportWidth * descriptor.dpr);
    assert.equal(descriptor.physicalHeight, descriptor.viewportHeight * descriptor.dpr);
    assert.match(descriptor.backgroundHex, /^#[a-f0-9]{6}$/);
    assert.equal(descriptor.renderer, 'sharp-decoded-webp-all-frame-matrix');
  }
  assert.deepEqual(Object.fromEntries(descriptors.slice(0, 24).filter((entry) => entry.viewport === '390x844' && entry.dpr === 1).map((entry) => [entry.background, entry.backgroundHex])), {
    black: '#000000',
    'dark-red': '#350b0b',
    'neutral-gray': '#777777',
  });
});

test('Cycle 08 negative-space audit distinguishes enclosed gap residue from authored opaque highlights', () => {
  const width = 10;
  const height = 10;
  const data = Buffer.alloc(width * height * 4);
  const pixel = (x, y, red, green, blue, alpha) => {
    const offset = (y * width + x) * 4;
    data[offset] = red; data[offset + 1] = green; data[offset + 2] = blue; data[offset + 3] = alpha;
  };
  for (let y = 2; y <= 7; y += 1) for (let x = 2; x <= 7; x += 1) {
    if (x === 2 || x === 7 || y === 2 || y === 7) pixel(x, y, 70, 35, 20, 255);
  }
  pixel(3, 2, 240, 240, 240, 128); // white partial-alpha residue on the enclosed gap boundary
  pixel(6, 2, 245, 245, 245, 255); // legitimate opaque pale highlight; must not count as boundary residue
  const metrics = analyzeCycle08FramePixels(data, width, { x: 0, y: 0, w: width, h: height });
  assert.equal(metrics.enclosedRegionCount, 1);
  assert.equal(metrics.enclosedTransparentPixels, 16);
  assert.equal(metrics.meaningfulEnclosedRegionCount, 1);
  assert.equal(metrics.meaningfulEnclosedTransparentPixels, 16);
  assert.equal(metrics.internalBoundaryPartialPixels, 1);
  assert.equal(metrics.internalNeutralBoundaryPixels, 1);
  assert.equal(metrics.detachedNeutralIslandPixels, 0);
  assert.ok(metrics.internalNeutralResidueRatio > 0);
});

test('Cycle 08 matrix renderer writes a genuine PNG at declared physical dimensions', async () => {
  const frames = await transparentFrames();
  const descriptor = buildCycle08MatrixDescriptors().find((entry) => entry.subject === 'ash-servant' && entry.viewport === '390x844' && entry.dpr === 1 && entry.background === 'black');
  const result = await renderCycle08MatrixPng({ frames, descriptor, frameWidth: 12, frameHeight: 16 });
  assert.equal(result.layout.columns * result.layout.rows, 32);
  const metadata = await sharp(result.png).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 390);
  assert.equal(metadata.height, 844);
});

test('Cycle 08 motion renderer encodes three genuine all-frame cycles with distinct timings', async () => {
  const frames = await transparentFrames();
  const normal = await renderCycle08MotionWebp({ frames, speed: 'normal', cycles: 3, width: 24, height: 32 });
  const slow = await renderCycle08MotionWebp({ frames, speed: 'slow', cycles: 3, width: 24, height: 32 });
  assert.equal(normal.pageCount, 96);
  assert.equal(slow.pageCount, 96);
  assert.notEqual(normal.frameDelayMs, slow.frameDelayMs);
  assert.notEqual(normal.durationMs, slow.durationMs);
  for (const result of [normal, slow]) {
    const metadata = await sharp(result.webp, { animated: true }).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.pages, 96);
    assert.equal(metadata.pageHeight, 32);
  }
});
