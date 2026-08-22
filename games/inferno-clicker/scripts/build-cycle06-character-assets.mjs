// @ts-check

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { gameRoot } from './lib.mjs';

const root = resolve(gameRoot);
const sourceRoot = join(root, 'visual-references/cycle-06-sources');
const SHA256 = (value) => createHash('sha256').update(value).digest('hex');

function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

/** Remove generated neutral checker pixels while preserving dark authored material. */
function deriveCheckerAlpha(data, info) {
  const output = Buffer.from(data);
  for (let index = 0; index < output.length; index += info.channels) {
    const r = output[index];
    const g = output[index + 1];
    const b = output[index + 2];
    const high = Math.max(r, g, b);
    const low = Math.min(r, g, b);
    const neutral = high - low;
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
    let alpha = 255;
    if (neutral < 56 && luminance >= 160) alpha = 0;
    else if (neutral < 46 && luminance >= 110) alpha = Math.round(255 * (160 - luminance) / 50);
    output[index + 3] = clamp(alpha, 0, 255);
  }
  return output;
}

/** Remove only border-connected neutral generation backdrops, retaining light details enclosed by the silhouette. */
function deriveBorderNeutralAlpha(data, info) {
  const output = Buffer.from(data);
  const candidate = new Uint8Array(info.width * info.height);
  const queued = new Uint8Array(candidate.length);
  const queue = new Int32Array(candidate.length);
  for (let pixel = 0; pixel < candidate.length; pixel += 1) {
    const index = pixel * info.channels;
    const r = output[index]; const g = output[index + 1]; const b = output[index + 2];
    const high = Math.max(r, g, b); const low = Math.min(r, g, b);
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
    candidate[pixel] = high - low < 54 && luminance >= 168 ? 1 : 0;
  }
  let head = 0; let tail = 0;
  const enqueue = (pixel) => {
    if (pixel < 0 || pixel >= candidate.length || queued[pixel] || !candidate[pixel]) return;
    queued[pixel] = 1; queue[tail++] = pixel;
  };
  for (let x = 0; x < info.width; x += 1) {
    enqueue(x); enqueue((info.height - 1) * info.width + x);
  }
  for (let y = 0; y < info.height; y += 1) {
    enqueue(y * info.width); enqueue(y * info.width + info.width - 1);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % info.width;
    if (x > 0) enqueue(pixel - 1);
    if (x < info.width - 1) enqueue(pixel + 1);
    enqueue(pixel - info.width); enqueue(pixel + info.width);
  }
  for (let pixel = 0; pixel < queued.length; pixel += 1) {
    if (!queued[pixel]) continue;
    const index = pixel * info.channels;
    const r = output[index]; const g = output[index + 1]; const b = output[index + 2];
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
    output[index + 3] = clamp(Math.round((205 - luminance) / 37 * 255), 0, 255);
  }
  return output;
}

function retainComponents(data, width, height, mode) {
  const output = Buffer.from(data);
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) mask[index] = output[index * 4 + 3] > 12 ? 1 : 0;
  const queue = new Int32Array(mask.length);
  const components = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start]) continue;
    let head = 0; let tail = 0; queue[tail++] = start; mask[start] = 0;
    const pixels = []; let left = width; let right = 0; let top = height; let bottom = 0;
    while (head < tail) {
      const value = queue[head++]; pixels.push(value);
      const x = value % width; const y = Math.floor(value / width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const next of [value - 1, value + 1, value - width, value + width]) {
        if (next < 0 || next >= mask.length || !mask[next]) continue;
        const nx = next % width; const ny = Math.floor(next / width);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        mask[next] = 0; queue[tail++] = next;
      }
    }
    components.push({ pixels, area: pixels.length, width: right - left + 1, height: bottom - top + 1, left, right, top, bottom });
  }
  components.sort((a, b) => b.area - a.area);
  const keep = mode === 'largest'
    ? new Set(components.slice(0, 1))
    : mode === 'second'
      ? new Set(components.slice(1, 2))
      : new Set(components.filter((component) => component.area >= Math.max(120, width * height * 0.0015)
      && component.width / component.height < 7 && component.height / component.width < 7
      && component.left > 2 && component.right < width - 3).slice(0, 6));
  for (const component of components) {
    if (keep.has(component)) continue;
    for (const pixel of component.pixels) {
      const index = pixel * 4;
      output[index] = 0; output[index + 1] = 0; output[index + 2] = 0; output[index + 3] = 0;
    }
  }
  return output;
}

