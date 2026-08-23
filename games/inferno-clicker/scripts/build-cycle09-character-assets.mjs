// @ts-check

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { gameRoot } from './lib.mjs';
import { cycle08Specs, CYCLE08_SOURCE_ROOT } from './build-cycle08-character-assets.mjs';
import {
  defringe,
  extractCell,
  frameMetrics,
  normalizedSource,
  scrubPartialNeutralMatte,
} from './build-cycle06-character-assets.mjs';

const root = resolve(gameRoot);
const OPAQUE_ALPHA = 245;
const SHA256 = (value) => createHash('sha256').update(value).digest('hex');
const toRelative = (path) => relative(root, path).split(sep).join('/');

export const CYCLE09_SOURCE_ROOT = CYCLE08_SOURCE_ROOT;

const strictAlphaAudit = Object.freeze({
  matteRatioMax: 0.01,
  internalNeutralResidueRatioMax: 0.005,
  edgeAlphaPixelsMax: 0,
  transparentGutterPixelsMin: 4,
  sourceToAtlasUpscaleMax: 1,
  encodedAlphaExact: true,
  detachedPartialAlphaPixelsMax: 0,
});

/** @param {any} spec */
function cycle09Spec(spec) {
  const family = spec.output.includes('/ash-servant/') ? 'ash-servant' : 'demoness';
  const version = family === 'ash-servant' ? 'v7' : 'v8';
  const base = `assets/characters/${family}/${family}-${spec.clip}-${version}`;
  return Object.freeze({
    ...spec,
    cycle: '09',
    generatedBy: 'deterministic Cycle 09 alpha cleanup',
    output: `${base}.webp`,
    pngOutput: `${base}.png`,
    strictAlphaAudit,
    family,
    version,
  });
}

export const cycle09Specs = Object.freeze(cycle08Specs.map(cycle09Spec));

/** @param {Buffer} rgba */
function alphaChannel(rgba) {
  const alpha = Buffer.alloc(rgba.length / 4);
  for (let source = 3, target = 0; source < rgba.length; source += 4, target += 1) alpha[target] = rgba[source];
  return alpha;
}

/** @param {Buffer} data @param {number} width @param {number} height */
function assertRawFrame(data, width, height) {
  if (!Buffer.isBuffer(data) || data.length !== width * height * 4) {
    throw new Error(`Cycle 09 frame must be ${width}x${height} RGBA`);
  }
}

/**
 * Keep only the one-pixel antialias band that is immediately adjacent to the
 * opaque authored body. Detached low-alpha tiles are deleted, then every
 * retained edge pixel receives nearby opaque character RGB. Alpha is never
 * invented or promoted, so the operation is deterministic and conservative.
 *
 * @param {Buffer} data
 * @param {number} width
 * @param {number} height
 */
export function cleanCycle09Frame(data, width, height) {
  assertRawFrame(data, width, height);
  const source = Buffer.from(data);
  const contracted = Buffer.from(data);
  let removedDetachedPartialAlphaPixelCount = 0;

  const adjacentOpaque = (x, y) => {
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX === 0 && offsetY === 0) continue;
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
        if (source[(nextY * width + nextX) * 4 + 3] >= OPAQUE_ALPHA) return true;
      }
    }
    return false;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = source[offset + 3];
      if (alpha === 0) {
        contracted[offset] = 0;
        contracted[offset + 1] = 0;
        contracted[offset + 2] = 0;
        continue;
      }
      if (alpha >= OPAQUE_ALPHA || adjacentOpaque(x, y)) continue;
      contracted[offset] = 0;
      contracted[offset + 1] = 0;
      contracted[offset + 2] = 0;
      contracted[offset + 3] = 0;
      removedDetachedPartialAlphaPixelCount += 1;
    }
  }

  const defringed = defringe(contracted, width, height);
  const cleaned = scrubPartialNeutralMatte(defringed, width, height);
  let defringedRetainedPartialAlphaPixelCount = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    const alpha = contracted[offset + 3];
    if (alpha <= 0 || alpha >= OPAQUE_ALPHA) continue;
    if (contracted[offset] !== cleaned[offset]
      || contracted[offset + 1] !== cleaned[offset + 1]
      || contracted[offset + 2] !== cleaned[offset + 2]) {
      defringedRetainedPartialAlphaPixelCount += 1;
    }
  }

  return {
    data: cleaned,
    removedDetachedPartialAlphaPixelCount,
    defringedRetainedPartialAlphaPixelCount,
  };
}

