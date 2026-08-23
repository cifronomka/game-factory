import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { gameRoot } from './lib.mjs';

const ALPHA_FLOOR = 15;
const SEARCH_RADIUS = 6;
const REVIEW_BACKGROUNDS = Object.freeze([
  Object.freeze({ id: 'black', color: Object.freeze({ r: 0, g: 0, b: 0, alpha: 1 }) }),
  Object.freeze({ id: 'gray', color: Object.freeze({ r: 92, g: 92, b: 92, alpha: 1 }) }),
  Object.freeze({ id: 'red', color: Object.freeze({ r: 82, g: 8, b: 8, alpha: 1 }) }),
]);
const FAMILIES = Object.freeze(['low', 'mid', 'high']);
const REVIEW_DIRECTORY = join(gameRoot, 'reports/yandex-release-cycle-09-working/visual/outer-flame-v3');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function colorStats(r, g, b) {
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  return Object.freeze({ maximum, saturation: maximum === 0 ? 0 : (maximum - minimum) / maximum });
}

function isProblematicEdgeColor(r, g, b) {
  const { maximum, saturation } = colorStats(r, g, b);
  const neutral = saturation < 0.32 && maximum < 245;
  const cool = maximum < 248 && (g > r * 1.03 || b > r * 0.9);
  return neutral || cool;
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
        if (isWarmSourceColor(r, g, b)) candidates.push({ alpha, b, g, r, distanceSquared: dx * dx + dy * dy, offset });
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
  let neutralEdgePixelCount = 0;
  let coolEdgePixelCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (pixels[offset + 3] === 0) continue;
      activePixelCount += 1;
      if (!isBoundaryPixel(pixels, width, height, x, y)) continue;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const { maximum, saturation } = colorStats(r, g, b);
      if (saturation < 0.32 && maximum < 245) neutralEdgePixelCount += 1;
      if (maximum < 248 && (g > r * 1.03 || b > r * 0.9)) coolEdgePixelCount += 1;
    }
  }
  return Object.freeze({
    activePixelCount,
    componentCount: components.length,
    detachedAlphaPixelCount: components.slice(1).reduce((sum, component) => sum + component.length, 0),
    neutralEdgePixelCount,
    coolEdgePixelCount,
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
  let recoloredNeutralEdgePixelCount = 0;
  let removedUnrecoverableEdgePixelCount = 0;
  let secondComponentRemoved = 0;
  for (let pass = 0; pass < 8; pass += 1) {
    const replacements = [];
    const removals = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        if (pixels[offset + 3] === 0 || !isBoundaryPixel(pixels, width, height, x, y)) continue;
        const r = pixels[offset];
        const g = pixels[offset + 1];
        const b = pixels[offset + 2];
        if (!isProblematicEdgeColor(r, g, b)) continue;
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
    recoloredNeutralEdgePixelCount += replacements.length;
    removedUnrecoverableEdgePixelCount += removals.length;
    if (removals.length > 0) secondComponentRemoved += keepLargestComponent(pixels, width, height).removed;
    if (replacements.length === 0 && removals.length === 0) break;
  }
  const secondComponentPass = keepLargestComponent(pixels, width, height);
  secondComponentRemoved += secondComponentPass.removed;
  const audit = analyzeFrame(pixels, width, height);
  if (audit.componentCount !== 1 || audit.detachedAlphaPixelCount !== 0) throw new Error('Cleaned frame still has detached alpha.');
  if (audit.neutralEdgePixelCount !== 0 || audit.coolEdgePixelCount !== 0) throw new Error('Cleaned frame still has a neutral/cool edge residue.');
  return Object.freeze({
    pixels,
    metrics: Object.freeze({
      ...audit,
      removedLowAlphaPixelCount,
      removedDetachedAlphaPixelCount: firstComponentPass.removed + secondComponentRemoved,
      recoloredNeutralEdgePixelCount,
      removedUnrecoverableEdgePixelCount,
      sourceComponentCount: firstComponentPass.componentCountBefore,
    }),
  });
}

function extractFrame(atlas, atlasWidth, frame) {
  const pixels = Buffer.alloc(frame.w * frame.h * 4);
  for (let y = 0; y < frame.h; y += 1) {
    const sourceStart = ((frame.y + y) * atlasWidth + frame.x) * 4;
    const targetStart = y * frame.w * 4;
    atlas.copy(pixels, targetStart, sourceStart, sourceStart + frame.w * 4);
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
    'removedLowAlphaPixelCount',
    'removedDetachedAlphaPixelCount',
    'recoloredNeutralEdgePixelCount',
    'removedUnrecoverableEdgePixelCount',
    'detachedAlphaPixelCount',
    'neutralEdgePixelCount',
    'coolEdgePixelCount',
  ];
  return Object.freeze(Object.fromEntries(fields.map((field) => [field, frames.reduce((sum, frame) => sum + frame[field], 0)])));
}

async function createReviewMatrix(atlasPng, width, height, family) {
  const panelWidth = 768;
  const panelHeight = Math.round(height * panelWidth / width);
  const overlay = await sharp(atlasPng).resize(panelWidth, panelHeight, { fit: 'fill', kernel: sharp.kernel.nearest }).png().toBuffer();
  const panels = await Promise.all(REVIEW_BACKGROUNDS.map(({ color }) => sharp({
    create: { width: panelWidth, height: panelHeight, channels: 4, background: color },
  }).composite([{ input: overlay, blend: 'over' }]).png().toBuffer()));
  const matrix = await sharp({
    create: { width: panelWidth * panels.length, height: panelHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  }).composite(panels.map((input, index) => ({ input, left: index * panelWidth, top: 0 }))).png({ compressionLevel: 9 }).toBuffer();
  const output = join(REVIEW_DIRECTORY, `outer-${family}-v3-black-gray-red.png`);
  await writeFile(output, matrix);
  return Object.freeze({ path: output.slice(gameRoot.length + 1).replaceAll('\\', '/'), bytes: matrix.length, sha256: sha256(matrix), width: panelWidth * panels.length, height: panelHeight });
}

await mkdir(REVIEW_DIRECTORY, { recursive: true });
const report = [];
for (const family of FAMILIES) {
  const sourceBase = `assets/flame/atlases/outer-${family}-v2`;
  const targetBase = `assets/flame/atlases/outer-${family}-v3`;
  const sourceWebp = await readFile(join(gameRoot, `${sourceBase}.webp`));
  const sourceMetadata = JSON.parse(await readFile(join(gameRoot, `${sourceBase}.json`), 'utf8'));
  const decoded = await sharp(sourceWebp, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const atlas = Buffer.alloc(decoded.info.width * decoded.info.height * 4);
  const frameMetrics = [];
  const targetFrames = [];
  for (let index = 0; index < sourceMetadata.frames.length; index += 1) {
    const sourceFrame = sourceMetadata.frames[index];
    const sourcePixels = extractFrame(decoded.data, decoded.info.width, sourceFrame);
    const sourceAudit = analyzeFrame(sourcePixels, sourceFrame.w, sourceFrame.h);
    const cleaned = cleanFrame(sourcePixels, sourceFrame.w, sourceFrame.h);
    insertFrame(atlas, decoded.info.width, sourceFrame, cleaned.pixels);
    const decodedRgbaSha256 = sha256(cleaned.pixels);
    frameMetrics.push(Object.freeze({ index, source: sourceAudit, ...cleaned.metrics, decodedRgbaSha256 }));
    targetFrames.push(Object.freeze({
      ...sourceFrame,
      sha256: decodedRgbaSha256,
      provenance: `deterministically cleaned ${family} outer atlas frame ${index}; decoded RGBA crop from outer-${family}-v3.webp`,
    }));
  }

  const png = await sharp(atlas, { raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
  const webp = await sharp(atlas, { raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 } })
    .webp({ lossless: true, quality: 100, alphaQuality: 100, effort: 4, smartSubsample: false })
    .toBuffer();
  const [decodedPng, decodedWebp] = await Promise.all([
    sharp(png).ensureAlpha().raw().toBuffer(),
    sharp(webp).ensureAlpha().raw().toBuffer(),
  ]);
  const normalizedPng = normalizedTransparentRgb(decodedPng);
  const normalizedWebp = normalizedTransparentRgb(decodedWebp);
  if (!normalizedPng.equals(atlas) || !normalizedWebp.equals(atlas) || !normalizedPng.equals(normalizedWebp)) {
    let mismatchBytes = 0;
    let mismatchPixels = 0;
    let maximumDelta = 0;
    for (let offset = 0; offset < atlas.length; offset += 4) {
      let pixelMismatch = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(normalizedWebp[offset + channel] - normalizedPng[offset + channel]);
        if (delta > 0) {
          mismatchBytes += 1;
          pixelMismatch = true;
          maximumDelta = Math.max(maximumDelta, delta);
        }
      }
      if (pixelMismatch) mismatchPixels += 1;
    }
    throw new Error(`${family}: PNG/WebP decoded RGBA parity failed (${mismatchPixels} pixels, ${mismatchBytes} channels, max delta ${maximumDelta}).`);
  }

  const totals = summarizeFrames(frameMetrics);
  const metadata = Object.freeze({
    ...sourceMetadata,
    frames: targetFrames,
    version: 'v3',
    sourceAtlas: `${sourceBase}.webp`,
    sourceAtlasSha256: sha256(sourceWebp),
    alphaCleanup: Object.freeze({
      algorithm: 'C09 deterministic alpha-floor + per-frame largest 8-connected component + nearest warm edge RGB transfer',
      alphaFloorInclusive: ALPHA_FLOOR,
      nearestWarmSearchRadius: SEARCH_RADIUS,
      pngWebpDecodedRgbaParity: true,
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
    pngWebpDecodedRgbaParity: true,
    review,
  }));
}

const reportPath = join(REVIEW_DIRECTORY, 'outer-flame-v3-audit.json');
await writeFile(reportPath, `${JSON.stringify({
  schemaVersion: 1,
  generatedBy: 'scripts/build-cycle09-outer-flame-assets.mjs',
  algorithmVersion: 'outer-flame-c09-v1',
  reviewBackgrounds: REVIEW_BACKGROUNDS.map(({ id, color }) => ({ id, color })),
  families: report,
}, null, 2)}\n`);

console.log(`Cycle 09 outer flame cleanup PASS (${report.reduce((sum, family) => sum + family.layout.frames, 0)} frames; ${report.reduce((sum, family) => sum + family.metrics.removedDetachedAlphaPixelCount, 0)} detached pixels removed; ${report.reduce((sum, family) => sum + family.metrics.recoloredNeutralEdgePixelCount, 0)} neutral/cool edge pixels recolored; PNG/WebP parity exact)`);