/** Copy nearby opaque character colour into partial-alpha pixels to eliminate matte RGB. */
function defringe(data, width, height) {
  const source = Buffer.from(data);
  const output = Buffer.from(data);
  const at = (x, y) => (y * width + x) * 4;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = at(x, y);
      const alpha = source[index + 3];
      if (alpha === 0) {
        output[index] = 0; output[index + 1] = 0; output[index + 2] = 0;
        continue;
      }
      if (alpha >= 245) continue;
      let best = null;
      for (let radius = 1; radius <= 4 && !best; radius += 1) {
        for (let oy = -radius; oy <= radius && !best; oy += 1) {
          for (let ox = -radius; ox <= radius; ox += 1) {
            const nx = x + ox; const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const neighbor = at(nx, ny);
            if (source[neighbor + 3] >= 245) { best = neighbor; break; }
          }
        }
      }
      if (best !== null) {
        output[index] = source[best];
        output[index + 1] = source[best + 1];
        output[index + 2] = source[best + 2];
      }
    }
  }
  return output;
}

function alphaBounds(data, width, height, threshold = 12) {
  let left = width; let top = height; let right = -1; let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= threshold) continue;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('Generated source cell has no visible character pixels');
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function frameMetrics(data, width, height) {
  const bounds = alphaBounds(data, width, height);
  let weight = 0; let weightedX = 0; let edgeAlphaPixels = 0; let partialNeutralBrightPixels = 0; let partialPixels = 0;
  const occupied = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha > 12) occupied[y * width + x] = 1;
      if (alpha > 0) {
        weight += alpha; weightedX += x * alpha;
        if (x < 4 || y < 4 || x >= width - 4 || y >= height - 4) edgeAlphaPixels += 1;
      }
      if (alpha > 0 && alpha < 245) {
        partialPixels += 1;
        const r = data[index]; const g = data[index + 1]; const b = data[index + 2];
        if (Math.max(r, g, b) - Math.min(r, g, b) < 24 && (r + g + b) / 3 > 190) partialNeutralBrightPixels += 1;
      }
    }
  }
  let largest = 0; let total = 0;
  const queue = new Int32Array(width * height);
  for (let start = 0; start < occupied.length; start += 1) {
    if (!occupied[start]) continue;
    let head = 0; let tail = 0; queue[tail++] = start; occupied[start] = 0; let size = 0;
    while (head < tail) {
      const value = queue[head++]; size += 1; total += 1;
      const x = value % width; const y = Math.floor(value / width);
      for (const next of [value - 1, value + 1, value - width, value + width]) {
        if (next < 0 || next >= occupied.length || !occupied[next]) continue;
        const nx = next % width; const ny = Math.floor(next / width);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        occupied[next] = 0; queue[tail++] = next;
      }
    }
    largest = Math.max(largest, size);
  }
  return {
    alphaBBox: [bounds.left, bounds.top, bounds.left + bounds.width - 1, bounds.top + bounds.height - 1],
    rootY: bounds.top + bounds.height - 1,
    centroidX: Math.round(weightedX / Math.max(1, weight) * 100) / 100,
    edgeAlphaPixels,
    largestComponentRatio: Math.round(largest / Math.max(1, total) * 100000) / 100000,
    matteRatio: Math.round(partialNeutralBrightPixels / Math.max(1, partialPixels) * 100000) / 100000,
  };
}

async function normalizedSource(path, checker, backgroundRemoval) {
  const image = sharp(path).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const rgba = info.channels === 4 ? data : Buffer.from(data);
  const alphaReady = backgroundRemoval === 'border-neutral'
    ? deriveBorderNeutralAlpha(rgba, info)
    : checker ? deriveCheckerAlpha(rgba, info) : rgba;
  return { data: defringe(alphaReady, info.width, info.height), width: info.width, height: info.height };
}

