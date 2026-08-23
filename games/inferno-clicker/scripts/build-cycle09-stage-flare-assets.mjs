import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { buildIdentity, gameRoot } from './lib.mjs';

const SOURCE_BASE = 'assets/flame/transitions/stage-flare-v2';
const TARGET_BASE = 'assets/flame/transitions/stage-flare-v3';
const EVIDENCE_ROOT = process.env.INFERNO_CYCLE09_EVIDENCE_DIR
  ? (isAbsolute(process.env.INFERNO_CYCLE09_EVIDENCE_DIR)
      ? process.env.INFERNO_CYCLE09_EVIDENCE_DIR
      : join(gameRoot, process.env.INFERNO_CYCLE09_EVIDENCE_DIR))
  : join(gameRoot, 'reports/yandex-release-cycle-09-working');
const REVIEW_DIRECTORY = join(EVIDENCE_ROOT, 'visual/stage-flare-v3');
const ALPHA_FLOOR = 15;
const SEARCH_RADIUS = 6;
const MAXIMUM_EDGE_PASSES = 12;
const REVIEW_BACKGROUNDS = Object.freeze([
  Object.freeze({ id: 'black', color: Object.freeze({ r: 0, g: 0, b: 0, alpha: 1 }) }),
  Object.freeze({ id: 'neutral-gray', color: Object.freeze({ r: 92, g: 92, b: 92, alpha: 1 }) }),
  Object.freeze({ id: 'dark-red', color: Object.freeze({ r: 82, g: 8, b: 8, alpha: 1 }) }),
]);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function colorStats(r, g, b) {
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  return Object.freeze({ maximum, saturation: maximum === 0 ? 0 : (maximum - minimum) / maximum });
}

function residueClass(r, g, b) {
  const { maximum, saturation } = colorStats(r, g, b);
  return Object.freeze({
    neutral: saturation < 0.32 && maximum < 245,
    cool: maximum < 248 && (g > r * 1.03 || b > r * 0.9),
  });
}

function isProblematicEdgeColor(r, g, b) {
  const residue = residueClass(r, g, b);
  return residue.neutral || residue.cool;
}

function isWarmSourceColor(r, g, b) {
  const { maximum, saturation } = colorStats(r, g, b);
  return !isProblematicEdgeColor(r, g, b)
    && r >= g * 0.9
    && r >= b * 1.08
    && (saturation >= 0.32 || maximum >= 248);
}

function isBoundaryPixel(pixels, width, height, x, y) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return true;
      if (pixels[(nextY * width + nextX) * 4 + 3] === 0) return true;
    }
  }
  return false;
}

function connectedComponents(pixels, width, height) {
  const seen = new Uint8Array(width * height);
  const components = [];
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (seen[pixel] || pixels[pixel * 4 + 3] === 0) continue;
    const members = [];
    const stack = [pixel];
    seen[pixel] = 1;
    while (stack.length > 0) {
      const current = stack.pop();
      members.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (!seen[next] && pixels[next * 4 + 3] > 0) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
    }
    components.push(members);
  }
  components.sort((left, right) => right.length - left.length || left[0] - right[0]);
  return components;
}

function clearPixel(pixels, pixel) {
  const offset = pixel * 4;
  pixels[offset] = 0;
  pixels[offset + 1] = 0;
  pixels[offset + 2] = 0;
  pixels[offset + 3] = 0;
}

function normalizedTransparentRgb(pixels) {
  const normalized = Buffer.from(pixels);
  for (let offset = 0; offset < normalized.length; offset += 4) {
    if (normalized[offset + 3] !== 0) continue;
    normalized[offset] = 0;
    normalized[offset + 1] = 0;
    normalized[offset + 2] = 0;
  }
  return normalized;
}

function keepLargestComponent(pixels, width, height) {
  const components = connectedComponents(pixels, width, height);
  let removed = 0;
  for (const component of components.slice(1)) {
    removed += component.length;
    for (const pixel of component) clearPixel(pixels, pixel);
  }
  return Object.freeze({ componentCountBefore: components.length, removed });
}

function nearestWarmColor(pixels, width, height, originX, originY) {
  for (let radius = 1; radius <= SEARCH_RADIUS; radius += 1) {
    const candidates = [];
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = originX + dx;
        const y = originY + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const offset = (y * width + x) * 4;
        const alpha = pixels[offset + 3];
        if (alpha === 0) continue;
        const r = pixels[offset];
        const g = pixels[offset + 1];
        const b = pixels[offset + 2];
        if (isWarmSourceColor(r, g, b)) {
          candidates.push(Object.freeze({ alpha, b, g, r, distanceSquared: dx * dx + dy * dy, offset }));
        }
      }
    }
    if (candidates.length > 0) {
      candidates.sort((left, right) => left.distanceSquared - right.distanceSquared || right.alpha - left.alpha || left.offset - right.offset);
      const { r, g, b } = candidates[0];
      return Object.freeze({ r, g, b });
    }
  }
  return null;
}

