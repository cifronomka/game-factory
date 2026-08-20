// @ts-check

import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameRoot as defaultGameRoot } from './lib.mjs';

const SHA256 = /^[a-f0-9]{64}$/;

/** @param {Buffer|string} value */
function digest(value) { return createHash('sha256').update(value).digest('hex'); }

/** @param {unknown} condition @param {string} message */
function invariant(condition, message) { if (!condition) throw new Error(message); }

/** @param {string} root @param {string} candidate */
function inside(root, candidate) {
  const absolute = resolve(root, candidate);
  invariant(absolute === root || absolute.startsWith(`${root}${sep}`), `Unsafe path: ${candidate}`);
  return absolute;
}

/** @param {{x:number,y:number,w:number,h:number}} a @param {{x:number,y:number,w:number,h:number}} b */
function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Validates authored animation metadata without pretending to perform perceptual
 * browser QA. Per-frame hashes are hashes of the exported frame pixels, not of
 * JSON rectangles; the export pipeline must write them into metadata.
 * @param {{root?:string,manifestPath?:string}} options
 */
export async function auditAnimationAssets(options = {}) {
  const root = resolve(options.root ?? defaultGameRoot);
  const manifestPath = resolve(options.manifestPath ?? join(root, 'assets/assets-manifest.json'));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  invariant(manifest.schemaVersion === 1 && Array.isArray(manifest.assets), 'Invalid assets manifest');
  invariant(typeof manifest.provenance === 'string' && manifest.provenance.length > 0, 'Missing manifest provenance');
  const provenancePath = inside(root, manifest.provenance);
  invariant((await stat(provenancePath)).isFile(), 'Missing provenance file');

  const animated = manifest.assets.filter((entry) => typeof entry.metadata === 'string');
  const reports = [];
  for (const entry of animated) {
    invariant(typeof entry.path === 'string' && typeof entry.id === 'string', 'Animation entry requires id/path');
    invariant(SHA256.test(String(entry.metadataSha256 ?? '')), `${entry.id}: missing metadataSha256`);
    const metadataPath = inside(root, entry.metadata);
    const metadataBytes = await readFile(metadataPath);
    invariant(digest(metadataBytes) === entry.metadataSha256, `${entry.id}: metadata hash mismatch`);
    const metadata = JSON.parse(metadataBytes.toString('utf8'));
    invariant(metadata.schemaVersion === 1, `${entry.id}: invalid metadata schema`);
    if (entry.id === 'CH-INFERNO-HOST' && Array.isArray(metadata.regions)) {
      invariant(metadata.regions.length >= 5, `${entry.id}: requires >=5 separately addressable spatial regions`);
      const regionIds = new Set();
      for (const region of metadata.regions) {
        invariant(typeof region.id === 'string' && region.id.length > 0 && !regionIds.has(region.id), `${entry.id}: invalid/duplicate region id`);
        regionIds.add(region.id);
        invariant([region.x, region.y, region.w, region.h].every(Number.isInteger), `${entry.id}/${region.id}: invalid region rectangle`);
        invariant(region.x >= 0 && region.y >= 0 && region.w > 0 && region.h > 0 && region.x + region.w <= entry.width && region.y + region.h <= entry.height, `${entry.id}/${region.id}: region outside source`);
      }
      invariant(metadata.runtimeContract?.independentMotion === true && metadata.runtimeContract?.wholePlateOnly === false, `${entry.id}: independent-motion runtime contract is required`);
      reports.push({ id: entry.id, kind: entry.kind, metadata: relative(root, metadataPath).split(sep).join('/'), metadataSha256: entry.metadataSha256, clips: [], spatialRegions: metadata.regions.length, runtimeContract: metadata.runtimeContract });
      continue;
    }
    invariant(Array.isArray(metadata.pivot) && metadata.pivot.length === 2 && metadata.pivot.every((v) => Number.isFinite(v) && v >= 0 && v <= 1), `${entry.id}: invalid pivot`);

    const clips = metadata.clips && typeof metadata.clips === 'object'
      ? Object.entries(metadata.clips)
      : [['loop', metadata]];
    const occupied = [];
    const clipReports = [];
    for (const [clipName, clipValue] of clips) {
      const clip = /** @type {any} */ (clipValue);
      invariant(Number.isFinite(clip.fps) && clip.fps > 0 && clip.fps <= 60, `${entry.id}/${clipName}: invalid fps`);
      invariant(typeof clip.loop === 'boolean', `${entry.id}/${clipName}: loop must be boolean`);
      invariant(Array.isArray(clip.frames) && clip.frames.length >= 4, `${entry.id}/${clipName}: requires >=4 frames`);
      const hashes = new Set();
      for (let index = 0; index < clip.frames.length; index += 1) {
        const frame = clip.frames[index];
        invariant([frame.x, frame.y, frame.w, frame.h].every(Number.isInteger), `${entry.id}/${clipName}/${index}: invalid frame rectangle`);
        invariant(frame.x >= 0 && frame.y >= 0 && frame.w > 0 && frame.h > 0, `${entry.id}/${clipName}/${index}: invalid frame bounds`);
        invariant(frame.x + frame.w <= entry.width && frame.y + frame.h <= entry.height, `${entry.id}/${clipName}/${index}: frame outside atlas`);
        invariant(SHA256.test(String(frame.sha256 ?? '')), `${entry.id}/${clipName}/${index}: missing pixel sha256`);
        invariant(!hashes.has(frame.sha256), `${entry.id}/${clipName}: duplicate frame hash`);
        hashes.add(frame.sha256);
        invariant(typeof frame.provenance === 'string' && frame.provenance.length > 0, `${entry.id}/${clipName}/${index}: missing provenance`);
        const durationMs = frame.durationMs ?? (1_000 / clip.fps);
        invariant(Number.isFinite(durationMs) && durationMs > 0, `${entry.id}/${clipName}/${index}: invalid duration`);
        for (const prior of occupied) invariant(!overlaps(frame, prior.rect), `${entry.id}: overlapping cells ${prior.label} and ${clipName}/${index}`);
        occupied.push({ rect: frame, label: `${clipName}/${index}` });
      }
      clipReports.push({ name: clipName, frames: clip.frames.length, fps: clip.fps, loop: clip.loop, uniquePixelHashes: hashes.size });
    }
    reports.push({ id: entry.id, kind: entry.kind, metadata: relative(root, metadataPath).split(sep).join('/'), metadataSha256: entry.metadataSha256, clips: clipReports });
  }

  const byId = new Map(reports.map((entry) => [entry.id, entry]));
  for (const family of ['LOW', 'MID', 'HIGH']) {
    for (const layer of ['CORE', 'OUTER']) {
      const id = `FL-${family}-${layer}`;
      const report = byId.get(id);
      invariant(report && report.clips[0].frames >= 8, `${id}: requires >=8 authored frames`);
    }
  }
  for (const [id, clips] of [
    ['CH-ASH-SERVANT', ['appearance', 'idle', 'inhale', 'blow']],
    ['CH-DEMONESS', ['appearance', 'idle', 'cast', 'hold']],
  ]) {
    const report = byId.get(id);
    invariant(report, `${id}: missing animated atlas`);
    for (const name of clips) invariant(report.clips.some((clip) => clip.name === name && clip.frames >= 4), `${id}: missing ${name} clip`);
  }
  const host = byId.get('CH-INFERNO-HOST');
  invariant(host?.spatialRegions >= 5 && host.runtimeContract?.independentMotion === true && host.runtimeContract?.wholePlateOnly === false, 'CH-INFERNO-HOST: >=5 spatial regions and independent-motion runtime contract are required');

  return Object.freeze({
    schemaVersion: 1,
    manifest: relative(root, manifestPath).split(sep).join('/'),
    provenanceSha256: digest(await readFile(provenancePath)),
    animatedAssets: reports,
    status: 'PASS',
  });
}

async function main() {
  const args = process.argv.slice(2);
  const valueAfter = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
  const report = await auditAnimationAssets({ root: valueAfter('--root'), manifestPath: valueAfter('--manifest') });
  const output = valueAfter('--json');
  if (output) {
    await writeFile(resolve(output), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`animation assets audit PASS (${report.animatedAssets.length} atlases)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
