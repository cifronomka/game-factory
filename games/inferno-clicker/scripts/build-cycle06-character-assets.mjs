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

function alphaChannel(data) {
  const alpha = Buffer.alloc(data.length / 4);
  for (let source = 3, target = 0; source < data.length; source += 4, target += 1) alpha[target] = data[source];
  return alpha;
}

function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

function roundRatio(value) { return Math.round(value * 100000) / 100000; }

function pixelLuminance(r, g, b) { return r * 0.2126 + g * 0.7152 + b * 0.0722; }

function pixelChroma(r, g, b) { return Math.max(r, g, b) - Math.min(r, g, b); }

/**
 * Find the dominant colour on the source-sheet border. Opaque ImageGen sheets
 * use this as matte evidence; it is never used to recolour authored pixels.
 */
function dominantBorderColour(data, info) {
  const band = Math.max(2, Math.min(8, Math.floor(Math.min(info.width, info.height) / 160)));
  const buckets = new Map();
  let samples = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (x >= band && y >= band && x < info.width - band && y < info.height - band) continue;
      const index = (y * info.width + x) * info.channels;
      const key = `${data[index] >> 4},${data[index + 1] >> 4},${data[index + 2] >> 4}`;
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1; bucket.r += data[index]; bucket.g += data[index + 1]; bucket.b += data[index + 2];
      buckets.set(key, bucket); samples += 1;
    }
  }
  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant) return { rgb: [255, 255, 255], dominance: 0 };
  return {
    rgb: [Math.round(dominant.r / dominant.count), Math.round(dominant.g / dominant.count), Math.round(dominant.b / dominant.count)],
    dominance: roundRatio(dominant.count / Math.max(1, samples)),
  };
}

function alphaProfile(data, info) {
  let transparent = 0; let partial = 0; let borderTransparent = 0; let borderPixels = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha <= 8) transparent += 1;
      else if (alpha < 247) partial += 1;
      if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) {
        borderPixels += 1;
        if (alpha <= 8) borderTransparent += 1;
      }
    }
  }
  const pixels = info.width * info.height;
  const transparentRatio = transparent / Math.max(1, pixels);
  const borderTransparentRatio = borderTransparent / Math.max(1, borderPixels);
  return {
    transparentPixels: transparent,
    partialPixels: partial,
    transparentRatio: roundRatio(transparentRatio),
    borderTransparentRatio: roundRatio(borderTransparentRatio),
    meaningful: transparentRatio >= 0.005 && borderTransparentRatio >= 0.15,
  };
}

function backgroundStrength(r, g, b, background) {
  const distance = Math.hypot(r - background[0], g - background[1], b - background[2]);
  const colourScore = clamp(1 - distance / 88, 0, 1);
  const backgroundIsNeutralBright = pixelChroma(...background) <= 36 && pixelLuminance(...background) >= 176;
  if (!backgroundIsNeutralBright) return colourScore;
  const neutralScore = clamp((pixelLuminance(r, g, b) - 158) / 92, 0, 1)
    * clamp((58 - pixelChroma(r, g, b)) / 44, 0, 1);
  return Math.max(colourScore, neutralScore);
}

/** Remove an inferred opaque matte only when it is connected to the sheet border. */
function removeBorderMatte(data, info, background) {
  const output = Buffer.from(data);
  const queued = new Uint8Array(info.width * info.height);
  const queue = new Int32Array(queued.length);
  let head = 0; let tail = 0;
  const enqueue = (pixel) => {
    if (pixel < 0 || pixel >= queued.length || queued[pixel]) return;
    const index = pixel * info.channels;
    if (backgroundStrength(output[index], output[index + 1], output[index + 2], background) < 0.08) return;
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
    if (pixel >= info.width) enqueue(pixel - info.width);
    if (pixel < queued.length - info.width) enqueue(pixel + info.width);
  }
  let removed = 0;
  for (let pixel = 0; pixel < queued.length; pixel += 1) {
    if (!queued[pixel]) continue;
    const index = pixel * info.channels;
    // Flood membership is already restricted to pixels connected to the outer
    // matte. Keeping a residual alpha turns a baked checker into a visible grey
    // maze; make the inferred background transparent and let the final Lanczos
    // resize create the antialiased edge from retained authored pixels.
    const nextAlpha = 0;
    if (nextAlpha < output[index + 3]) {
      if (output[index + 3] > 12 && nextAlpha <= 12) removed += 1;
      output[index + 3] = nextAlpha;
    }
  }
  return { data: output, removedPixels: removed };
}