async function extractCell(source, columns, rows, index, targetWidth, targetHeight, componentMode, preserveCellFraming = false, framingScale = 1) {
  const column = index % columns; const row = Math.floor(index / columns);
  const left = Math.round(column * source.width / columns);
  const top = Math.round(row * source.height / rows);
  const right = Math.round((column + 1) * source.width / columns);
  const bottom = Math.round((row + 1) * source.height / rows);
  const width = right - left; const height = bottom - top;
  let cell = await sharp(source.data, { raw: { width: source.width, height: source.height, channels: 4 } })
    .extract({ left, top, width, height }).raw().toBuffer();
  cell = retainComponents(cell, width, height, componentMode);
  if (preserveCellFraming) {
    const framed = await sharp(cell, { raw: { width, height, channels: 4 } })
      .resize({ width: targetWidth, height: targetHeight, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: sharp.kernel.lanczos3 })
      .raw().toBuffer();
    const framedBounds = alphaBounds(framed, targetWidth, targetHeight);
    let visible = await sharp(framed, { raw: { width: targetWidth, height: targetHeight, channels: 4 } })
      .extract(framedBounds).png().toBuffer();
    const visibleWidth = Math.round(framedBounds.width * framingScale);
    const visibleHeight = Math.round(framedBounds.height * framingScale);
    if (visibleWidth > targetWidth || visibleHeight > targetHeight - 6) throw new Error(`Framing scale ${framingScale} clips source frame ${index}`);
    if (framingScale !== 1) visible = await sharp(visible).resize({ width: visibleWidth, height: visibleHeight, fit: 'fill', kernel: sharp.kernel.lanczos3 }).png().toBuffer();
    const x = Math.round((targetWidth - visibleWidth) / 2);
    const y = targetHeight - 6 - visibleHeight;
    return sharp({ create: { width: targetWidth, height: targetHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: visible, left: x, top: y }]).raw().toBuffer();
  }
  const bounds = alphaBounds(cell, width, height);
  const trimmed = await sharp(cell, { raw: { width, height, channels: 4 } })
    .extract(bounds)
    .resize({ width: targetWidth - 16, height: targetHeight - 12, fit: 'inside', withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
    .png().toBuffer();
  const metadata = await sharp(trimmed).metadata();
  const x = Math.round((targetWidth - Number(metadata.width)) / 2);
  const y = targetHeight - 6 - Number(metadata.height);
  const canvas = await sharp({ create: { width: targetWidth, height: targetHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed, left: x, top: y }]).raw().toBuffer();
  return canvas;
}

export async function buildAtlas(spec) {
  const activeSourceRoot = spec.sourceRoot ? resolve(root, spec.sourceRoot) : sourceRoot;
  const sourcePath = join(activeSourceRoot, spec.source);
  const source = await normalizedSource(sourcePath, spec.checker, spec.backgroundRemoval);
  const frames = [];
  for (const sourceIndex of spec.indices) frames.push(await extractCell(source, spec.sourceColumns, spec.sourceRows, sourceIndex, spec.frameWidth, spec.frameHeight, spec.componentMode, spec.preserveCellFraming, spec.framingScale));
  const atlasWidth = spec.columns * spec.frameWidth;
  const atlasHeight = spec.rows * spec.frameHeight;
  const composites = frames.map((input, index) => ({ input, raw: { width: spec.frameWidth, height: spec.frameHeight, channels: 4 }, left: index % spec.columns * spec.frameWidth, top: Math.floor(index / spec.columns) * spec.frameHeight }));
  const outputPath = join(root, spec.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await sharp({ create: { width: atlasWidth, height: atlasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .webp(spec.checker
      ? { quality: 100, alphaQuality: 100, smartSubsample: false, effort: 4 }
      : { quality: spec.quality ?? 92, alphaQuality: 100, smartSubsample: true, effort: 4 })
    .toFile(outputPath);
  const atlasBytes = await readFile(outputPath);
  const metadataPath = outputPath.replace(/\.webp$/i, '.json');
  const metadataFrames = frames.map((frame, index) => {
    const metrics = frameMetrics(frame, spec.frameWidth, spec.frameHeight);
    return {
      x: index % spec.columns * spec.frameWidth,
      y: Math.floor(index / spec.columns) * spec.frameHeight,
      w: spec.frameWidth,
      h: spec.frameHeight,
      durationMs: Math.round(100000 / spec.fps) / 100,
      sha256: SHA256(frame),
      provenance: `Cycle ${spec.cycle ?? '06'} ${spec.generatedBy ?? 'ImageGen'} source ${spec.source}; ${spec.clip} authored frame ${index}; alpha defringe, stable-root fit and ${spec.checker ? 'quality-100' : spec.quality ? `quality-${spec.quality}` : 'high-quality'} WebP export only`,
      sockets: spec.sockets?.[index] ?? (spec.socket ? { [spec.socket.name]: spec.socket.value } : undefined),
      anatomicalScale: spec.anatomicalScale?.[index] ?? spec.anatomicalScale ?? 1,
      ...metrics,
    };
  });
  const metadata = {
    schemaVersion: 1,
    cycle: spec.cycle ?? '06',
    atlasWidth,
    atlasHeight,
    frameWidth: spec.frameWidth,
    frameHeight: spec.frameHeight,
    pivot: spec.pivot,
    transparentGutterPixels: 6,
    packing: `Cycle ${spec.cycle ?? '06'} clip-split atlas; authored ImageGen poses; clean alpha; stable bottom root; high-quality WebP; no runtime full-pose dissolve`,
    sourceSheet: `${relative(root, activeSourceRoot).split(sep).join('/')}/${spec.source}`,
    sourceSheetSha256: SHA256(await readFile(sourcePath)),
    atlasSha256: SHA256(atlasBytes),
    clips: { [spec.clip]: { fps: spec.fps, loop: spec.loop, frames: metadataFrames } },
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`${relative(root, outputPath).split(sep).join('/')} ${atlasWidth}x${atlasHeight} ${atlasBytes.length} bytes ${spec.clip}:${frames.length}`);
}

const allEight = Array.from({ length: 8 }, (_, index) => index);
const servantSpecs = ['idle', 'inhale', 'blow', 'recovery'].map((clip, row) => ({
  source: clip === 'recovery' ? 'ash-servant-recovery-8-source.png' : 'ash-servant-32-source.png',
  checker: true,
  sourceColumns: clip === 'recovery' ? 4 : 10,
  sourceRows: clip === 'recovery' ? 2 : 4,
  indices: clip === 'recovery' ? allEight : allEight.map((index) => row * 10 + index),
  componentMode: 'largest',
  output: `assets/characters/ash-servant/ash-servant-${clip}-v4.webp`, clip,
  columns: 4, rows: 2, frameWidth: 256, frameHeight: 320, fps: clip === 'idle' ? 6 : 10, loop: clip === 'idle' || clip === 'blow', pivot: [0.5, 0.98125],
  socket: { name: 'mouth', value: [0.66, 0.31] },
}));
const demonessSpecs = [
  { source: 'demoness-idle-8-source.png', clip: 'idle', fps: 1.2, loop: true },
  { source: 'demoness-cast-8-source.png', clip: 'cast', fps: 8, loop: false },
  { source: 'demoness-hold-8-source.png', clip: 'hold', fps: 6, loop: true },
  { source: 'demoness-recovery-8-source.png', clip: 'recovery', fps: 8, loop: false },
].map((entry) => ({
  ...entry, checker: false, sourceColumns: 4, sourceRows: 2, indices: allEight,
  componentMode: 'largest',
  output: `assets/characters/demoness/demoness-${entry.clip}-v5.webp`, columns: 4, rows: 2,
  frameWidth: 400, frameHeight: 600, pivot: [0.5, 0.99],
  socket: { name: 'castHand', value: entry.clip === 'idle' ? [0.37, 0.43] : [0.16, 0.31] },
}));
const hostSpecs = [
  { role: 'main', source: 'inferno-host-main-6-source.png', checker: false },
  { role: 'sentinel', source: 'inferno-sentinel-6-source.png', checker: true },
].map(({ role, source, checker }) => ({
  source, checker, sourceColumns: 3, sourceRows: 2, indices: Array.from({ length: 5 }, (_, index) => index),
  componentMode: 'largest',
  output: `assets/characters/character-inferno-host-${role}-v4.webp`, clip: 'ambient', columns: 3, rows: 2,
  frameWidth: 304, frameHeight: 256, fps: 2, loop: true, pivot: [0.5, 0.9765625],
}));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const spec of [...servantSpecs, ...demonessSpecs, ...hostSpecs]) await buildAtlas(spec);
}