function analyzeFrame(pixels, width, height) {
  const components = connectedComponents(pixels, width, height);
  let activePixelCount = 0;
  let boundaryPixelCount = 0;
  let neutralEdgePixelCount = 0;
  let coolEdgePixelCount = 0;
  let problematicEdgePixelCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (pixels[offset + 3] === 0) continue;
      activePixelCount += 1;
      if (!isBoundaryPixel(pixels, width, height, x, y)) continue;
      boundaryPixelCount += 1;
      const residue = residueClass(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      if (residue.neutral) neutralEdgePixelCount += 1;
      if (residue.cool) coolEdgePixelCount += 1;
      if (residue.neutral || residue.cool) problematicEdgePixelCount += 1;
    }
  }
  return Object.freeze({
    activePixelCount,
    boundaryPixelCount,
    componentCount: components.length,
    detachedAlphaPixelCount: components.slice(1).reduce((sum, component) => sum + component.length, 0),
    neutralEdgePixelCount,
    coolEdgePixelCount,
    problematicEdgePixelCount,
  });
}

function cleanFrame(source, width, height) {
  const pixels = Buffer.from(source);
  let removedLowAlphaPixelCount = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const alpha = pixels[pixel * 4 + 3];
    if (alpha > 0 && alpha <= ALPHA_FLOOR) {
      clearPixel(pixels, pixel);
      removedLowAlphaPixelCount += 1;
    } else if (alpha === 0) {
      clearPixel(pixels, pixel);
    }
  }

  const firstComponentPass = keepLargestComponent(pixels, width, height);
  let recoloredNeutralOrCoolEdgePixelCount = 0;
  let removedUnrecoverableEdgePixelCount = 0;
  let laterDetachedRemovalCount = 0;
  for (let pass = 0; pass < MAXIMUM_EDGE_PASSES; pass += 1) {
    const replacements = [];
    const removals = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        if (pixels[offset + 3] === 0 || !isBoundaryPixel(pixels, width, height, x, y)) continue;
        if (!isProblematicEdgeColor(pixels[offset], pixels[offset + 1], pixels[offset + 2])) continue;
        const warm = nearestWarmColor(pixels, width, height, x, y);
        if (warm) replacements.push(Object.freeze({ offset, ...warm }));
        else removals.push(y * width + x);
      }
    }
    for (const replacement of replacements) {
      pixels[replacement.offset] = replacement.r;
      pixels[replacement.offset + 1] = replacement.g;
      pixels[replacement.offset + 2] = replacement.b;
    }
    for (const pixel of removals) clearPixel(pixels, pixel);
    recoloredNeutralOrCoolEdgePixelCount += replacements.length;
    removedUnrecoverableEdgePixelCount += removals.length;
    if (removals.length > 0) laterDetachedRemovalCount += keepLargestComponent(pixels, width, height).removed;
    if (replacements.length === 0 && removals.length === 0) break;
  }
  laterDetachedRemovalCount += keepLargestComponent(pixels, width, height).removed;
  const audit = analyzeFrame(pixels, width, height);
  if (audit.componentCount !== 1 || audit.detachedAlphaPixelCount !== 0) throw new Error('Cleaned flare frame still has detached alpha.');
  if (audit.neutralEdgePixelCount !== 0 || audit.coolEdgePixelCount !== 0) throw new Error('Cleaned flare frame still has neutral/cool edge residue.');
  return Object.freeze({
    pixels,
    metrics: Object.freeze({
      ...audit,
      removedLowAlphaPixelCount,
      removedDetachedAlphaPixelCount: firstComponentPass.removed + laterDetachedRemovalCount,
      recoloredNeutralOrCoolEdgePixelCount,
      removedUnrecoverableEdgePixelCount,
      sourceComponentCount: firstComponentPass.componentCountBefore,
    }),
  });
}

function extractFrame(atlas, atlasWidth, frame) {
  const pixels = Buffer.alloc(frame.w * frame.h * 4);
  for (let y = 0; y < frame.h; y += 1) {
    const sourceStart = ((frame.y + y) * atlasWidth + frame.x) * 4;
    atlas.copy(pixels, y * frame.w * 4, sourceStart, sourceStart + frame.w * 4);
  }
  return pixels;
}