/**
 * Remove only sizeable, compact, nearly uniform matte-colour islands. This is
 * deliberately narrower than deleting every light pixel: eyes, metal glints,
 * pale skin and other authored highlights remain unless they form a uniform
 * background-like region with strong geometric evidence.
 */
function removeSuspiciousInteriorMatte(data, info, background, acceptNeutralWhite = false) {
  const output = Buffer.from(data);
  const candidate = new Uint8Array(info.width * info.height);
  const minimumArea = Math.max(24, Math.floor(candidate.length * 0.00002));
  for (let pixel = 0; pixel < candidate.length; pixel += 1) {
    const index = pixel * info.channels;
    const r = output[index]; const g = output[index + 1]; const b = output[index + 2];
    const neutralWhite = pixelLuminance(r, g, b) >= 222 && pixelChroma(r, g, b) <= 26;
    candidate[pixel] = output[index + 3] > 12 && neutralWhite
      && (acceptNeutralWhite || backgroundStrength(r, g, b, background) >= 0.72) ? 1 : 0;
  }
  const queue = new Int32Array(candidate.length);
  let removedPixels = 0; let removedRegions = 0;
  for (let start = 0; start < candidate.length; start += 1) {
    if (!candidate[start]) continue;
    let head = 0; let tail = 0; queue[tail++] = start; candidate[start] = 0;
    const pixels = [];
    let left = info.width; let right = 0; let top = info.height; let bottom = 0;
    let sumLuminance = 0; let sumLuminanceSquared = 0; let sumChroma = 0; let sumAlpha = 0; let touchesTransparency = false;
    while (head < tail) {
      const pixel = queue[head++]; pixels.push(pixel);
      const x = pixel % info.width; const y = Math.floor(pixel / info.width);
      const index = pixel * info.channels;
      const luminance = pixelLuminance(output[index], output[index + 1], output[index + 2]);
      const chroma = pixelChroma(output[index], output[index + 1], output[index + 2]);
      sumLuminance += luminance; sumLuminanceSquared += luminance * luminance; sumChroma += chroma; sumAlpha += output[index + 3];
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const next of [pixel - 1, pixel + 1, pixel - info.width, pixel + info.width]) {
        if (next < 0 || next >= candidate.length) continue;
        const nx = next % info.width; const ny = Math.floor(next / info.width);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        if (output[next * info.channels + 3] <= 12) touchesTransparency = true;
        if (!candidate[next]) continue;
        candidate[next] = 0; queue[tail++] = next;
      }
    }
    const area = pixels.length;
    const width = right - left + 1; const height = bottom - top + 1;
    const meanLuminance = sumLuminance / area;
    const luminanceDeviation = Math.sqrt(Math.max(0, sumLuminanceSquared / area - meanLuminance * meanLuminance));
    const compact = Math.min(width, height) >= 4 && area / Math.max(1, width * height) >= 0.12;
    const uniformMatte = meanLuminance >= 232 && sumChroma / area <= 14 && luminanceDeviation <= 9;
    const translucentEdgeMatte = touchesTransparency && sumAlpha / area < 238 && area >= 4;
    if (!(translucentEdgeMatte || (area >= minimumArea && compact && uniformMatte))) continue;
    removedRegions += 1; removedPixels += area;
    for (const pixel of pixels) output[pixel * info.channels + 3] = 0;
  }
  return { data: output, removedPixels, removedRegions };
}