/** @param {Buffer[]} frames @param {number} columns @param {number} rows @param {number} frameWidth @param {number} frameHeight */
function packFrames(frames, columns, rows, frameWidth, frameHeight) {
  const atlasWidth = columns * frameWidth;
  const atlasHeight = rows * frameHeight;
  const atlas = Buffer.alloc(atlasWidth * atlasHeight * 4);
  for (const [index, frame] of frames.entries()) {
    const left = index % columns * frameWidth;
    const top = Math.floor(index / columns) * frameHeight;
    for (let y = 0; y < frameHeight; y += 1) {
      const sourceStart = y * frameWidth * 4;
      const targetStart = ((top + y) * atlasWidth + left) * 4;
      frame.copy(atlas, targetStart, sourceStart, sourceStart + frameWidth * 4);
    }
  }
  return { data: atlas, width: atlasWidth, height: atlasHeight };
}

/** @param {Buffer} atlas @param {number} atlasWidth @param {number} left @param {number} top @param {number} width @param {number} height */
function extractRawFrame(atlas, atlasWidth, left, top, width, height) {
  const frame = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((top + y) * atlasWidth + left) * 4;
    atlas.copy(frame, y * width * 4, sourceStart, sourceStart + width * 4);
  }
  return frame;
}

/** @param {ReturnType<typeof frameMetrics>} metrics @param {any} spec @param {number} index @param {string} encoding */
function assertStrictMetrics(metrics, spec, index, encoding) {
  const prefix = `${spec.family}/${spec.clip}/${index}/${encoding}`;
  if (metrics.detachedPartialAlphaPixelCount !== 0) throw new Error(`${prefix}: detached partial alpha remains (${metrics.detachedPartialAlphaPixelCount})`);
  if (metrics.edgeAlphaPixels !== 0) throw new Error(`${prefix}: alpha touches the guarded cell edge`);
  if (metrics.transparentGutterPixels < strictAlphaAudit.transparentGutterPixelsMin) throw new Error(`${prefix}: transparent gutter is below 4px`);
  if (metrics.matteRatio > strictAlphaAudit.matteRatioMax) throw new Error(`${prefix}: neutral bright partial-alpha matte remains`);
  if (metrics.internalNeutralResidueRatio > strictAlphaAudit.internalNeutralResidueRatioMax) throw new Error(`${prefix}: internal neutral residue remains`);
}

/** @param {any} spec */
function assertCycle09Spec(spec) {
  const expectedVersion = spec.family === 'ash-servant' ? 'v7' : 'v8';
  if (spec.cycle !== '09' || spec.sourceRoot !== CYCLE09_SOURCE_ROOT || spec.version !== expectedVersion) throw new Error(`${spec.clip}: invalid Cycle 09 version/source contract`);
  if (spec.sourceColumns !== 4 || spec.sourceRows !== 2 || spec.columns !== 4 || spec.rows !== 2 || spec.indices.length !== 8) throw new Error(`${spec.clip}: Cycle 09 requires an eight-frame 4x2 atlas`);
  if (!spec.output.endsWith(`-${expectedVersion}.webp`) || !spec.pngOutput.endsWith(`-${expectedVersion}.png`)) throw new Error(`${spec.clip}: non-versioned Cycle 09 output`);
  if (!Array.isArray(spec.sockets) || spec.sockets.length !== 8) throw new Error(`${spec.clip}: missing socket metadata`);
}

