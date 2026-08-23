import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { buildIdentity, gameRoot } from './lib.mjs';

const FAMILIES = Object.freeze(['low', 'mid', 'high']);
const EDGE_ALPHA_CAPS = Object.freeze({ 1: 72, 2: 160, 3: 224 });
const MATTE_ALPHA_CAP = 24;
const EVIDENCE_ROOT = process.env.INFERNO_CYCLE09_EVIDENCE_DIR
  ? (isAbsolute(process.env.INFERNO_CYCLE09_EVIDENCE_DIR)
      ? process.env.INFERNO_CYCLE09_EVIDENCE_DIR
      : join(gameRoot, process.env.INFERNO_CYCLE09_EVIDENCE_DIR))
  : join(gameRoot, 'reports/yandex-release-cycle-09-working');
const REVIEW_DIRECTORY = join(EVIDENCE_ROOT, 'visual/outer-flame-v4');
const REVIEW_BACKGROUNDS = Object.freeze([
  Object.freeze({ id: 'black', color: Object.freeze({ r: 0, g: 0, b: 0, alpha: 1 }) }),
  Object.freeze({ id: 'gray', color: Object.freeze({ r: 92, g: 92, b: 92, alpha: 1 }) }),
  Object.freeze({ id: 'red', color: Object.freeze({ r: 82, g: 8, b: 8, alpha: 1 }) }),
]);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

function colorStats(r, g, b) {
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  return Object.freeze({ maximum, saturation: maximum === 0 ? 0 : (maximum - minimum) / maximum });
}

function matteClasses(r, g, b, alpha, depth) {
  if (alpha < 32 || depth < 2) return Object.freeze({ lowChroma: false, olive: false });
  const { maximum, saturation } = colorStats(r, g, b);
  if (maximum < 8) return Object.freeze({ lowChroma: false, olive: false });
  const lowChroma = saturation < 0.5;
  const olive = g >= r * 0.55 && g >= b * 1.08 && b <= r * 0.72;
  return Object.freeze({ lowChroma, olive });
}

function needsWarmRetint(r, g, b) {
  const { maximum, saturation } = colorStats(r, g, b);
  if (maximum < 8) return false;
  return saturation < 0.5
    || (g >= r * 0.55 && g >= b * 1.08 && b <= r * 0.72);
}

function warmRetint(r, g, b) {
  const value = Math.max(r, g, b);
  const intensity = value / 255;
  return Object.freeze({
    r: value,
    g: clampByte(value * (0.3 + 0.2 * intensity)),
    b: clampByte(value * (0.05 + 0.08 * intensity)),
  });
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
  for (let pixel = 0; pixel < normalized.length / 4; pixel += 1) {
    if (normalized[pixel * 4 + 3] === 0) clearPixel(normalized, pixel);
  }
  return normalized;
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

function distanceToTransparent(pixels, width, height, x, y) {
  if (pixels[(y * width + x) * 4 + 3] === 0) return 0;
  for (let radius = 1; radius <= 4; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return radius;
        if (pixels[(nextY * width + nextX) * 4 + 3] === 0) return radius;
      }
    }
  }
  return 5;
}

function auditFrame(pixels, width, height) {
  const components = connectedComponents(pixels, width, height);
  let activePixelCount = 0;
  let internalLowChromaMattePixelCount = 0;
  let internalOliveMattePixelCount = 0;
  let neutralEdgePixelCount = 0;
  let coolEdgePixelCount = 0;
  let stickerEdgePixelCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      if (alpha === 0) continue;
      activePixelCount += 1;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const depth = distanceToTransparent(pixels, width, height, x, y);
      const matte = matteClasses(r, g, b, alpha, depth);
      if (matte.lowChroma) internalLowChromaMattePixelCount += 1;
      if (matte.olive) internalOliveMattePixelCount += 1;
      if (depth !== 1) {
        if ((depth === 2 && alpha > EDGE_ALPHA_CAPS[2]) || (depth === 3 && alpha > EDGE_ALPHA_CAPS[3])) stickerEdgePixelCount += 1;
        continue;
      }
      const { maximum, saturation } = colorStats(r, g, b);
      if (saturation < 0.32 && maximum < 245) neutralEdgePixelCount += 1;
      if (maximum < 248 && (g > r * 1.03 || b > r * 0.9)) coolEdgePixelCount += 1;
      if (alpha > EDGE_ALPHA_CAPS[1]) stickerEdgePixelCount += 1;
    }
  }
  return Object.freeze({
    activePixelCount,
    componentCount: components.length,
    detachedAlphaPixelCount: components.slice(1).reduce((sum, component) => sum + component.length, 0),
    internalLowChromaMattePixelCount,
    internalOliveMattePixelCount,
    neutralEdgePixelCount,
    coolEdgePixelCount,
    stickerEdgePixelCount,
  });
}