/**
 * Contract a derived opaque-source mask by one source pixel. A baked matte has
 * no trustworthy subpixel alpha, so the outermost mixed RGB row is contamination,
 * not authored transparency. Clean source-alpha sheets deliberately skip this.
 */
function contractDerivedMatteMask(data, info) {
  const source = Buffer.from(data);
  const output = Buffer.from(data);
  let removedPixels = 0;
  for (let y = 1; y < info.height - 1; y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const pixel = y * info.width + x;
      const index = pixel * info.channels;
      if (source[index + 3] <= 12) continue;
      let touchesTransparency = false;
      for (let oy = -1; oy <= 1 && !touchesTransparency; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          if (source[((y + oy) * info.width + x + ox) * info.channels + 3] <= 12) { touchesTransparency = true; break; }
        }
      }
      if (!touchesTransparency) continue;
      output[index + 3] = 0; removedPixels += 1;
    }
  }
  return { data: output, removedPixels };
}

/**
 * Prefer a meaningful source alpha channel. Fall back to adaptive border-matte
 * extraction only for an opaque sheet, then perform conservative island cleanup.
 */
export function deriveSmartCharacterAlpha(data, info) {
  const profile = alphaProfile(data, info);
  const border = dominantBorderColour(data, info);
  const borderResult = profile.meaningful
    ? { data: Buffer.from(data), removedPixels: 0 }
    : removeBorderMatte(data, info, border.rgb);
  const interiorResult = removeSuspiciousInteriorMatte(borderResult.data, info, border.rgb, profile.meaningful);
  const contourResult = profile.meaningful
    ? { data: interiorResult.data, removedPixels: 0 }
    : contractDerivedMatteMask(interiorResult.data, info);
  const output = contourResult.data;
  for (let index = 0; index < output.length; index += info.channels) {
    if (output[index + 3] > 3) continue;
    output[index] = 0; output[index + 1] = 0; output[index + 2] = 0; output[index + 3] = 0;
  }
  return {
    data: output,
    diagnostics: {
      strategy: profile.meaningful ? 'source-alpha-preferred' : 'adaptive-border-matte',
      sourceTransparentPixelCount: profile.transparentPixels,
      sourcePartialAlphaPixelCount: profile.partialPixels,
      sourceTransparentRatio: profile.transparentRatio,
      sourceBorderTransparentRatio: profile.borderTransparentRatio,
      inferredBackgroundRgb: border.rgb,
      inferredBackgroundDominance: border.dominance,
      borderBackgroundPixelsRemoved: borderResult.removedPixels,
      enclosedBackgroundPixelsRemoved: interiorResult.removedPixels,
      enclosedBackgroundRegionsRemoved: interiorResult.removedRegions,
      contaminatedContourPixelsRemoved: contourResult.removedPixels,
    },
  };
}

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
    // ImageGen's painted checker carries a neutral drop-shadow around the
    // subject. Treating only the two bright checker colours as background
    // leaves their darker, grid-shaped shadow in alpha and defringe then turns
    // it into a charcoal sticker halo. The production palette is deliberately
    // warm/ember-chromatic, so a connected neutral range can be removed much
    // more firmly without deleting authored copper, skin or flame highlights.
    if ((neutral < 42 && luminance >= 45) || (neutral < 58 && luminance >= 120)) alpha = 0;
    else if (neutral < 52 && luminance >= 70) alpha = Math.round(255 * (120 - luminance) / 50);
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