/** @param {any} spec */
async function buildAtlas(spec) {
  assertCycle09Spec(spec);
  const sourcePath = join(root, CYCLE09_SOURCE_ROOT, spec.source);
  const source = await normalizedSource(sourcePath, false, 'smart-alpha');
  const frames = [];
  const cleanupDiagnostics = [];
  const sourceFrameMetrics = [];

  for (const sourceIndex of spec.indices) {
    const sourceColumn = sourceIndex % spec.sourceColumns;
    const sourceRow = Math.floor(sourceIndex / spec.sourceColumns);
    const sourceFrameWidth = Math.round((sourceColumn + 1) * source.width / spec.sourceColumns) - Math.round(sourceColumn * source.width / spec.sourceColumns);
    const sourceFrameHeight = Math.round((sourceRow + 1) * source.height / spec.sourceRows) - Math.round(sourceRow * source.height / spec.sourceRows);
    const sourceToAtlasUpscale = Math.round(Math.max(spec.frameWidth / sourceFrameWidth, spec.frameHeight / sourceFrameHeight) * 100000) / 100000;
    if (sourceToAtlasUpscale > 1) throw new Error(`${spec.clip}/${sourceIndex}: Cycle 08 source would be upscaled`);
    sourceFrameMetrics.push({ sourceFrameWidth, sourceFrameHeight, sourceToAtlasUpscale });

    const extracted = await extractCell(
      source,
      spec.sourceColumns,
      spec.sourceRows,
      sourceIndex,
      spec.frameWidth,
      spec.frameHeight,
      spec.componentMode,
      spec.preserveCellFraming,
      spec.framingScale,
    );
    const cleaned = cleanCycle09Frame(extracted, spec.frameWidth, spec.frameHeight);
    const metrics = frameMetrics(cleaned.data, spec.frameWidth, spec.frameHeight);
    assertStrictMetrics(metrics, spec, sourceIndex, 'approved-raw');
    frames.push(cleaned.data);
    cleanupDiagnostics.push(cleaned);
  }

  const packed = packFrames(frames, spec.columns, spec.rows, spec.frameWidth, spec.frameHeight);
  const outputPath = join(root, spec.output);
  const pngOutputPath = join(root, spec.pngOutput);
  await mkdir(dirname(outputPath), { recursive: true });

  const webpOptions = {
    quality: spec.quality ?? 92,
    alphaQuality: 100,
    smartSubsample: spec.smartSubsample ?? true,
    effort: spec.effort ?? 4,
  };
  const webpBytes = await sharp(packed.data, { raw: { width: packed.width, height: packed.height, channels: 4 } })
    .webp(webpOptions)
    .toBuffer();
  const pngBytes = await sharp(packed.data, { raw: { width: packed.width, height: packed.height, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
  await Promise.all([writeFile(outputPath, webpBytes), writeFile(pngOutputPath, pngBytes)]);

  const [decodedWebp, decodedPng] = await Promise.all([
    sharp(webpBytes, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(pngBytes, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  for (const decoded of [decodedWebp, decodedPng]) {
    if (decoded.info.width !== packed.width || decoded.info.height !== packed.height || decoded.info.channels !== 4) throw new Error(`${spec.clip}: encoded atlas geometry changed`);
    if (SHA256(alphaChannel(decoded.data)) !== SHA256(alphaChannel(packed.data))) throw new Error(`${spec.clip}: encoded atlas changed the approved alpha mask`);
  }
  if (!decodedPng.data.equals(packed.data)) throw new Error(`${spec.clip}: PNG fallback is not an exact RGBA copy`);

  const metadataFrames = frames.map((frame, index) => {
    const left = index % spec.columns * spec.frameWidth;
    const top = Math.floor(index / spec.columns) * spec.frameHeight;
    const webpFrame = extractRawFrame(decodedWebp.data, packed.width, left, top, spec.frameWidth, spec.frameHeight);
    const pngFrame = extractRawFrame(decodedPng.data, packed.width, left, top, spec.frameWidth, spec.frameHeight);
    const metrics = frameMetrics(frame, spec.frameWidth, spec.frameHeight);
    const webpMetrics = frameMetrics(webpFrame, spec.frameWidth, spec.frameHeight);
    const pngMetrics = frameMetrics(pngFrame, spec.frameWidth, spec.frameHeight);
    assertStrictMetrics(webpMetrics, spec, index, 'decoded-webp');
    assertStrictMetrics(pngMetrics, spec, index, 'decoded-png');
    const alphaSha256 = SHA256(alphaChannel(frame));
    return {
      x: left,
      y: top,
      w: spec.frameWidth,
      h: spec.frameHeight,
      durationMs: Math.round(100000 / spec.fps) / 100,
      sha256: SHA256(frame),
      alphaSha256,
      provenance: `Cycle 09 deterministic cleanup of approved Cycle 08 source ${spec.source}; detached partial alpha removal, retained-edge defringe, WebP plus exact PNG fallback`,
      sockets: spec.sockets[index],
      anatomicalScale: spec.anatomicalScale?.[index] ?? spec.anatomicalScale ?? 1,
      removedDetachedPartialAlphaPixelCount: cleanupDiagnostics[index].removedDetachedPartialAlphaPixelCount,
      defringedPixelCount: cleanupDiagnostics[index].defringedRetainedPartialAlphaPixelCount,
      ...sourceFrameMetrics[index],
      ...metrics,
      encodedAlphaSha256: SHA256(alphaChannel(webpFrame)),
      encodedAlphaExact: SHA256(alphaChannel(webpFrame)) === alphaSha256,
      pngEncodedAlphaSha256: SHA256(alphaChannel(pngFrame)),
      pngEncodedAlphaExact: SHA256(alphaChannel(pngFrame)) === alphaSha256,
      webpDecodedMatteRatio: webpMetrics.matteRatio,
      pngDecodedMatteRatio: pngMetrics.matteRatio,
      webpDetachedPartialAlphaPixelCount: webpMetrics.detachedPartialAlphaPixelCount,
      pngDetachedPartialAlphaPixelCount: pngMetrics.detachedPartialAlphaPixelCount,
    };
  });

  const metadata = {
    schemaVersion: 2,
    cycle: '09',
    atlasWidth: packed.width,
    atlasHeight: packed.height,
    frameWidth: spec.frameWidth,
    frameHeight: spec.frameHeight,
    pivot: spec.pivot,
    transparentGutterPixels: 6,
    packing: 'Cycle 09 clip-split atlas; Cycle 08 authored poses retained exactly; detached partial-alpha contraction and edge defringe; WebP with PNG fallback',
    encoding: { codec: 'WebP', ...webpOptions, bytes: webpBytes.length, sha256: SHA256(webpBytes) },
    fallbackEncoding: { codec: 'PNG', compressionLevel: 9, adaptiveFiltering: false, bytes: pngBytes.length, sha256: SHA256(pngBytes) },
    alphaCleanup: {
      strategy: 'opaque-adjacent-partial-alpha-contraction',
      opaqueAlphaThreshold: OPAQUE_ALPHA,
      retainedPartialAlphaDistancePixels: 1,
      adjacency: '8-neighbour',
      removedDetachedPartialAlphaPixelCount: cleanupDiagnostics.reduce((sum, entry) => sum + entry.removedDetachedPartialAlphaPixelCount, 0),
      defringedRetainedPartialAlphaPixelCount: cleanupDiagnostics.reduce((sum, entry) => sum + entry.defringedRetainedPartialAlphaPixelCount, 0),
      sourceNormalization: source.alphaCleanup,
    },
    strictAlphaAudit,
    sourceSheet: `${CYCLE09_SOURCE_ROOT}/${spec.source}`,
    sourceSheetSha256: SHA256(await readFile(sourcePath)),
    atlasSha256: SHA256(webpBytes),
    pngFallbackSha256: SHA256(pngBytes),
    clips: { [spec.clip]: { fps: spec.fps, loop: spec.loop, frames: metadataFrames } },
  };
  await writeFile(outputPath.replace(/\.webp$/i, '.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`${toRelative(outputPath)} + ${toRelative(pngOutputPath)} ${packed.width}x${packed.height} ${spec.clip}:8 removed:${metadata.alphaCleanup.removedDetachedPartialAlphaPixelCount}`);
}

export async function buildCycle09CharacterAssets() {
  for (const spec of cycle09Specs) await buildAtlas(spec);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildCycle09CharacterAssets().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