function transformFrame(source, width, height) {
  const pixels = normalizedTransparentRgb(source);
  const sourceAudit = auditFrame(pixels, width, height);
  let retintedPixelCount = 0;
  let retintedInternalLowChromaPixelCount = 0;
  let retintedInternalOlivePixelCount = 0;
  let suppressedMattePixelCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      if (alpha === 0) continue;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const depth = distanceToTransparent(pixels, width, height, x, y);
      const matte = matteClasses(r, g, b, alpha, depth);
      if (matte.lowChroma) retintedInternalLowChromaPixelCount += 1;
      if (matte.olive) retintedInternalOlivePixelCount += 1;
      if (!needsWarmRetint(r, g, b)) continue;
      const warm = warmRetint(r, g, b);
      pixels[offset] = warm.r;
      pixels[offset + 1] = warm.g;
      pixels[offset + 2] = warm.b;
      if (alpha > MATTE_ALPHA_CAP) {
        pixels[offset + 3] = MATTE_ALPHA_CAP;
        suppressedMattePixelCount += 1;
      }
      retintedPixelCount += 1;
    }
  }
  let featheredStickerEdgePixelCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      if (alpha === 0) continue;
      const depth = distanceToTransparent(pixels, width, height, x, y);
      const cap = EDGE_ALPHA_CAPS[depth];
      if (cap !== undefined && alpha > cap) {
        pixels[offset + 3] = cap;
        featheredStickerEdgePixelCount += 1;
      }
    }
  }
  const audit = auditFrame(pixels, width, height);
  for (const [metric, value] of Object.entries({
    detachedAlphaPixelCount: audit.detachedAlphaPixelCount,
    internalLowChromaMattePixelCount: audit.internalLowChromaMattePixelCount,
    internalOliveMattePixelCount: audit.internalOliveMattePixelCount,
    neutralEdgePixelCount: audit.neutralEdgePixelCount,
    coolEdgePixelCount: audit.coolEdgePixelCount,
    stickerEdgePixelCount: audit.stickerEdgePixelCount,
  })) {
    if (value !== 0) throw new Error(`v4 frame failed closed: ${metric}=${value}`);
  }
  if (audit.componentCount !== 1) throw new Error(`v4 frame failed closed: componentCount=${audit.componentCount}`);
  return Object.freeze({
    pixels,
    metrics: Object.freeze({
      ...audit,
      sourceInternalLowChromaMattePixelCount: sourceAudit.internalLowChromaMattePixelCount,
      sourceInternalOliveMattePixelCount: sourceAudit.internalOliveMattePixelCount,
      sourceStickerEdgePixelCount: sourceAudit.stickerEdgePixelCount,
      retintedPixelCount,
      retintedInternalLowChromaPixelCount,
      retintedInternalOlivePixelCount,
      suppressedMattePixelCount,
      featheredStickerEdgePixelCount,
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
    'sourceInternalLowChromaMattePixelCount',
    'sourceInternalOliveMattePixelCount',
    'sourceStickerEdgePixelCount',
    'retintedPixelCount',
    'retintedInternalLowChromaPixelCount',
    'retintedInternalOlivePixelCount',
    'suppressedMattePixelCount',
    'featheredStickerEdgePixelCount',
    'detachedAlphaPixelCount',
    'internalLowChromaMattePixelCount',
    'internalOliveMattePixelCount',
    'neutralEdgePixelCount',
    'coolEdgePixelCount',
    'stickerEdgePixelCount',
  ];
  return Object.freeze(Object.fromEntries(fields.map((field) => [field, frames.reduce((sum, frame) => sum + frame[field], 0)])));
}

async function createReviewMatrix(atlasPng, width, height, family) {
  const panelWidth = 768;
  const panelHeight = Math.round(height * panelWidth / width);
  const overlay = await sharp(atlasPng).resize(panelWidth, panelHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const panels = await Promise.all(REVIEW_BACKGROUNDS.map(({ color }) => sharp({
    create: { width: panelWidth, height: panelHeight, channels: 4, background: color },
  }).composite([{ input: overlay, blend: 'over' }]).png().toBuffer()));
  const matrix = await sharp({
    create: { width: panelWidth * panels.length, height: panelHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  }).composite(panels.map((input, index) => ({ input, left: index * panelWidth, top: 0 }))).png({ compressionLevel: 9 }).toBuffer();
  const output = join(REVIEW_DIRECTORY, `outer-${family}-v4-black-gray-red.png`);
  await writeFile(output, matrix);
  return Object.freeze({
    path: output.slice(gameRoot.length + 1).replaceAll('\\', '/'),
    bytes: matrix.length,
    sha256: sha256(matrix),
    width: panelWidth * panels.length,
    height: panelHeight,
  });
}

await mkdir(REVIEW_DIRECTORY, { recursive: true });
const identity = await buildIdentity();
const report = [];
for (const family of FAMILIES) {
  const sourceBase = `assets/flame/atlases/outer-${family}-v3`;
  const targetBase = `assets/flame/atlases/outer-${family}-v4`;
  const sourceWebp = await readFile(join(gameRoot, `${sourceBase}.webp`));
  const sourceMetadata = JSON.parse(await readFile(join(gameRoot, `${sourceBase}.json`), 'utf8'));
  const decoded = await sharp(sourceWebp, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const atlas = Buffer.alloc(decoded.info.width * decoded.info.height * 4);
  const frameMetrics = [];
  const targetFrames = [];
  for (let index = 0; index < sourceMetadata.frames.length; index += 1) {
    const sourceFrame = sourceMetadata.frames[index];
    const transformed = transformFrame(extractFrame(decoded.data, decoded.info.width, sourceFrame), sourceFrame.w, sourceFrame.h);
    insertFrame(atlas, decoded.info.width, sourceFrame, transformed.pixels);
    const decodedRgbaSha256 = sha256(transformed.pixels);
    frameMetrics.push(Object.freeze({ index, ...transformed.metrics, decodedRgbaSha256 }));
    targetFrames.push(Object.freeze({
      ...sourceFrame,
      sha256: decodedRgbaSha256,
      provenance: `deterministically warm-retinted and alpha-feathered ${family} outer atlas frame ${index}; decoded RGBA crop from outer-${family}-v4.webp`,
    }));
  }
  const image = sharp(atlas, { raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 } });
  const [png, webp] = await Promise.all([
    image.clone().png({ compressionLevel: 9, adaptiveFiltering: false, palette: false }).toBuffer(),
    image.clone().webp({ lossless: true, quality: 100, alphaQuality: 100, effort: 4, smartSubsample: false }).toBuffer(),
  ]);
  const [decodedPng, decodedWebp] = await Promise.all([
    sharp(png).ensureAlpha().raw().toBuffer(),
    sharp(webp).ensureAlpha().raw().toBuffer(),
  ]);
  if (!normalizedTransparentRgb(decodedPng).equals(atlas) || !normalizedTransparentRgb(decodedWebp).equals(atlas)) {
    throw new Error(`${family}: v4 PNG/WebP visible decoded RGBA parity failed.`);
  }
  const totals = summarizeFrames(frameMetrics);
  const metadata = Object.freeze({
    ...sourceMetadata,
    frames: targetFrames,
    version: 'v4',
    sourceAtlas: `${sourceBase}.webp`,
    sourceAtlasSha256: sha256(sourceWebp),
    visualCleanup: Object.freeze({
      algorithm: 'C09 v4 deterministic full-silhouette olive/low-chroma warm retint + 3-pixel alpha feather',
      internalDepthMinimum: 2,
      lowChromaSaturationMaximum: 0.5,
      oliveGreenToRedMinimum: 0.55,
      matteAlphaCap: MATTE_ALPHA_CAP,
      edgeAlphaCaps: EDGE_ALPHA_CAPS,
      pngWebpVisibleDecodedRgbaParity: true,
      ...totals,
      frames: frameMetrics,
    }),
  });
  await Promise.all([
    writeFile(join(gameRoot, `${targetBase}.png`), png),
    writeFile(join(gameRoot, `${targetBase}.webp`), webp),
    writeFile(join(gameRoot, `${targetBase}.json`), `${JSON.stringify(metadata, null, 2)}\n`),
  ]);
  const review = await createReviewMatrix(png, decoded.info.width, decoded.info.height, family);
  report.push(Object.freeze({
    family,
    source: Object.freeze({ path: `${sourceBase}.webp`, bytes: sourceWebp.length, sha256: sha256(sourceWebp) }),
    output: Object.freeze({
      webp: Object.freeze({ path: `${targetBase}.webp`, bytes: webp.length, sha256: sha256(webp) }),
      png: Object.freeze({ path: `${targetBase}.png`, bytes: png.length, sha256: sha256(png) }),
      metadata: `${targetBase}.json`,
      width: decoded.info.width,
      height: decoded.info.height,
    }),
    layout: Object.freeze({
      frames: targetFrames.length,
      frameWidth: sourceMetadata.frameWidth,
      frameHeight: sourceMetadata.frameHeight,
      fps: sourceMetadata.fps,
      pivot: sourceMetadata.pivot,
      phaseOffsetFrames: sourceMetadata.phaseOffsetFrames,
    }),
    metrics: totals,
    decodedRgbaSha256: sha256(atlas),
    pngWebpVisibleDecodedRgbaParity: true,
    review,
  }));
}

const reportPath = join(REVIEW_DIRECTORY, 'outer-flame-v4-audit.json');
await writeFile(reportPath, `${JSON.stringify({
  schemaVersion: 1,
  generatedBy: 'scripts/build-cycle09-outer-flame-v4-assets.mjs',
  generatedAt: new Date().toISOString(),
  algorithmVersion: 'outer-flame-c09-v4-v1',
  sourceFingerprint: identity.sourceFingerprint,
  reviewBackgrounds: REVIEW_BACKGROUNDS.map(({ id, color }) => ({ id, color })),
  families: report,
}, null, 2)}\n`);

console.log(`Cycle 09 outer flame v4 PASS (${report.reduce((sum, family) => sum + family.layout.frames, 0)} frames; ${report.reduce((sum, family) => sum + family.metrics.retintedPixelCount, 0)} pixels warm-retinted; ${report.reduce((sum, family) => sum + family.metrics.featheredStickerEdgePixelCount, 0)} sticker-edge alpha pixels feathered; all final matte/edge/detached metrics zero; PNG/WebP parity exact)`);