/** Remove large enclosed near-white generation islands without erasing small authored highlights. */
function removeEnclosedNeutralMatte(data, info) {
  const output = Buffer.from(data);
  const candidate = new Uint8Array(info.width * info.height);
  for (let pixel = 0; pixel < candidate.length; pixel += 1) {
    const index = pixel * info.channels;
    const r = output[index]; const g = output[index + 1]; const b = output[index + 2];
    const high = Math.max(r, g, b); const low = Math.min(r, g, b);
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
    candidate[pixel] = output[index + 3] > 12 && high - low < 28 && luminance >= 218 ? 1 : 0;
  }
  const queue = new Int32Array(candidate.length);
  for (let start = 0; start < candidate.length; start += 1) {
    if (!candidate[start]) continue;
    let head = 0; let tail = 0; queue[tail++] = start; candidate[start] = 0;
    const pixels = [];
    while (head < tail) {
      const pixel = queue[head++]; pixels.push(pixel);
      const x = pixel % info.width;
      for (const next of [pixel - 1, pixel + 1, pixel - info.width, pixel + info.width]) {
        if (next < 0 || next >= candidate.length || !candidate[next] || Math.abs(next % info.width - x) > 1) continue;
        candidate[next] = 0; queue[tail++] = next;
      }
    }
    if (pixels.length < 24) continue;
    for (const pixel of pixels) output[pixel * info.channels + 3] = 0;
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
export function defringe(data, width, height) {
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

/**
 * Replace residual near-white RGB in translucent edge pixels with nearby
 * authored material colour. Canvas compositing otherwise exposes those source
 * backdrop colours as a pale halo on the game's dark red backgrounds.
 */
export function scrubPartialNeutralMatte(data, width, height) {
  const source = Buffer.from(data);
  const output = Buffer.from(data);
  const at = (x, y) => (y * width + x) * 4;
  const isNeutralBright = (index, threshold = 160) => {
    const r = source[index]; const g = source[index + 1]; const b = source[index + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) < 24 && (r + g + b) / 3 > threshold;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = at(x, y);
      const alpha = source[index + 3];
      if (alpha <= 0 || alpha >= 245 || !isNeutralBright(index)) continue;
      let replacement = null;
      for (let radius = 1; radius <= 8 && replacement === null; radius += 1) {
        for (let oy = -radius; oy <= radius && replacement === null; oy += 1) {
          for (let ox = -radius; ox <= radius; ox += 1) {
            if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue;
            const nx = x + ox; const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const candidate = at(nx, ny);
            if (source[candidate + 3] >= 245 && !isNeutralBright(candidate)) {
              replacement = candidate;
              break;
            }
          }
        }
      }
      if (replacement !== null) {
        output[index] = source[replacement];
        output[index + 1] = source[replacement + 1];
        output[index + 2] = source[replacement + 2];
      } else {
        const luminance = (source[index] + source[index + 1] + source[index + 2]) / 3;
        const scale = Math.min(1, 155 / Math.max(1, luminance));
        output[index] = Math.round(source[index] * scale);
        output[index + 1] = Math.round(source[index + 1] * scale);
        output[index + 2] = Math.round(source[index + 2] * scale);
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

export function frameMetrics(data, width, height) {
  const bounds = alphaBounds(data, width, height);
  let weight = 0; let weightedX = 0; let edgeAlphaPixels = 0; let partialNeutralBrightPixels = 0; let partialPixels = 0;
  let visiblePixels = 0; let transparentPixels = 0; let opaquePixels = 0; let detachedPartialAlphaPixelCount = 0;
  const occupied = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha > 12) { occupied[y * width + x] = 1; visiblePixels += 1; }
      else transparentPixels += 1;
      if (alpha >= 245) opaquePixels += 1;
      if (alpha > 0) {
        weight += alpha; weightedX += x * alpha;
        if (x < 4 || y < 4 || x >= width - 4 || y >= height - 4) edgeAlphaPixels += 1;
      }
      if (alpha > 0 && alpha < 245) {
        partialPixels += 1;
        const r = data[index]; const g = data[index + 1]; const b = data[index + 2];
        if (Math.max(r, g, b) - Math.min(r, g, b) < 24 && (r + g + b) / 3 > 190) partialNeutralBrightPixels += 1;
        let adjacentOpaque = false;
        for (let oy = -1; oy <= 1 && !adjacentOpaque; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if ((ox === 0 && oy === 0) || x + ox < 0 || y + oy < 0 || x + ox >= width || y + oy >= height) continue;
            if (data[((y + oy) * width + x + ox) * 4 + 3] >= 245) { adjacentOpaque = true; break; }
          }
        }
        if (!adjacentOpaque) detachedPartialAlphaPixelCount += 1;
      }
    }
  }
  let brightNeutralInteriorPixelCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      const index = pixel * 4;
      if (data[index + 3] < 245) continue;
      const r = data[index]; const g = data[index + 1]; const b = data[index + 2];
      if (pixelLuminance(r, g, b) < 218 || pixelChroma(r, g, b) >= 24) continue;
      let enclosed = true;
      for (let oy = -1; oy <= 1 && enclosed; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (occupied[(y + oy) * width + x + ox] === 0) { enclosed = false; break; }
        }
      }
      if (enclosed) brightNeutralInteriorPixelCount += 1;
    }
  }
  let largest = 0; let total = 0; let componentCount = 0;
  const queue = new Int32Array(width * height);
  for (let start = 0; start < occupied.length; start += 1) {
    if (!occupied[start]) continue;
    componentCount += 1;
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
    transparentGutterPixels: Math.min(bounds.left, bounds.top, width - bounds.left - bounds.width, height - bounds.top - bounds.height),
    visiblePixelCount: visiblePixels,
    transparentPixelCount: transparentPixels,
    opaquePixelCount: opaquePixels,
    partialAlphaPixelCount: partialPixels,
    detachedPartialAlphaPixelCount,
    brightNeutralEdgePixelCount: partialNeutralBrightPixels,
    brightNeutralInteriorPixelCount,
    connectedComponentCount: componentCount,
    alphaCoverageRatio: roundRatio(visiblePixels / Math.max(1, width * height)),
    largestComponentRatio: roundRatio(largest / Math.max(1, total)),
    matteRatio: roundRatio(partialNeutralBrightPixels / Math.max(1, partialPixels)),
    internalNeutralResidueRatio: roundRatio(brightNeutralInteriorPixelCount / Math.max(1, visiblePixels)),
  };
}