function insertFrame(atlas, atlasWidth, frame, pixels) {
  for (let y = 0; y < frame.h; y += 1) {
    const sourceStart = y * frame.w * 4;
    const targetStart = ((frame.y + y) * atlasWidth + frame.x) * 4;
    pixels.copy(atlas, targetStart, sourceStart, sourceStart + frame.w * 4);
  }
}

function summarizeFrames(frames) {
  const fields = [
    'activePixelCount',
    'boundaryPixelCount',
    'removedLowAlphaPixelCount',
    'removedDetachedAlphaPixelCount',
    'recoloredNeutralOrCoolEdgePixelCount',
    'removedUnrecoverableEdgePixelCount',
    'detachedAlphaPixelCount',
    'neutralEdgePixelCount',
    'coolEdgePixelCount',
    'problematicEdgePixelCount',
  ];
  return Object.freeze(Object.fromEntries(fields.map((field) => [field, frames.reduce((sum, frame) => sum + frame[field], 0)])));
}

async function buildReviewMatrix(png, width, height) {
  const panels = await Promise.all(REVIEW_BACKGROUNDS.map(({ color }) => sharp({
    create: { width, height, channels: 4, background: color },
  }).composite([{ input: png, blend: 'over' }]).png({ compressionLevel: 9 }).toBuffer()));
  const matrix = await sharp({
    create: { width: width * panels.length, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  }).composite(panels.map((input, index) => ({ input, left: index * width, top: 0 }))).png({ compressionLevel: 9 }).toBuffer();
  const path = join(REVIEW_DIRECTORY, 'stage-flare-v3-black-neutral-gray-dark-red.png');
  await writeFile(path, matrix);
  return Object.freeze({
    path: path.slice(gameRoot.length + 1).replaceAll('\\', '/'),
    bytes: matrix.length,
    sha256: sha256(matrix),
    width: width * panels.length,
    height,
  });
}

await mkdir(REVIEW_DIRECTORY, { recursive: true });
const identity = await buildIdentity();
const sourceWebp = await readFile(join(gameRoot, `${SOURCE_BASE}.webp`));
const sourceMetadataBytes = await readFile(join(gameRoot, `${SOURCE_BASE}.json`));
const sourceMetadata = JSON.parse(sourceMetadataBytes);
const decodedSource = await sharp(sourceWebp, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const atlas = Buffer.alloc(decodedSource.info.width * decodedSource.info.height * 4);
const frameMetrics = [];
const targetFrames = [];
for (let index = 0; index < sourceMetadata.frames.length; index += 1) {
  const sourceFrame = sourceMetadata.frames[index];
  const sourcePixels = normalizedTransparentRgb(extractFrame(decodedSource.data, decodedSource.info.width, sourceFrame));
  const sourceAudit = analyzeFrame(sourcePixels, sourceFrame.w, sourceFrame.h);
  const cleaned = cleanFrame(sourcePixels, sourceFrame.w, sourceFrame.h);
  insertFrame(atlas, decodedSource.info.width, sourceFrame, cleaned.pixels);
  const decodedRgbaSha256 = sha256(cleaned.pixels);
  frameMetrics.push(Object.freeze({ index, source: sourceAudit, ...cleaned.metrics, decodedRgbaSha256 }));
  targetFrames.push(Object.freeze({
    ...sourceFrame,
    sha256: decodedRgbaSha256,
    provenance: `deterministically cleaned Cycle 09 transition flare frame ${index}; decoded RGBA crop from stage-flare-v3.webp`,
  }));
}

const png = await sharp(atlas, { raw: { width: decodedSource.info.width, height: decodedSource.info.height, channels: 4 } })
  .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
  .toBuffer();
const webp = await sharp(atlas, { raw: { width: decodedSource.info.width, height: decodedSource.info.height, channels: 4 } })
  .webp({ lossless: true, quality: 100, alphaQuality: 100, effort: 4, smartSubsample: false })
  .toBuffer();
const [decodedPng, decodedWebp] = await Promise.all([
  sharp(png).ensureAlpha().raw().toBuffer(),
  sharp(webp).ensureAlpha().raw().toBuffer(),
]);
const normalizedPng = normalizedTransparentRgb(decodedPng);
const normalizedWebp = normalizedTransparentRgb(decodedWebp);
if (!normalizedPng.equals(atlas) || !normalizedWebp.equals(atlas) || !normalizedPng.equals(normalizedWebp)) {
  throw new Error('Stage flare PNG/WebP exact visible decoded RGBA parity failed.');
}

const totals = summarizeFrames(frameMetrics);
const sourceTotals = Object.freeze({
  componentCount: frameMetrics.reduce((sum, frame) => sum + frame.source.componentCount, 0),
  detachedAlphaPixelCount: frameMetrics.reduce((sum, frame) => sum + frame.source.detachedAlphaPixelCount, 0),
  neutralEdgePixelCount: frameMetrics.reduce((sum, frame) => sum + frame.source.neutralEdgePixelCount, 0),
  coolEdgePixelCount: frameMetrics.reduce((sum, frame) => sum + frame.source.coolEdgePixelCount, 0),
  problematicEdgePixelCount: frameMetrics.reduce((sum, frame) => sum + frame.source.problematicEdgePixelCount, 0),
});
const backgroundAudits = REVIEW_BACKGROUNDS.map(({ id, color }) => Object.freeze({
  id,
  color,
  boundaryPixelCount: totals.boundaryPixelCount,
  detachedAlphaPixelCount: totals.detachedAlphaPixelCount,
  neutralEdgePixelCount: totals.neutralEdgePixelCount,
  coolEdgePixelCount: totals.coolEdgePixelCount,
}));
if (backgroundAudits.some((audit) => audit.detachedAlphaPixelCount !== 0 || audit.neutralEdgePixelCount !== 0 || audit.coolEdgePixelCount !== 0)) {
  throw new Error('Stage flare background audit failed.');
}
const metadata = Object.freeze({
  ...sourceMetadata,
  frames: targetFrames,
  version: 'v3',
  sourceAtlas: `${SOURCE_BASE}.webp`,
  sourceAtlasSha256: sha256(sourceWebp),
  sourceMetadata: `${SOURCE_BASE}.json`,
  sourceMetadataSha256: sha256(sourceMetadataBytes),
  alphaCleanup: Object.freeze({
    algorithm: 'C09 deterministic alpha-floor + per-frame largest 8-connected component + nearest warm boundary RGB transfer',
    algorithmVersion: 'stage-flare-c09-v1',
    alphaFloorInclusive: ALPHA_FLOOR,
    nearestWarmSearchRadius: SEARCH_RADIUS,
    maximumEdgePasses: MAXIMUM_EDGE_PASSES,
    pngWebpDecodedRgbaParity: true,
    decodedRgbaSha256: sha256(atlas),
    sourceAudit: sourceTotals,
    ...totals,
    backgroundAudits,
    frames: frameMetrics,
  }),
});
await Promise.all([
  writeFile(join(gameRoot, `${TARGET_BASE}.png`), png),
  writeFile(join(gameRoot, `${TARGET_BASE}.webp`), webp),
  writeFile(join(gameRoot, `${TARGET_BASE}.json`), `${JSON.stringify(metadata, null, 2)}\n`),
]);
const review = await buildReviewMatrix(png, decodedSource.info.width, decodedSource.info.height);
await writeFile(join(REVIEW_DIRECTORY, 'stage-flare-v3-audit.json'), `${JSON.stringify({
  schemaVersion: 1,
  generatedBy: 'scripts/build-cycle09-stage-flare-assets.mjs',
  generatedAt: new Date().toISOString(),
  algorithmVersion: 'stage-flare-c09-v1',
  sourceFingerprint: identity.sourceFingerprint,
  source: Object.freeze({
    webp: `${SOURCE_BASE}.webp`,
    webpSha256: sha256(sourceWebp),
    metadata: `${SOURCE_BASE}.json`,
    metadataSha256: sha256(sourceMetadataBytes),
  }),
  output: Object.freeze({
    webp: `${TARGET_BASE}.webp`,
    webpBytes: webp.length,
    webpSha256: sha256(webp),
    png: `${TARGET_BASE}.png`,
    pngBytes: png.length,
    pngSha256: sha256(png),
    metadata: `${TARGET_BASE}.json`,
    width: decodedSource.info.width,
    height: decodedSource.info.height,
  }),
  contract: Object.freeze({
    frames: targetFrames.length,
    grid: '4x2',
    frameWidth: sourceMetadata.frameWidth,
    frameHeight: sourceMetadata.frameHeight,
    fps: sourceMetadata.fps,
    loop: sourceMetadata.loop,
    pivot: sourceMetadata.pivot,
    phaseOffsetFrames: sourceMetadata.phaseOffsetFrames ?? null,
  }),
  metrics: totals,
  sourceMetrics: sourceTotals,
  backgroundAudits,
  pngWebpDecodedRgbaParity: true,
  decodedRgbaSha256: sha256(atlas),
  review,
}, null, 2)}\n`);

console.log(`Cycle 09 stage flare cleanup PASS (${targetFrames.length} frames; source ${sourceTotals.detachedAlphaPixelCount} detached + ${sourceTotals.problematicEdgePixelCount} neutral/cool edge pixels; output residuals 0 on black/gray/red; PNG/WebP parity exact)`);
