// @ts-check

import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
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

async function auditEncodedCharacterPixels(path, entry, frames) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  invariant(info.width === entry.width && info.height === entry.height && info.channels === 4, `${entry.id}: encoded pixel dimensions mismatch`);
  let partialPixels = 0;
  let neutralBrightPartial = 0;
  let edgeAlphaPixels = 0;
  for (const frame of frames) {
    for (let y = frame.y; y < frame.y + frame.h; y += 1) {
      for (let x = frame.x; x < frame.x + frame.w; x += 1) {
        const offset = (y * info.width + x) * 4;
        const alpha = data[offset + 3];
        const edge = x < frame.x + 4 || y < frame.y + 4 || x >= frame.x + frame.w - 4 || y >= frame.y + frame.h - 4;
        if (edge && alpha > 0) edgeAlphaPixels += 1;
        if (alpha > 0 && alpha < 245) {
          partialPixels += 1;
          const r = data[offset]; const g = data[offset + 1]; const b = data[offset + 2];
          if (Math.max(r, g, b) - Math.min(r, g, b) < 24 && (r + g + b) / 3 > 160) neutralBrightPartial += 1;
        }
      }
    }
  }
  const matteRatio = neutralBrightPartial / Math.max(1, partialPixels);
  invariant(edgeAlphaPixels === 0, `${entry.id}: encoded alpha touches atlas-cell edge`);
  invariant(matteRatio <= 0.03, `${entry.id}: encoded neutral bright matte ratio exceeds 3%`);
  return { edgeAlphaPixels, matteRatio: Math.round(matteRatio * 100000) / 100000, partialPixels };
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
        if (entry.id.startsWith('CH-')) {
          invariant(frame.edgeAlphaPixels === 0, `${entry.id}/${clipName}/${index}: alpha touches atlas-cell edge`);
          invariant(Number(frame.matteRatio) <= 0.1, `${entry.id}/${clipName}/${index}: neutral bright matte ratio exceeds 10%`);
        }
        const durationMs = frame.durationMs ?? (1_000 / clip.fps);
        invariant(Number.isFinite(durationMs) && durationMs > 0, `${entry.id}/${clipName}/${index}: invalid duration`);
        for (const prior of occupied) invariant(!overlaps(frame, prior.rect), `${entry.id}: overlapping cells ${prior.label} and ${clipName}/${index}`);
        occupied.push({ rect: frame, label: `${clipName}/${index}` });
      }
      clipReports.push({ name: clipName, frames: clip.frames.length, fps: clip.fps, loop: clip.loop, uniquePixelHashes: hashes.size });
    }
    let encodedPixelAudit = null;
    if (entry.id.startsWith('CH-')) {
      const assetPath = inside(root, entry.path);
      try {
        if ((await stat(assetPath)).isFile()) encodedPixelAudit = await auditEncodedCharacterPixels(assetPath, entry, occupied.map(({ rect }) => rect));
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    reports.push({ id: entry.id, kind: entry.kind, metadata: relative(root, metadataPath).split(sep).join('/'), metadataSha256: entry.metadataSha256, clips: clipReports, encodedPixelAudit });
  }

  const byId = new Map(reports.map((entry) => [entry.id, entry]));
  for (const family of ['LOW', 'MID', 'HIGH']) {
    for (const layer of ['CORE', 'OUTER']) {
      const id = `FL-${family}-${layer}`;
      const report = byId.get(id);
      invariant(report && report.clips[0].frames >= 8, `${id}: requires >=8 authored frames`);
    }
  }
  for (const [prefix, clips] of [
    ['CH-ASH-SERVANT', ['IDLE', 'INHALE', 'BLOW', 'RECOVERY']],
    ['CH-DEMONESS', ['IDLE', 'CAST', 'HOLD', 'RECOVERY']],
  ]) {
    for (const name of clips) {
      const id = `${prefix}-${name}-C06`;
      const report = byId.get(id);
      invariant(report?.clips.some((clip) => clip.name === name.toLowerCase() && clip.frames === 8), `${id}: requires 8 unique authored ${name.toLowerCase()} frames`);
    }
  }
  for (const id of ['CH-INFERNO-HOST-MAIN-C06', 'CH-INFERNO-HOST-SENTINEL-C06']) {
    const host = byId.get(id);
    invariant(host?.clips.some((clip) => clip.name === 'ambient' && clip.frames >= 5), `${id}: requires >=5 authored internal-motion states`);
  }

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