export async function normalizedSource(path, checker, backgroundRemoval) {
  const image = sharp(path).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const rgba = info.channels === 4 ? data : Buffer.from(data);
  const smartResult = backgroundRemoval === 'smart-alpha' ? deriveSmartCharacterAlpha(rgba, info) : null;
  const alphaReady = smartResult?.data ?? (backgroundRemoval === 'border-neutral'
    ? removeEnclosedNeutralMatte(deriveBorderNeutralAlpha(rgba, info), info)
    : checker ? deriveCheckerAlpha(rgba, info) : rgba);
  // Smart alpha is defringed after cell extraction/resampling, where the audit
  // observes the exact pixels that will be encoded in the atlas.
  const defringed = backgroundRemoval === 'smart-alpha' ? alphaReady : defringe(alphaReady, info.width, info.height);
  const cleaned = backgroundRemoval === 'border-neutral'
    ? scrubPartialNeutralMatte(defringed, info.width, info.height)
    : defringed;
  return { data: cleaned, width: info.width, height: info.height, alphaCleanup: smartResult?.diagnostics };
}

export async function extractCell(source, columns, rows, index, targetWidth, targetHeight, componentMode, preserveCellFraming = false, framingScale = 1) {
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
  const defringedPixelCounts = [];
  const sourceFrameMetrics = spec.indices.map((sourceIndex) => {
    const sourceColumn = sourceIndex % spec.sourceColumns;
    const sourceRow = Math.floor(sourceIndex / spec.sourceColumns);
    const sourceFrameWidth = Math.round((sourceColumn + 1) * source.width / spec.sourceColumns) - Math.round(sourceColumn * source.width / spec.sourceColumns);
    const sourceFrameHeight = Math.round((sourceRow + 1) * source.height / spec.sourceRows) - Math.round(sourceRow * source.height / spec.sourceRows);
    return {
      sourceFrameWidth,
      sourceFrameHeight,
      sourceToAtlasUpscale: roundRatio(Math.max(spec.frameWidth / sourceFrameWidth, spec.frameHeight / sourceFrameHeight)),
    };
  });
  const upscaleLimit = spec.strictAlphaAudit?.sourceToAtlasUpscaleMax ?? Infinity;
  for (const [index, metrics] of sourceFrameMetrics.entries()) {
    if (!Number.isFinite(metrics.sourceToAtlasUpscale) || metrics.sourceToAtlasUpscale > upscaleLimit) throw new Error(`${spec.clip}/${index}: sourceToAtlasUpscale ${metrics.sourceToAtlasUpscale} exceeds ${upscaleLimit}`);
  }
  for (const sourceIndex of spec.indices) {
    const extracted = await extractCell(source, spec.sourceColumns, spec.sourceRows, sourceIndex, spec.frameWidth, spec.frameHeight, spec.componentMode, spec.preserveCellFraming, spec.framingScale);
    let frame = spec.backgroundRemoval === 'border-neutral'
      ? scrubPartialNeutralMatte(extracted, spec.frameWidth, spec.frameHeight)
      : extracted;
    let defringedPixelCount = 0;
    if (spec.backgroundRemoval === 'smart-alpha') {
      const defringed = scrubPartialNeutralMatte(defringe(frame, spec.frameWidth, spec.frameHeight), spec.frameWidth, spec.frameHeight);
      for (let pixel = 0; pixel < spec.frameWidth * spec.frameHeight; pixel += 1) {
        const index = pixel * 4;
        if (frame[index + 3] <= 0 || frame[index + 3] >= 245) continue;
        if (frame[index] !== defringed[index] || frame[index + 1] !== defringed[index + 1] || frame[index + 2] !== defringed[index + 2]) defringedPixelCount += 1;
      }
      frame = defringed;
    }
    frames.push(frame); defringedPixelCounts.push(defringedPixelCount);
  }
  const atlasWidth = spec.columns * spec.frameWidth;
  const atlasHeight = spec.rows * spec.frameHeight;
  const metadataFrames = frames.map((frame, index) => {
    const metrics = frameMetrics(frame, spec.frameWidth, spec.frameHeight);
    if (spec.strictAlphaAudit) {
      const matteLimit = spec.strictAlphaAudit.matteRatioMax ?? 0.01;
      const internalLimit = spec.strictAlphaAudit.internalNeutralResidueRatioMax ?? 0.005;
      const edgeLimit = spec.strictAlphaAudit.edgeAlphaPixelsMax ?? 0;
      const gutterMinimum = spec.strictAlphaAudit.transparentGutterPixelsMin ?? 4;
      const detachedPartialLimit = spec.strictAlphaAudit.detachedPartialAlphaPixelsMax ?? Infinity;
      if (!Number.isFinite(metrics.matteRatio) || metrics.matteRatio > matteLimit) throw new Error(`${spec.clip}/${index}: matteRatio ${metrics.matteRatio} exceeds ${matteLimit}`);
      if (!Number.isFinite(metrics.internalNeutralResidueRatio) || metrics.internalNeutralResidueRatio > internalLimit) throw new Error(`${spec.clip}/${index}: internalNeutralResidueRatio ${metrics.internalNeutralResidueRatio} exceeds ${internalLimit}`);
      if (metrics.edgeAlphaPixels > edgeLimit) throw new Error(`${spec.clip}/${index}: ${metrics.edgeAlphaPixels} alpha pixels touch the guarded cell edge`);
      if (metrics.transparentGutterPixels < gutterMinimum) throw new Error(`${spec.clip}/${index}: transparent gutter ${metrics.transparentGutterPixels}px is below ${gutterMinimum}px`);
      if (metrics.detachedPartialAlphaPixelCount > detachedPartialLimit) throw new Error(`${spec.clip}/${index}: ${metrics.detachedPartialAlphaPixelCount} detached partial-alpha contour pixels exceed ${detachedPartialLimit}`);
    }
    return {
      x: index % spec.columns * spec.frameWidth,
      y: Math.floor(index / spec.columns) * spec.frameHeight,
      w: spec.frameWidth,
      h: spec.frameHeight,
      durationMs: Math.round(100000 / spec.fps) / 100,
      sha256: SHA256(frame),
      alphaSha256: SHA256(alphaChannel(frame)),
      provenance: `Cycle ${spec.cycle ?? '06'} ${spec.generatedBy ?? 'ImageGen'} source ${spec.source}; ${spec.clip} authored frame ${index}; alpha defringe, stable-root fit and ${spec.checker ? 'quality-100' : `quality-${spec.quality ?? 92}/alpha-${spec.alphaQuality ?? 100}`} WebP export only`,
      sockets: spec.sockets?.[index] ?? (spec.socket ? { [spec.socket.name]: spec.socket.value } : undefined),
      anatomicalScale: spec.anatomicalScale?.[index] ?? spec.anatomicalScale ?? 1,
      defringedPixelCount: defringedPixelCounts[index],
      ...sourceFrameMetrics[index],
      ...metrics,
    };
  });
  const composites = frames.map((input, index) => ({ input, raw: { width: spec.frameWidth, height: spec.frameHeight, channels: 4 }, left: index % spec.columns * spec.frameWidth, top: Math.floor(index / spec.columns) * spec.frameHeight }));
  const outputPath = join(root, spec.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await sharp({ create: { width: atlasWidth, height: atlasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .webp(spec.checker
      ? { quality: 100, alphaQuality: 100, smartSubsample: false, effort: 4 }
      : { quality: spec.quality ?? 92, alphaQuality: spec.alphaQuality ?? 100, smartSubsample: spec.smartSubsample ?? true, effort: spec.effort ?? 4 })
    .toFile(outputPath);
  const atlasBytes = await readFile(outputPath);
  const decodedAtlas = await sharp(atlasBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const [index, frame] of metadataFrames.entries()) {
    const alpha = Buffer.alloc(spec.frameWidth * spec.frameHeight);
    const left = index % spec.columns * spec.frameWidth;
    const top = Math.floor(index / spec.columns) * spec.frameHeight;
    for (let y = 0; y < spec.frameHeight; y += 1) {
      for (let x = 0; x < spec.frameWidth; x += 1) {
        alpha[y * spec.frameWidth + x] = decodedAtlas.data[((top + y) * decodedAtlas.info.width + left + x) * 4 + 3];
      }
    }
    frame.encodedAlphaSha256 = SHA256(alpha);
    frame.encodedAlphaExact = frame.encodedAlphaSha256 === frame.alphaSha256;
    if (spec.strictAlphaAudit?.encodedAlphaExact && !frame.encodedAlphaExact) throw new Error(`${spec.clip}/${index}: WebP encoding changed the approved alpha mask`);
  }
  const metadataPath = outputPath.replace(/\.webp$/i, '.json');
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
    encoding: spec.checker
      ? { codec: 'WebP', quality: 100, alphaQuality: 100, smartSubsample: false, effort: 4 }
      : { codec: 'WebP', quality: spec.quality ?? 92, alphaQuality: spec.alphaQuality ?? 100, smartSubsample: spec.smartSubsample ?? true, effort: spec.effort ?? 4 },
    alphaCleanup: source.alphaCleanup,
    strictAlphaAudit: spec.strictAlphaAudit,
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
