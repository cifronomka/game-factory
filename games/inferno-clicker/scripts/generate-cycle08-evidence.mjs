// @ts-check

import { createHash } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { defringe, extractCell, normalizedSource, scrubPartialNeutralMatte } from './build-cycle06-character-assets.mjs';
import { gameRoot as defaultGameRoot } from './lib.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const SOURCE_FINGERPRINT = /^[a-f0-9]{64}$/;
const CLEAN_BUILD_ID = /^0\.1\.1\+[a-f0-9]{12}$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const REQUIRED_COMMANDS = Object.freeze([
  'npm run lint',
  'npm run typecheck',
  'npm test',
  'npm run assets:audit',
  'npm run animation:audit',
  'npm run fingerprint:audit:cycle08',
  'npm run build',
  'npm run test:e2e',
  'npm run release:audit',
]);
const COMMAND_LOG_NAMES = Object.freeze(new Map([
  ['npm run lint', 'lint.log'],
  ['npm run typecheck', 'typecheck.log'],
  ['npm test', 'test.log'],
  ['npm run assets:audit', 'assets-audit.log'],
  ['npm run animation:audit', 'animation-audit.log'],
  ['npm run fingerprint:audit:cycle08', 'fingerprint-audit-cycle08.log'],
  ['npm run build', 'build.log'],
  ['npm run test:e2e', 'e2e.log'],
  ['npm run release:audit', 'release-audit.log'],
]));
const BACKGROUNDS = Object.freeze([
  Object.freeze({ id: 'black', hex: '#000000' }),
  Object.freeze({ id: 'dark-red', hex: '#350b0b' }),
  Object.freeze({ id: 'neutral-gray', hex: '#777777' }),
]);
const VIEWPORTS = Object.freeze([
  Object.freeze({ id: '390x844', width: 390, height: 844 }),
  Object.freeze({ id: '768x1024', width: 768, height: 1024 }),
  Object.freeze({ id: '1366x768', width: 1366, height: 768 }),
  Object.freeze({ id: '800x360', width: 800, height: 360 }),
]);
const DPRS = Object.freeze([1, 2]);
const SUBJECTS = Object.freeze([
  Object.freeze({
    id: 'ash-servant',
    atlasPrefix: 'CH-ASH-SERVANT-',
    clips: Object.freeze(['idle', 'inhale', 'blow', 'recovery']),
    version: 'v6',
  }),
  Object.freeze({
    id: 'demoness',
    atlasPrefix: 'CH-DEMONESS-',
    clips: Object.freeze(['idle', 'cast', 'hold', 'recovery']),
    version: 'v7',
  }),
]);
const REQUIRED_ISSUES = Object.freeze([
  'C08-01-servant-white-matte',
  'C08-02-servant-internal-residue',
  'C08-03-demoness-white-matte',
  'C08-04-demoness-sharpness-scale',
]);
const REQUIRED_REGRESSIONS = Object.freeze([
  'contour-dark-backgrounds',
  'internal-gaps-all-frames',
  'viewport-dpr-matrix',
  'socket-origin-parity',
  'pause-freeze',
  'cancel-cleanup',
  'reduced-motion-semantic-parity',
  'gameplay-timing-parity',
]);
const REQUIRED_ACCEPTANCE = Object.freeze([
  'F-10', 'G-09', 'V-25', 'V-26', 'V-27', 'V-28', 'V-29', 'V-30',
  'A-06', 'PERF-09', 'Y-07', 'Q-09', 'Q-10', 'RLS-07', 'RLS-08',
]);
const BASELINE_BUILD_ID = '0.1.0+a17cdd65fd5a';
const BASELINE_COMMIT = 'a17cdd65fd5af4ec236fd777aa5dd4723664a897';
const FINGERPRINT_GROUPS = Object.freeze([
  'gameplay', 'shell', 'audio', 'audioRegistry', 'platform', 'flame',
  'environment', 'host', 'steamRenderer',
]);
const RENDERER = 'sharp-decoded-webp-all-frame-matrix';
const ART_LIMIT_BYTES = 9.8 * 1024 * 1024;
const DECODED_HARD_LIMIT_BYTES = 64 * 1024 * 1024;
const PACKAGE_LIMIT_BYTES = 15 * 1024 * 1024;
const MOTION_CYCLES = 3;
const MOTION_DELAYS = Object.freeze({ normal: 100, slow: 400 });
const MIN_ENCLOSED_GAP_PIXELS = 16;
const APPROVED_REFERENCE_PATH = 'visual-references/stage-references/stage-5-demoness-reference-view.jpg';
const REFERENCE_FEATURES = Object.freeze(['face', 'crown-hair', 'silhouette', 'closed-high-neck-costume', 'ember-copper-palette', 'proportions', 'hands', 'scale-dominance']);

export const CLI_HELP = `Generate immutable Cycle 08 release evidence from a clean exact dist build.

Usage:
  node scripts/generate-cycle08-evidence.mjs \\
    --render-only <review-bundle-dir> [build options]

  # After QA has reviewed that immutable bundle:
  node scripts/generate-cycle08-evidence.mjs \\
    --qa-review <qa-review.json> \\
    --automation-results <automation-results.json> \\
    --baseline-evidence-dir <reports/corrective-cycle-07/BUILD_ID> \\
    --rendered-evidence-dir <review-bundle-dir> [options]

Required inputs:
  --render-only           First phase: decode exact v6/v7 atlases and create the 48
                          PNG matrices, four animated WebPs, and render-manifest.json.
                          This mode needs no QA assertions and refuses overwrite.
  --qa-review             Human QA decisions, issue chain, independent review,
                          regression pass, evidence references, and four explicit
                          motion PASS references. Human observations are never made up.
  --automation-results    Exact-build command results. Every required command must
                          be PASS with exitCode=0, skipped=0, and a non-empty log file.
  --baseline-evidence-dir An inventoried accepted evidence directory containing the
                          genuine pre-fix PNGs referenced by each issue report.
  --rendered-evidence-dir The immutable render-only bundle that QA actually reviewed.
                          QA JSON must name its render-manifest SHA-256. Final evidence
                          copies these exact bytes and never regenerates them.

Options:
  --game-root <dir>        Game project root (default: current inferno-clicker project).
  --dist-dir <dir>         Clean production build (default: <game-root>/dist).
  --dist-manifest <file>   Build manifest (default: <dist-dir>/build-manifest.json).
  --assets-manifest <file> Asset manifest (default: <dist-dir>/assets/assets-manifest.json).
  --output-root <dir>      Parent evidence directory (default:
                          <game-root>/reports/corrective-cycle-08).
  --help                   Show this help.

The command refuses dirty/working build identities, stale input identities, missing
logs or human review fields, un-inventoried baseline PNGs, existing Build-ID output,
and any atlas/source/hash/budget mismatch. It never overwrites evidence.`;

/** @param {Buffer|string} value */
function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** @param {unknown} condition @param {string} message */
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/** @param {unknown} value @param {string} label */
function objectValue(value, label) {
  invariant(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return /** @type {Record<string, any>} */ (value);
}

/** @param {string} path */
async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

/** @param {string} path @param {unknown} value */
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** @param {string} root @param {string} candidate @param {string} label */
function contained(root, candidate, label) {
  invariant(typeof candidate === 'string' && candidate.length > 0, `${label} path is missing`);
  const absolute = resolve(root, candidate);
  invariant(absolute === root || absolute.startsWith(`${root}${sep}`), `${label} escapes its allowed root: ${candidate}`);
  return absolute;
}

/** @param {string} root @param {string} absolute */
function portable(root, absolute) {
  return relative(root, absolute).split(sep).join('/');
}

/** @param {string} root */
async function walk(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result.sort();
}

/** @param {string} path */
async function fileArtifact(path) {
  const bytes = await readFile(path);
  return Object.freeze({ bytes: bytes.length, sha256: digest(bytes) });
}

/** @param {string} path @param {string} label */
async function assertPng(path, label) {
  const bytes = await readFile(path);
  invariant(bytes.length > PNG_MAGIC.length && bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC), `${label} is not a genuine PNG`);
  const metadata = await sharp(bytes).metadata();
  invariant(metadata.format === 'png' && Number.isInteger(metadata.width) && Number.isInteger(metadata.height), `${label} cannot be decoded as PNG`);
  return Object.freeze({ bytes, width: metadata.width, height: metadata.height, sha256: digest(bytes) });
}

/** @param {any} actual @param {string} buildId @param {string} fingerprint @param {string} label */
function assertExactInputIdentity(actual, buildId, fingerprint, label) {
  invariant(actual?.schemaVersion === 1 && actual?.cycle === '08', `${label} must use Cycle 08 schemaVersion 1`);
  invariant(actual?.buildId === buildId && actual?.sourceFingerprint === fingerprint, `${label} identity is stale or does not match the clean dist build`);
  invariant(actual?.status === 'PASS', `${label} is not PASS`);
}

/** @param {any} qaReview @param {Buffer} manifestBytes */
export function assertCycle08RenderManifestBinding(qaReview, manifestBytes) {
  const manifestSha256 = digest(manifestBytes);
  invariant(qaReview?.renderManifestSha256 === manifestSha256 || qaReview?.visual?.renderManifestSha256 === manifestSha256, 'QA review does not name the exact render-manifest SHA-256');
  return manifestSha256;
}

/** @param {string[]} argv */
export function parseCycle08EvidenceArgs(argv) {
  const values = new Map();
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      help = true;
      continue;
    }
    invariant(token.startsWith('--'), `Unexpected positional argument: ${token}`);
    invariant(!values.has(token), `Duplicate option: ${token}`);
    const value = argv[index + 1];
    invariant(typeof value === 'string' && !value.startsWith('--'), `Missing value for ${token}`);
    values.set(token, value);
    index += 1;
  }
  const known = new Set([
    '--qa-review', '--automation-results', '--baseline-evidence-dir', '--game-root',
    '--dist-dir', '--dist-manifest', '--assets-manifest', '--output-root',
    '--render-only', '--rendered-evidence-dir',
  ]);
  for (const key of values.keys()) invariant(known.has(key), `Unknown option: ${key}`);
  if (help) return Object.freeze({ help: true });
  if (values.has('--render-only')) {
    for (const key of ['--qa-review', '--automation-results', '--baseline-evidence-dir', '--rendered-evidence-dir', '--output-root']) {
      invariant(!values.has(key), `--render-only cannot be combined with ${key}`);
    }
    return Object.freeze({
      help: false,
      renderOnly: true,
      renderOutputDir: values.get('--render-only'),
      gameRoot: values.get('--game-root'),
      distDir: values.get('--dist-dir'),
      distManifestPath: values.get('--dist-manifest'),
      assetsManifestPath: values.get('--assets-manifest'),
    });
  }
  for (const key of ['--qa-review', '--automation-results', '--baseline-evidence-dir', '--rendered-evidence-dir']) {
    invariant(values.has(key), `Missing required option ${key}. Run with --help for the input contract.`);
  }
  return Object.freeze({
    help: false,
    renderOnly: false,
    qaReviewPath: values.get('--qa-review'),
    automationResultsPath: values.get('--automation-results'),
    baselineEvidenceDir: values.get('--baseline-evidence-dir'),
    renderedEvidenceDir: values.get('--rendered-evidence-dir'),
    gameRoot: values.get('--game-root'),
    distDir: values.get('--dist-dir'),
    distManifestPath: values.get('--dist-manifest'),
    assetsManifestPath: values.get('--assets-manifest'),
    outputRoot: values.get('--output-root'),
  });
}

/**
 * Returns the immutable 2 × 3 × 4 × 2 visual matrix contract.
 * @returns {ReadonlyArray<any>}
 */
export function buildCycle08MatrixDescriptors() {
  return Object.freeze(SUBJECTS.flatMap((subject) => BACKGROUNDS.flatMap((background) => VIEWPORTS.flatMap((viewport) => DPRS.map((dpr) => Object.freeze({
    subject: subject.id,
    background: background.id,
    backgroundHex: background.hex,
    viewport: viewport.id,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    dpr,
    physicalWidth: viewport.width * dpr,
    physicalHeight: viewport.height * dpr,
    frameCount: 32,
    renderer: RENDERER,
  }))))));
}

/** @param {number} canvasWidth @param {number} canvasHeight @param {number} frameWidth @param {number} frameHeight */
function bestGrid(canvasWidth, canvasHeight, frameWidth, frameHeight) {
  const candidates = [{ columns: 8, rows: 4 }, { columns: 4, rows: 8 }];
  return candidates.map((grid) => {
    const scale = Math.min((canvasWidth / grid.columns - 2) / frameWidth, (canvasHeight / grid.rows - 2) / frameHeight);
    return { ...grid, score: Math.max(0, scale) * frameWidth * Math.max(0, scale) * frameHeight };
  }).sort((left, right) => right.score - left.score)[0];
}

/**
 * Render a real all-frame matrix. `frames` must be 32 transparent frame images
 * in clip-major, then frame-major order.
 * @param {{frames:Buffer[],descriptor:any,frameWidth:number,frameHeight:number}} options
 */
export async function renderCycle08MatrixPng(options) {
  invariant(Array.isArray(options.frames) && options.frames.length === 32, 'Matrix rendering requires exactly 32 decoded frames');
  const descriptor = options.descriptor;
  invariant(descriptor?.frameCount === 32 && descriptor?.renderer === RENDERER, 'Invalid Cycle 08 matrix descriptor');
  const width = Number(descriptor.physicalWidth);
  const height = Number(descriptor.physicalHeight);
  invariant(Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0, 'Invalid matrix physical dimensions');
  const grid = bestGrid(width, height, options.frameWidth, options.frameHeight);
  const cellWidth = width / grid.columns;
  const cellHeight = height / grid.rows;
  const padding = Math.max(1, Math.round(Number(descriptor.dpr)));
  const scale = Math.min(
    Math.max(1, cellWidth - padding * 2) / options.frameWidth,
    Math.max(1, cellHeight - padding * 2) / options.frameHeight,
  );
  const renderedWidth = Math.max(1, Math.floor(options.frameWidth * scale));
  const renderedHeight = Math.max(1, Math.floor(options.frameHeight * scale));
  const resized = await Promise.all(options.frames.map((frame) => sharp(frame)
    .resize(renderedWidth, renderedHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer()));
  const composites = resized.map((input, index) => {
    const column = index % grid.columns;
    const row = Math.floor(index / grid.columns);
    return {
      input,
      left: Math.max(0, Math.round(column * cellWidth + (cellWidth - renderedWidth) / 2)),
      top: Math.max(0, Math.round(row * cellHeight + (cellHeight - renderedHeight) / 2)),
    };
  });
  const png = await sharp({ create: { width, height, channels: 4, background: descriptor.backgroundHex } })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
  return Object.freeze({ png, layout: Object.freeze({ columns: grid.columns, rows: grid.rows, order: 'clip-major/frame-major' }) });
}

/**
 * Render a genuine animated WebP from all 32 decoded atlas frames. Each authored
 * frame is shown once per cycle; three complete cycles are encoded.
 * @param {{frames:Buffer[],speed:'normal'|'slow',cycles?:number,width?:number,height?:number,backgroundHex?:string}} options
 */
export async function renderCycle08MotionWebp(options) {
  invariant(Array.isArray(options.frames) && options.frames.length === 32, 'Motion rendering requires exactly 32 decoded frames');
  invariant(options.speed === 'normal' || options.speed === 'slow', 'Motion speed must be normal or slow');
  const cycles = options.cycles ?? MOTION_CYCLES;
  invariant(Number.isInteger(cycles) && cycles >= 3, 'Motion evidence requires at least three cycles');
  const width = options.width ?? 192;
  const height = options.height ?? 256;
  const backgroundHex = options.backgroundHex ?? '#350b0b';
  const authoredPages = [];
  for (const frame of options.frames) {
    authoredPages.push(await sharp({ create: { width, height, channels: 4, background: backgroundHex } })
      .composite([{ input: await sharp(frame).resize(width - 8, height - 8, { fit: 'contain', kernel: sharp.kernel.lanczos3 }).png().toBuffer(), gravity: 'center' }])
      .raw()
      .toBuffer());
  }
  const pages = Array.from({ length: cycles }, () => authoredPages).flat();
  const frameDelayMs = MOTION_DELAYS[options.speed];
  const delay = Array.from({ length: pages.length }, () => frameDelayMs);
  const webp = await sharp(Buffer.concat(pages), {
    raw: { width, height: height * pages.length, channels: 4, pageHeight: height },
  }).webp({ lossless: true, effort: 4, loop: 0, delay }).toBuffer();
  const metadata = await sharp(webp, { animated: true }).metadata();
  invariant(metadata.format === 'webp' && metadata.pages === pages.length && metadata.pageHeight === height, 'Animated WebP verification failed');
  invariant(Array.isArray(metadata.delay) && metadata.delay.length === pages.length && metadata.delay.every((value) => value === frameDelayMs), 'Animated WebP timing verification failed');
  return Object.freeze({
    webp,
    cycles,
    pageCount: pages.length,
    frameDelayMs,
    durationMs: pages.length * frameDelayMs,
    width,
    height,
  });
}

/** @param {string} distDir @param {string} manifestPath */
async function readAndVerifyDist(distDir, manifestPath) {
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  invariant(manifest.version === '0.1.1', 'Cycle 08 evidence requires release version 0.1.1');
  invariant(manifest.clean === true && CLEAN_BUILD_ID.test(String(manifest.buildId ?? '')), 'Cycle 08 evidence requires a clean exact dist build (working identities are forbidden)');
  invariant(COMMIT_SHA.test(String(manifest.commitSha ?? '')) && manifest.buildId.endsWith(manifest.commitSha.slice(0, 12)), 'Clean dist commit identity is invalid');
  invariant(SOURCE_FINGERPRINT.test(String(manifest.sourceFingerprint ?? '')), 'Clean dist source fingerprint is invalid');
  invariant(Array.isArray(manifest.files) && manifest.files.length > 0, 'Clean dist build manifest inventory is empty');
  const inventory = new Map();
  for (const entry of manifest.files) {
    invariant(typeof entry?.path === 'string' && !entry.path.includes('\\') && !inventory.has(entry.path), `Invalid or duplicate dist path: ${entry?.path}`);
    const path = contained(distDir, entry.path, 'dist artifact');
    const artifact = await fileArtifact(path);
    invariant(artifact.bytes === entry.bytes && artifact.sha256 === entry.sha256, `Clean dist artifact mismatch: ${entry.path}`);
    inventory.set(entry.path, entry);
  }
  const actual = (await walk(distDir)).map((path) => portable(distDir, path)).filter((path) => path !== portable(distDir, manifestPath));
  invariant(actual.length === inventory.size && actual.every((path) => inventory.has(path)), 'Clean dist contains unlisted or missing files');
  return Object.freeze({ manifest, manifestBytes, inventory });
}

/** @param {Buffer} data @param {number} atlasWidth @param {any} frame */
function frameAlpha(data, atlasWidth, frame) {
  const result = Buffer.alloc(frame.w * frame.h);
  for (let y = 0; y < frame.h; y += 1) {
    for (let x = 0; x < frame.w; x += 1) result[y * frame.w + x] = data[((frame.y + y) * atlasWidth + frame.x + x) * 4 + 3];
  }
  return result;
}

/**
 * Classify exterior transparency, enclosed negative-space holes and detached
 * visible components for one atlas cell. Internal residue is restricted to
 * neutral partial-alpha pixels touching an enclosed hole plus neutral pixels in
 * detached visible islands; authored opaque pale interior is not mislabeled.
 * @param {Buffer} data
 * @param {number} atlasWidth
 * @param {any} frame
 */
export function analyzeCycle08FramePixels(data, atlasWidth, frame) {
  const pixelCount = frame.w * frame.h;
  const exterior = new Uint8Array(pixelCount);
  const transparentVisited = new Uint8Array(pixelCount);
  const meaningfulEnclosed = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueHead = 0;
  let queueTail = 0;
  const alphaAt = (localIndex) => {
    const x = localIndex % frame.w;
    const y = Math.floor(localIndex / frame.w);
    return data[((frame.y + y) * atlasWidth + frame.x + x) * 4 + 3];
  };
  const enqueueExterior = (localIndex) => {
    if (exterior[localIndex] || alphaAt(localIndex) > 12) return;
    exterior[localIndex] = 1;
    queue[queueTail++] = localIndex;
  };
  for (let x = 0; x < frame.w; x += 1) {
    enqueueExterior(x);
    enqueueExterior((frame.h - 1) * frame.w + x);
  }
  for (let y = 1; y < frame.h - 1; y += 1) {
    enqueueExterior(y * frame.w);
    enqueueExterior(y * frame.w + frame.w - 1);
  }
  while (queueHead < queueTail) {
    const current = queue[queueHead++];
    const x = current % frame.w;
    const y = Math.floor(current / frame.w);
    if (x > 0) enqueueExterior(current - 1);
    if (x + 1 < frame.w) enqueueExterior(current + 1);
    if (y > 0) enqueueExterior(current - frame.w);
    if (y + 1 < frame.h) enqueueExterior(current + frame.w);
  }
  let exteriorTransparentPixels = queueTail;
  let enclosedTransparentPixels = 0;
  let enclosedRegionCount = 0;
  let meaningfulEnclosedTransparentPixels = 0;
  let meaningfulEnclosedRegionCount = 0;
  let largestEnclosedRegionPixels = 0;
  for (let start = 0; start < pixelCount; start += 1) {
    if (alphaAt(start) > 12 || exterior[start] || transparentVisited[start]) continue;
    enclosedRegionCount += 1;
    queueHead = 0; queueTail = 0;
    transparentVisited[start] = 1;
    queue[queueTail++] = start;
    while (queueHead < queueTail) {
      const current = queue[queueHead++];
      enclosedTransparentPixels += 1;
      const x = current % frame.w;
      const y = Math.floor(current / frame.w);
      for (const neighbor of [x > 0 ? current - 1 : -1, x + 1 < frame.w ? current + 1 : -1, y > 0 ? current - frame.w : -1, y + 1 < frame.h ? current + frame.w : -1]) {
        if (neighbor < 0 || transparentVisited[neighbor] || exterior[neighbor] || alphaAt(neighbor) > 12) continue;
        transparentVisited[neighbor] = 1;
        queue[queueTail++] = neighbor;
      }
    }
    largestEnclosedRegionPixels = Math.max(largestEnclosedRegionPixels, queueTail);
    if (queueTail >= MIN_ENCLOSED_GAP_PIXELS) {
      meaningfulEnclosedRegionCount += 1;
      meaningfulEnclosedTransparentPixels += queueTail;
      for (let index = 0; index < queueTail; index += 1) meaningfulEnclosed[queue[index]] = 1;
    }
  }
  const visibleVisited = new Uint8Array(pixelCount);
  const visibleComponents = [];
  let visiblePixels = 0;
  for (let start = 0; start < pixelCount; start += 1) {
    if (alphaAt(start) <= 12 || visibleVisited[start]) continue;
    queueHead = 0; queueTail = 0;
    visibleVisited[start] = 1;
    queue[queueTail++] = start;
    let size = 0;
    let neutralPixels = 0;
    while (queueHead < queueTail) {
      const current = queue[queueHead++];
      size += 1; visiblePixels += 1;
      const x = current % frame.w;
      const y = Math.floor(current / frame.w);
      const offset = ((frame.y + y) * atlasWidth + frame.x + x) * 4;
      const red = data[offset]; const green = data[offset + 1]; const blue = data[offset + 2];
      if (Math.max(red, green, blue) - Math.min(red, green, blue) < 24 && (red + green + blue) / 3 > 160) neutralPixels += 1;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if ((offsetX === 0 && offsetY === 0) || x + offsetX < 0 || y + offsetY < 0 || x + offsetX >= frame.w || y + offsetY >= frame.h) continue;
          const neighbor = (y + offsetY) * frame.w + x + offsetX;
          if (visibleVisited[neighbor] || alphaAt(neighbor) <= 12) continue;
          visibleVisited[neighbor] = 1;
          queue[queueTail++] = neighbor;
        }
      }
    }
    visibleComponents.push({ size, neutralPixels });
  }
  const largestVisibleSize = Math.max(0, ...visibleComponents.map((component) => component.size));
  let largestConsumed = false;
  let detachedNeutralIslandPixels = 0;
  for (const component of visibleComponents) {
    if (!largestConsumed && component.size === largestVisibleSize) { largestConsumed = true; continue; }
    detachedNeutralIslandPixels += component.neutralPixels;
  }
  let internalBoundaryPartialPixels = 0;
  let internalNeutralBoundaryPixels = 0;
  for (let localIndex = 0; localIndex < pixelCount; localIndex += 1) {
    const alpha = alphaAt(localIndex);
    if (alpha <= 0 || alpha >= 245) continue;
    const x = localIndex % frame.w;
    const y = Math.floor(localIndex / frame.w);
    let touchesEnclosedGap = false;
    for (let offsetY = -1; offsetY <= 1 && !touchesEnclosedGap; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if ((offsetX === 0 && offsetY === 0) || x + offsetX < 0 || y + offsetY < 0 || x + offsetX >= frame.w || y + offsetY >= frame.h) continue;
        const neighbor = (y + offsetY) * frame.w + x + offsetX;
        if (meaningfulEnclosed[neighbor]) { touchesEnclosedGap = true; break; }
      }
    }
    if (!touchesEnclosedGap) continue;
    internalBoundaryPartialPixels += 1;
    const offset = ((frame.y + y) * atlasWidth + frame.x + x) * 4;
    const red = data[offset]; const green = data[offset + 1]; const blue = data[offset + 2];
    if (Math.max(red, green, blue) - Math.min(red, green, blue) < 24 && (red + green + blue) / 3 > 160) internalNeutralBoundaryPixels += 1;
  }
  return Object.freeze({
    exteriorTransparentPixels,
    enclosedTransparentPixels,
    enclosedRegionCount,
    meaningfulEnclosedTransparentPixels,
    meaningfulEnclosedRegionCount,
    largestEnclosedRegionPixels,
    visibleComponentCount: visibleComponents.length,
    largestVisibleComponentPixels: largestVisibleSize,
    internalBoundaryPartialPixels,
    internalNeutralBoundaryPixels,
    detachedNeutralIslandPixels,
    internalNeutralResidueRatio: (internalNeutralBoundaryPixels + detachedNeutralIslandPixels) / Math.max(1, visiblePixels),
  });
}

/** @param {Buffer} data @param {number} atlasWidth @param {any} frame */
export function pixelMetrics(data, atlasWidth, frame) {
  let partialPixels = 0;
  let neutralBrightPartial = 0;
  let edgeAlphaPixels = 0;
  let detachedPartialAlphaPixels = 0;
  for (let y = frame.y; y < frame.y + frame.h; y += 1) {
    for (let x = frame.x; x < frame.x + frame.w; x += 1) {
      const offset = (y * atlasWidth + x) * 4;
      const alpha = data[offset + 3];
      if ((x < frame.x + 4 || y < frame.y + 4 || x >= frame.x + frame.w - 4 || y >= frame.y + frame.h - 4) && alpha > 0) edgeAlphaPixels += 1;
      if (alpha > 0 && alpha < 245) {
        partialPixels += 1;
        const red = data[offset]; const green = data[offset + 1]; const blue = data[offset + 2];
        if (Math.max(red, green, blue) - Math.min(red, green, blue) < 24 && (red + green + blue) / 3 > 160) neutralBrightPartial += 1;
        let adjacentOpaque = false;
        for (let offsetY = -1; offsetY <= 1 && !adjacentOpaque; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if ((offsetX === 0 && offsetY === 0) || x + offsetX < frame.x || y + offsetY < frame.y || x + offsetX >= frame.x + frame.w || y + offsetY >= frame.y + frame.h) continue;
            if (data[((y + offsetY) * atlasWidth + x + offsetX) * 4 + 3] >= 245) { adjacentOpaque = true; break; }
          }
        }
        if (!adjacentOpaque) detachedPartialAlphaPixels += 1;
      }
    }
  }
  const negativeSpace = analyzeCycle08FramePixels(data, atlasWidth, frame);
  return Object.freeze({
    edgeAlphaPixels,
    matteRatio: neutralBrightPartial / Math.max(1, partialPixels),
    internalNeutralResidueRatio: negativeSpace.internalNeutralResidueRatio,
    detachedPartialAlphaPixels,
    negativeSpace,
  });
}

/** @param {Buffer} approved @param {Buffer} encoded */
function alphaDifference(approved, encoded) {
  invariant(approved.length === encoded.length, 'Approved and encoded alpha masks have different sizes');
  let changedAlphaPixels = 0;
  let maxAlphaError = 0;
  let lowAlphaLeakPixels = 0;
  for (let index = 0; index < approved.length; index += 1) {
    const difference = Math.abs(approved[index] - encoded[index]);
    if (difference > 0) changedAlphaPixels += 1;
    if (difference > maxAlphaError) maxAlphaError = difference;
    if (approved[index] === 0 && encoded[index] > 0) lowAlphaLeakPixels += 1;
  }
  return Object.freeze({ changedAlphaPixels, maxAlphaError, lowAlphaLeakPixels });
}

/** @param {string} path @param {any} expected @param {string} label */
async function verifiedRawImage(path, expected, label) {
  const bytes = await readFile(path);
  if (expected?.sha256) invariant(digest(bytes) === expected.sha256, `${label} SHA-256 mismatch`);
  if (expected?.bytes !== undefined) invariant(bytes.length === expected.bytes, `${label} byte-size mismatch`);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  invariant(info.channels === 4, `${label} is not decodable as RGBA`);
  if (expected?.width !== undefined) invariant(info.width === expected.width, `${label} width mismatch`);
  if (expected?.height !== undefined) invariant(info.height === expected.height, `${label} height mismatch`);
  return Object.freeze({ bytes, data, info });
}

/** @param {string} sourcePath @param {string} destinationPath */
async function copyNonempty(sourcePath, destinationPath) {
  const source = await readFile(sourcePath);
  invariant(source.length > 0, `Evidence source is empty: ${sourcePath}`);
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  return Object.freeze({ bytes: source.length, sha256: digest(source) });
}

/** @param {string} sourcePath @param {string} destinationPath @param {string} label */
async function copyPng(sourcePath, destinationPath, label) {
  const source = await assertPng(sourcePath, label);
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  return Object.freeze({ bytes: source.bytes.length, sha256: source.sha256, width: source.width, height: source.height });
}

/** @param {Record<string,any>} assetManifest @param {string} distDir */
async function computeBudgets(assetManifest, distDir) {
  invariant(Array.isArray(assetManifest.assets), 'Asset manifest bitmap inventory is missing');
  let artBytes = 0;
  let criticalArtBytes = 0;
  let decodedBytes = 0;
  const residency = new Map();
  for (const entry of assetManifest.assets) {
    const path = contained(distDir, entry.path, `asset ${entry.id}`);
    const artifact = await fileArtifact(path);
    invariant(artifact.bytes === entry.bytes && artifact.sha256 === entry.sha256, `${entry.id}: asset bytes/hash mismatch`);
    artBytes += artifact.bytes;
    if (entry.critical === true) criticalArtBytes += artifact.bytes;
    const physicalDecodedBytes = Number(entry.width) * Number(entry.height) * 4;
    invariant(Number.isInteger(physicalDecodedBytes) && physicalDecodedBytes > 0, `${entry.id}: invalid decoded dimensions`);
    if (entry.decodedBytes !== undefined) invariant(entry.decodedBytes === physicalDecodedBytes, `${entry.id}: decoded byte declaration mismatch`);
    if (entry.residencyGroup) {
      const values = residency.get(entry.residencyGroup) ?? [];
      values.push(physicalDecodedBytes);
      residency.set(entry.residencyGroup, values);
    } else decodedBytes += physicalDecodedBytes;
  }
  for (const [group, values] of residency) {
    const contract = assetManifest.residencyGroups?.[group];
    const maxResident = Number(contract?.maxResident);
    invariant(Number.isInteger(maxResident) && maxResident >= 1 && maxResident <= values.length, `${group}: invalid residency contract`);
    decodedBytes += values.sort((left, right) => right - left).slice(0, maxResident).reduce((sum, value) => sum + value, 0);
    const maxCachedFrames = Number(contract?.maxCachedFrames ?? 0);
    const cachedFrameDecodedBytes = Number(contract?.cachedFrameDecodedBytes ?? 0);
    invariant(Number.isInteger(maxCachedFrames) && maxCachedFrames >= 0 && Number.isInteger(cachedFrameDecodedBytes) && cachedFrameDecodedBytes >= 0, `${group}: invalid frame-cache contract`);
    decodedBytes += maxCachedFrames * cachedFrameDecodedBytes;
  }
  const packageBytes = (await Promise.all((await walk(distDir)).map(async (path) => (await stat(path)).size))).reduce((sum, value) => sum + value, 0);
  invariant(artBytes <= ART_LIMIT_BYTES, `Cycle 08 art budget exceeded: ${artBytes}`);
  invariant(decodedBytes <= DECODED_HARD_LIMIT_BYTES, `Cycle 08 decoded residency exceeded: ${decodedBytes}`);
  invariant(packageBytes <= PACKAGE_LIMIT_BYTES, `Cycle 08 package budget exceeded: ${packageBytes}`);
  return Object.freeze({
    artBytes,
    artLimitBytes: ART_LIMIT_BYTES,
    criticalArtBytes,
    decodedBytes,
    decodedHardLimitBytes: DECODED_HARD_LIMIT_BYTES,
    packageBytes,
    packageLimitBytes: PACKAGE_LIMIT_BYTES,
  });
}

/** @param {string} root @param {Record<string,any>} assetManifest @param {string} stageDir */
async function nativeSourceEvidence(root, assetManifest, stageDir) {
  const declaration = objectValue(assetManifest.cycle08SourceManifest, 'cycle08SourceManifest');
  const manifestPath = contained(root, declaration.path, 'Cycle 08 source manifest');
  const manifestBytes = await readFile(manifestPath);
  invariant(manifestBytes.length === declaration.bytes && digest(manifestBytes) === declaration.sha256, 'Cycle 08 source manifest bytes/hash mismatch');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  invariant(manifest.schemaVersion === 1 && manifest.cycle === '08' && Array.isArray(manifest.demonessFrames), 'Invalid Cycle 08 native source manifest');
  invariant(manifest.generationMode === 'built-in OpenAI ImageGen' && SHA256.test(String(manifest.identityMaster?.sha256 ?? '')) && manifest.nativeSourceGate?.oldRasterUpscaleUsed === false, 'Cycle 08 native redraw provenance is incomplete');
  const approvedReference = manifest.approvedReference;
  invariant(approvedReference?.path === APPROVED_REFERENCE_PATH && SHA256.test(String(approvedReference?.sha256 ?? '')) && typeof approvedReference?.provenance === 'string' && approvedReference.provenance.length >= 48, 'Cycle 08 approved Demoness reference provenance is incomplete');
  invariant(JSON.stringify(approvedReference.featureChecklist) === JSON.stringify(REFERENCE_FEATURES), 'Cycle 08 approved Demoness reference feature checklist is incomplete');
  const approvedReferencePath = contained(root, approvedReference.path, 'approved Demoness reference');
  const approvedReferenceBytes = await readFile(approvedReferencePath);
  invariant(digest(approvedReferenceBytes) === approvedReference.sha256, 'Cycle 08 approved Demoness reference hash mismatch');
  const approvedReferenceMetadata = await sharp(approvedReferenceBytes).metadata();
  invariant(approvedReferenceMetadata.width === approvedReference.width && approvedReferenceMetadata.height === approvedReference.height, 'Cycle 08 approved Demoness reference dimensions mismatch');
  invariant(manifest.demonessFrames.length === 32, 'Demoness native source must contain exactly 32 frames');
  const hashes = new Set();
  let minWidth = Infinity;
  let minHeight = Infinity;
  for (const frame of manifest.demonessFrames) {
    invariant(SHA256.test(String(frame.sha256 ?? '')) && Number.isInteger(frame.width) && Number.isInteger(frame.height), `Invalid native source frame: ${frame.path}`);
    const path = contained(root, frame.path, 'Demoness native frame');
    const bytes = await readFile(path);
    invariant(digest(bytes) === frame.sha256, `Demoness native frame hash mismatch: ${frame.path}`);
    const metadata = await sharp(bytes).metadata();
    invariant(metadata.width === frame.width && metadata.height === frame.height, `Demoness native frame dimensions mismatch: ${frame.path}`);
    hashes.add(frame.sha256);
    minWidth = Math.min(minWidth, frame.width);
    minHeight = Math.min(minHeight, frame.height);
  }
  invariant(hashes.size === 32, 'Demoness native source frames are not all unique');
  const evidenceManifestPath = 'assets/native-source-manifest.json';
  const evidenceManifestAbsolute = contained(stageDir, evidenceManifestPath, 'native source manifest evidence');
  await mkdir(dirname(evidenceManifestAbsolute), { recursive: true });
  await writeFile(evidenceManifestAbsolute, manifestBytes);
  const manifestArtifact = Object.freeze({ path: evidenceManifestPath, sha256: digest(manifestBytes), bytes: manifestBytes.length });
  const evidenceReferencePath = 'assets/approved-demoness-reference.jpg';
  const evidenceReferenceAbsolute = contained(stageDir, evidenceReferencePath, 'approved Demoness reference evidence');
  await writeFile(evidenceReferenceAbsolute, approvedReferenceBytes);
  const referenceArtifact = Object.freeze({ path: evidenceReferencePath, sha256: digest(approvedReferenceBytes), bytes: approvedReferenceBytes.length });
  return Object.freeze({
    demonessFrameCount: manifest.demonessFrames.length,
    uniqueFrameHashes: hashes.size,
    minWidth,
    minHeight,
    generationMode: manifest.generationMode,
    identityMasterSha256: manifest.identityMaster.sha256,
    oldRasterUpscaleUsed: manifest.nativeSourceGate.oldRasterUpscaleUsed,
    targetCell: manifest.nativeSourceGate.targetCell,
    maxSourceToAtlasUpscale: manifest.nativeSourceGate.maxSourceToAtlasUpscale,
    approvedReference: Object.freeze({
      path: approvedReference.path,
      sha256: approvedReference.sha256,
      width: approvedReference.width,
      height: approvedReference.height,
      provenance: approvedReference.provenance,
      featureChecklist: approvedReference.featureChecklist,
      artifact: referenceArtifact,
    }),
    manifestPath: declaration.path,
    manifestSha256: digest(manifestBytes),
    manifest: manifestArtifact,
  });
}

/** @param {string} source @param {string} name */
function placementFromSource(source, name) {
  const pattern = new RegExp(`const\\s+${name}_PLACEMENT\\s*=\\s*Object\\.freeze\\(\\{[^}]*?anchorX:\\s*([0-9_]+)[^}]*?anchorY:\\s*([0-9_]+)[^}]*?width:\\s*([0-9_]+)[^}]*?height:\\s*([0-9_]+)`, 's');
  const match = source.match(pattern);
  invariant(match, `Exact dist runtime ${name} placement is missing`);
  return Object.freeze({
    anchorX: Number(match[1].replaceAll('_', '')),
    anchorY: Number(match[2].replaceAll('_', '')),
    width: Number(match[3].replaceAll('_', '')),
    height: Number(match[4].replaceAll('_', '')),
  });
}

/** @param {unknown} left @param {unknown} right */
function coordinatesEqual(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => Math.abs(Number(value) - Number(right[index])) <= 0.000001);
}

/**
 * @param {string} distDir
 * @param {string} fingerprint
 * @param {Map<string,any>} metadataById
 */
async function runtimeEvidence(distDir, fingerprint, metadataById) {
  const modulePath = join(distDir, 'app', 'presentation', 'scene', 'characterScene.js');
  const source = await readFile(modulePath, 'utf8');
  const servantPlacement = placementFromSource(source, 'SERVANT');
  const demonessPlacement = placementFromSource(source, 'DEMONESS');
  const runtimeModule = await import(`${pathToFileURL(modulePath).href}?cycle08-evidence=${fingerprint}`);
  invariant(typeof runtimeModule.servantMouthSocket === 'function' && typeof runtimeModule.demonessHandSockets === 'function', 'Exact dist socket exports are missing');
  let socketMetadataParity = true;
  let maxRootDriftLogicalPx = 0;
  let maxAnatomicalScaleDriftPercent = 0;
  let shortestDemonessVisibleHeight = Infinity;
  let tallestServantVisibleHeight = 0;
  for (const subject of SUBJECTS) {
    const placement = subject.id === 'demoness' ? demonessPlacement : servantPlacement;
    const subjectLogicalRoots = [];
    const subjectScales = [];
    for (const clip of subject.clips) {
      const id = `${subject.atlasPrefix}${clip.toUpperCase()}-C08`;
      const metadata = metadataById.get(id);
      const frames = metadata.clips[clip].frames;
      const logicalRoots = frames.map((frame) => Number(frame.rootY) / Number(frame.h) * placement.height);
      const scales = frames.map((frame) => Number(frame.anatomicalScale));
      subjectLogicalRoots.push(...logicalRoots);
      subjectScales.push(...scales);
      for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        const visibleHeight = (Number(frame.alphaBBox[3]) - Number(frame.alphaBBox[1]) + 1) / Number(frame.h) * placement.height;
        if (subject.id === 'demoness') shortestDemonessVisibleHeight = Math.min(shortestDemonessVisibleHeight, visibleHeight);
        else tallestServantVisibleHeight = Math.max(tallestServantVisibleHeight, visibleHeight);
        if (subject.id === 'ash-servant') socketMetadataParity &&= coordinatesEqual(runtimeModule.servantMouthSocket(clip, index), frame.sockets?.mouth);
        else if (clip === 'cast' || clip === 'hold') {
          const actual = runtimeModule.demonessHandSockets(clip, index);
          socketMetadataParity &&= coordinatesEqual(actual.leftHand, frame.sockets?.leftHand) && coordinatesEqual(actual.rightHand, frame.sockets?.rightHand);
        }
      }
    }
    maxRootDriftLogicalPx = Math.max(maxRootDriftLogicalPx, Math.max(...subjectLogicalRoots) - Math.min(...subjectLogicalRoots));
    maxAnatomicalScaleDriftPercent = Math.max(maxAnatomicalScaleDriftPercent, (Math.max(...subjectScales) - Math.min(...subjectScales)) * 100);
  }
  invariant(socketMetadataParity, 'Exact dist runtime sockets do not match atlas metadata');
  const demonessScaleFactor = demonessPlacement.width / 420;
  invariant(typeof runtimeModule.demonessEffectiveUpscale === 'function', 'Exact dist Demoness upscale export is missing');
  const upscaleSamples = VIEWPORTS.flatMap((viewport) => DPRS.map((dpr) => Object.freeze({
    viewport: viewport.id,
    dpr,
    effectiveUpscale: runtimeModule.demonessEffectiveUpscale(viewport.width, viewport.height, dpr),
  })));
  return Object.freeze({
    runtime: Object.freeze({
      demonessPreviousSize: Object.freeze([demonessPlacement.width / demonessScaleFactor, demonessPlacement.height / demonessScaleFactor]),
      demonessSize: Object.freeze([demonessPlacement.width, demonessPlacement.height]),
      servantSize: Object.freeze([servantPlacement.width, servantPlacement.height]),
      demonessScaleFactor,
      minVisibleHeightRatio: shortestDemonessVisibleHeight / tallestServantVisibleHeight,
      socketMetadataParity,
      maxRootDriftLogicalPx,
      maxAnatomicalScaleDriftPercent,
    }),
    upscaleSamples: Object.freeze(upscaleSamples),
  });
}

/**
 * @param {string} root
 * @param {string} distDir
 * @param {Record<string,any>} assetManifest
 */
async function auditCycle08Atlases(root, distDir, assetManifest) {
  const manifestEntries = new Map(assetManifest.assets.map((entry) => [entry.id, entry]));
  const reports = [];
  const metadataById = new Map();
  const framesBySubject = new Map();
  for (const subject of SUBJECTS) {
    const subjectFrames = [];
    for (const clip of subject.clips) {
      const id = `${subject.atlasPrefix}${clip.toUpperCase()}-C08`;
      const entry = manifestEntries.get(id);
      invariant(entry && entry.version === subject.version, `${id}: required ${subject.version} atlas is missing`);
      const atlasPath = contained(distDir, entry.path, id);
      const metadataPath = contained(distDir, entry.metadata, `${id} metadata`);
      const metadataBytes = await readFile(metadataPath);
      invariant(digest(metadataBytes) === entry.metadataSha256, `${id}: metadata SHA-256 mismatch`);
      const metadata = JSON.parse(metadataBytes.toString('utf8'));
      const frames = metadata.clips?.[clip]?.frames;
      invariant(Array.isArray(frames) && frames.length === 8, `${id}: exactly eight ${clip} frames are required`);
      metadataById.set(id, metadata);
      const atlas = await verifiedRawImage(atlasPath, entry, id);
      const sourcePath = contained(root, entry.sourceSheet, `${id} approved source sheet`);
      const source = await verifiedRawImage(sourcePath, { width: entry.width, height: entry.height, sha256: entry.sourceSheetSha256 }, `${id} approved source sheet`);
      const normalized = await normalizedSource(sourcePath, false, 'smart-alpha');
      const frameAudits = [];
      for (const [frameIndex, frame] of frames.entries()) {
        const encodedAlpha = frameAlpha(atlas.data, atlas.info.width, frame);
        const extracted = await extractCell(normalized, 4, 2, frameIndex, frame.w, frame.h, 'largest', true, 1);
        const approvedFrame = scrubPartialNeutralMatte(defringe(extracted, frame.w, frame.h), frame.w, frame.h);
        const approvedAlpha = frameAlpha(approvedFrame, frame.w, { x: 0, y: 0, w: frame.w, h: frame.h });
        const difference = alphaDifference(approvedAlpha, encodedAlpha);
        const metrics = pixelMetrics(atlas.data, atlas.info.width, frame);
        const encodedAlphaSha256 = digest(encodedAlpha);
        invariant(frame.sha256 === digest(approvedFrame) && frame.alphaSha256 === digest(approvedAlpha), `${id}: approved frame metadata does not match the reproducible source cleanup pipeline`);
        invariant(frame.encodedAlphaSha256 === encodedAlphaSha256, `${id}: encoded alpha metadata does not match decoded WebP`);
        const framePng = await sharp(atlas.data, { raw: { width: atlas.info.width, height: atlas.info.height, channels: 4 } })
          .extract({ left: frame.x, top: frame.y, width: frame.w, height: frame.h })
          .png({ compressionLevel: 9, adaptiveFiltering: false })
          .toBuffer();
        subjectFrames.push(framePng);
        frameAudits.push({ frame, frameIndex, difference, metrics, encodedAlphaSha256 });
      }
      reports.push(Object.freeze({
        id,
        version: entry.version,
        atlas: Object.freeze([entry.width, entry.height]),
        cell: Object.freeze([entry.cellWidth, entry.cellHeight]),
        frameCount: frames.length,
        atlasSha256: digest(atlas.bytes),
        metadataSha256: digest(metadataBytes),
        sourceSheetSha256: digest(source.bytes),
        maxEdgeAlphaPixels: Math.max(...frameAudits.map((audit) => audit.metrics.edgeAlphaPixels)),
        maxMatteRatio: Math.max(...frameAudits.map((audit) => audit.metrics.matteRatio)),
        maxInternalNeutralResidueRatio: Math.max(...frameAudits.map((audit) => audit.metrics.internalNeutralResidueRatio)),
        maxSourceToAtlasUpscale: Math.max(...frames.map((frame) => Number(frame.sourceToAtlasUpscale))),
        exactAlphaFrames: frameAudits.filter((audit) => audit.difference.changedAlphaPixels === 0 && audit.encodedAlphaSha256 === audit.frame.alphaSha256).length,
        changedAlphaPixels: frameAudits.reduce((sum, audit) => sum + audit.difference.changedAlphaPixels, 0),
        maxAlphaError: Math.max(...frameAudits.map((audit) => audit.difference.maxAlphaError)),
        lowAlphaLeakPixels: frameAudits.reduce((sum, audit) => sum + audit.difference.lowAlphaLeakPixels, 0),
        maxDetachedPartialAlphaPixels: Math.max(...frameAudits.map((audit) => audit.metrics.detachedPartialAlphaPixels)),
        frames: Object.freeze(frameAudits.map((audit) => Object.freeze({
          clip,
          frameIndex: audit.frameIndex,
          alphaSha256: audit.frame.alphaSha256,
          encodedAlphaSha256: audit.encodedAlphaSha256,
          changedAlphaPixels: audit.difference.changedAlphaPixels,
          maxAlphaError: audit.difference.maxAlphaError,
          lowAlphaLeakPixels: audit.difference.lowAlphaLeakPixels,
          edgeAlphaPixels: audit.metrics.edgeAlphaPixels,
          matteRatio: audit.metrics.matteRatio,
          internalNeutralResidueRatio: audit.metrics.internalNeutralResidueRatio,
          detachedPartialAlphaPixels: audit.metrics.detachedPartialAlphaPixels,
          negativeSpace: audit.metrics.negativeSpace,
        }))),
      }));
    }
    invariant(subjectFrames.length === 32, `${subject.id}: decoded all-frame evidence is incomplete`);
    framesBySubject.set(subject.id, Object.freeze(subjectFrames));
  }
  return Object.freeze({ reports: Object.freeze(reports), metadataById, framesBySubject });
}

/** @param {string} baselineDir */
async function baselineInventory(baselineDir) {
  const summaryPath = join(baselineDir, 'summary.json');
  const summary = await readJson(summaryPath);
  invariant(summary.schemaVersion === 1 && summary.cycle === '07' && summary.status === 'PASS', 'Baseline evidence must be an accepted Cycle 07 evidence directory');
  invariant(summary.buildId === basename(baselineDir) && /^0\.1\.0\+[a-f0-9]{12}$/.test(summary.buildId), 'Baseline evidence Build ID is invalid');
  invariant(summary.buildId === '0.1.0+a17cdd65fd5a', 'Cycle 08 issue evidence must use the accepted 0.1.0+a17cdd65fd5a baseline build');
  invariant(Array.isArray(summary.files), 'Baseline evidence inventory is missing');
  const inventory = new Map(summary.files.map((entry) => [entry.path, entry]));
  return Object.freeze({ summary, inventory });
}

/** @param {any} reference */
function matrixKeyFromReference(reference) {
  if (typeof reference?.matrixKey === 'string') return reference.matrixKey;
  const value = reference?.matrix ?? reference;
  if (value && typeof value === 'object' && value.subject && value.background && value.viewport && value.dpr) return `${value.subject}:${value.background}:${value.viewport}:DPR${value.dpr}`;
  return null;
}

/** @param {any} reference */
function cleanEvidenceReference(reference) {
  const value = { ...reference };
  for (const key of ['sourcePath', 'baselinePath', 'matrix', 'matrixKey', 'subject', 'background', 'viewport', 'dpr', 'sha256', 'bytes', 'path']) delete value[key];
  return value;
}

/**
 * @param {any[]} references
 * @param {{baselineDir:string,baseline:any,stageDir:string,outputPrefix:string}} context
 */
async function materializeBeforeEvidence(references, context) {
  invariant(Array.isArray(references) && references.length > 0, `${context.outputPrefix}: genuine before PNG reference is required`);
  const output = [];
  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index];
    const relativePath = reference?.baselinePath ?? reference?.sourcePath ?? reference?.path;
    invariant(typeof relativePath === 'string' && !isAbsolute(relativePath), `${context.outputPrefix}: baseline reference must be relative`);
    const sourcePath = contained(context.baselineDir, relativePath, `${context.outputPrefix} baseline evidence`);
    const inventoryEntry = context.baseline.inventory.get(relativePath.split('\\').join('/'));
    invariant(inventoryEntry, `${context.outputPrefix}: baseline PNG is not inventoried: ${relativePath}`);
    const source = await assertPng(sourcePath, `${context.outputPrefix} before evidence`);
    invariant(source.bytes.length === inventoryEntry.bytes && source.sha256 === inventoryEntry.sha256, `${context.outputPrefix}: baseline inventory hash mismatch`);
    const outputPath = `${context.outputPrefix}/before-${String(index).padStart(2, '0')}.png`;
    await copyPng(sourcePath, contained(context.stageDir, outputPath, 'before output'), `${context.outputPrefix} before evidence`);
    output.push(Object.freeze({ ...cleanEvidenceReference(reference), path: outputPath, sha256: source.sha256, bytes: source.bytes.length, baselinePath: relativePath }));
  }
  return output;
}

/**
 * @param {any[]} references
 * @param {{qaDir:string,stageDir:string,outputPrefix:string,matrix:Map<string,any>}} context
 */
async function materializeAfterEvidence(references, context) {
  invariant(Array.isArray(references) && references.length > 0, `${context.outputPrefix}: genuine after PNG reference is required`);
  const output = [];
  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index];
    const matrixKey = matrixKeyFromReference(reference);
    let sourcePath;
    let sourceDescriptor = null;
    if (matrixKey) {
      sourceDescriptor = context.matrix.get(matrixKey);
      invariant(sourceDescriptor, `${context.outputPrefix}: unknown generated matrix reference ${matrixKey}`);
      sourcePath = contained(context.stageDir, sourceDescriptor.path, 'generated matrix evidence');
    } else {
      const candidate = reference?.sourcePath ?? reference?.path;
      invariant(typeof candidate === 'string', `${context.outputPrefix}: after evidence must reference a generated matrix or sourcePath`);
      sourcePath = resolve(context.qaDir, candidate);
    }
    const source = await assertPng(sourcePath, `${context.outputPrefix} after evidence`);
    const outputPath = `${context.outputPrefix}/after-${String(index).padStart(2, '0')}.png`;
    await copyPng(sourcePath, contained(context.stageDir, outputPath, 'after output'), `${context.outputPrefix} after evidence`);
    output.push(Object.freeze({
      ...cleanEvidenceReference(reference),
      path: outputPath,
      sha256: source.sha256,
      bytes: source.bytes.length,
      ...(sourceDescriptor ? { matrixKey } : {}),
    }));
  }
  return output;
}

/**
 * @param {Record<string,any>} automation
 * @param {{buildId:string,fingerprint:string,commitSha:string,inputDir:string,stageDir:string}} context
 */
async function automationPass(automation, context) {
  assertExactInputIdentity(automation, context.buildId, context.fingerprint, 'Automation results');
  const skipped = automation.skipped ?? automation.testsSkipped;
  invariant(Number.isInteger(automation.testsPassed) && automation.testsPassed > 0 && automation.testsFailed === 0 && skipped === 0, 'Automation results require testsPassed>0, testsFailed=0, and skipped=0');
  invariant(Array.isArray(automation.commands), 'Automation command results are missing');
  const commands = new Map(automation.commands.map((entry) => [entry?.name, entry]));
  invariant(commands.size === automation.commands.length, 'Automation command names must be unique');
  const outputCommands = [];
  for (const name of REQUIRED_COMMANDS) {
    const entry = commands.get(name);
    invariant(entry?.status === 'PASS' && entry?.exitCode === 0, `${name}: automation command must be PASS with exitCode=0`);
    const sourceLog = entry.sourceLogPath ?? entry.logPath ?? entry.log?.sourcePath ?? entry.log?.path;
    invariant(typeof sourceLog === 'string', `${name}: real command log path is required`);
    const sourcePath = resolve(context.inputDir, sourceLog);
    const outputPath = `automation/${COMMAND_LOG_NAMES.get(name)}`;
    const artifact = await copyNonempty(sourcePath, contained(context.stageDir, outputPath, `${name} log output`));
    const clean = { ...entry };
    delete clean.sourceLogPath; delete clean.logPath; delete clean.log;
    outputCommands.push(Object.freeze({
      ...clean,
      name,
      status: 'PASS',
      exitCode: 0,
      logPath: outputPath,
      logSha256: artifact.sha256,
      logBytes: artifact.bytes,
      log: Object.freeze({ path: outputPath, sha256: artifact.sha256, bytes: artifact.bytes }),
    }));
  }
  const fingerprintAuditSource = automation.fingerprintAuditPath ?? automation.fingerprintAudit?.sourcePath;
  invariant(typeof fingerprintAuditSource === 'string', 'Automation results must reference the machine-readable Cycle 08 fingerprint audit JSON');
  const fingerprintAuditSourcePath = resolve(context.inputDir, fingerprintAuditSource);
  const fingerprintAuditBytes = await readFile(fingerprintAuditSourcePath);
  const fingerprintAudit = JSON.parse(fingerprintAuditBytes.toString('utf8'));
  invariant(fingerprintAudit.schemaVersion === 1 && fingerprintAudit.cycle === '08' && fingerprintAudit.status === 'PASS', 'Cycle 08 fingerprint audit schema/status is invalid');
  invariant(fingerprintAudit.baselineBuildId === BASELINE_BUILD_ID && fingerprintAudit.baselineCommit === BASELINE_COMMIT, 'Cycle 08 fingerprint audit baseline identity is invalid');
  invariant(fingerprintAudit.candidateBuildId === context.buildId && fingerprintAudit.candidateCommit === context.commitSha && fingerprintAudit.commitSha === context.commitSha && fingerprintAudit.sourceFingerprint === context.fingerprint, 'Cycle 08 fingerprint audit candidate identity is stale');
  for (const name of FINGERPRINT_GROUPS) {
    const group = fingerprintAudit.groups?.[name];
    const hasFiles = (Number.isInteger(group?.files) && group.files > 0) || (Array.isArray(group?.files) && group.files.length > 0);
    invariant(group?.status === 'PASS' && hasFiles && SHA256.test(String(group.baselineSha256 ?? '')) && group.baselineSha256 === group.candidateSha256, `Cycle 08 frozen fingerprint group is invalid: ${name}`);
  }
  const fingerprintAuditOutputPath = 'automation/fingerprint-audit-cycle08.json';
  const fingerprintAuditOutputAbsolute = contained(context.stageDir, fingerprintAuditOutputPath, 'fingerprint audit output');
  await mkdir(dirname(fingerprintAuditOutputAbsolute), { recursive: true });
  await writeFile(fingerprintAuditOutputAbsolute, fingerprintAuditBytes);
  const fingerprintArtifact = Object.freeze({ path: fingerprintAuditOutputPath, sha256: digest(fingerprintAuditBytes), bytes: fingerprintAuditBytes.length });
  const pass = Object.freeze({
    ...automation,
    schemaVersion: 1,
    cycle: '08',
    buildId: context.buildId,
    sourceFingerprint: context.fingerprint,
    status: 'PASS',
    testsFailed: 0,
    skipped: 0,
    testsSkipped: 0,
    commands: outputCommands,
    fingerprintAuditPath: undefined,
    fingerprintAudit: Object.freeze({
      ...fingerprintArtifact,
      baselineBuildId: fingerprintAudit.baselineBuildId,
      baselineCommit: fingerprintAudit.baselineCommit,
      candidateBuildId: fingerprintAudit.candidateBuildId,
      candidateCommit: fingerprintAudit.candidateCommit,
      groups: fingerprintAudit.groups,
    }),
  });
  return Object.freeze({ pass, fingerprintAudit, fingerprintArtifact });
}

/**
 * Materialize the deterministic images that must exist before a human review.
 * @param {{stageDir:string,framesBySubject:Map<string,Buffer[]>}} context
 */
async function renderVisualArtifacts(context) {
  const descriptors = buildCycle08MatrixDescriptors();
  const screenshots = [];
  for (const descriptor of descriptors) {
    const subject = SUBJECTS.find((candidate) => candidate.id === descriptor.subject);
    const frames = context.framesBySubject.get(descriptor.subject);
    const firstMetadata = await sharp(frames[0]).metadata();
    const rendered = await renderCycle08MatrixPng({
      frames,
      descriptor,
      frameWidth: firstMetadata.width,
      frameHeight: firstMetadata.height,
    });
    const outputPath = `visual/${descriptor.subject}-${descriptor.background}-${descriptor.viewport}-dpr${descriptor.dpr}.png`;
    const absolute = contained(context.stageDir, outputPath, 'visual matrix output');
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, rendered.png);
    const decoded = await sharp(rendered.png).metadata();
    invariant(decoded.width === descriptor.physicalWidth && decoded.height === descriptor.physicalHeight, `${outputPath}: matrix dimensions changed during encoding`);
    const screenshot = Object.freeze({
      ...descriptor,
      path: outputPath,
      sha256: digest(rendered.png),
      bytes: rendered.png.length,
      clips: subject.clips,
      layout: rendered.layout,
    });
    screenshots.push(screenshot);
  }
  const motionEvidence = [];
  for (const subject of SUBJECTS) {
    for (const speed of ['normal', 'slow']) {
      const key = `${subject.id}:${speed}`;
      const motion = await renderCycle08MotionWebp({ frames: context.framesBySubject.get(subject.id), speed, cycles: MOTION_CYCLES });
      const outputPath = `visual/motion/${subject.id}-${speed}.webp`;
      const absolute = contained(context.stageDir, outputPath, 'motion evidence output');
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, motion.webp);
      motionEvidence.push(Object.freeze({
        artifactKey: key,
        subject: subject.id,
        speed,
        cycles: motion.cycles,
        sourceFrameCount: 32,
        pageCount: motion.pageCount,
        frameDelayMs: motion.frameDelayMs,
        durationMs: motion.durationMs,
        width: motion.width,
        height: motion.height,
        path: outputPath,
        sha256: digest(motion.webp),
        bytes: motion.webp.length,
      }));
    }
  }
  invariant(motionEvidence.find((entry) => entry.speed === 'normal').frameDelayMs !== motionEvidence.find((entry) => entry.speed === 'slow').frameDelayMs, 'Normal and slow motion timings must differ');
  return Object.freeze({ screenshots: Object.freeze(screenshots), motionEvidence: Object.freeze(motionEvidence) });
}

/**
 * Verify an immutable render-only bundle and copy its exact reviewed bytes.
 * @param {{renderedEvidenceDir:string,stageDir:string,buildId:string,fingerprint:string,qaReview:any}} context
 */
async function copyReviewedRenderBundle(context) {
  const renderDir = resolve(context.renderedEvidenceDir);
  const manifestPath = join(renderDir, 'render-manifest.json');
  const manifestBytes = await readFile(manifestPath);
  const manifestSha256 = assertCycle08RenderManifestBinding(context.qaReview, manifestBytes);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  invariant(manifest.schemaVersion === 1 && manifest.cycle === '08' && manifest.version === '0.1.1' && manifest.status === 'READY_FOR_QA', 'Invalid Cycle 08 render-only manifest');
  invariant(manifest.buildId === context.buildId && manifest.sourceFingerprint === context.fingerprint, 'Reviewed render bundle identity is stale');
  invariant(Array.isArray(manifest.files) && manifest.files.length > 0, 'Render-only manifest inventory is missing');
  const inventory = new Map();
  for (const entry of manifest.files) {
    invariant(typeof entry?.path === 'string' && !inventory.has(entry.path), `Invalid or duplicate reviewed render path: ${entry?.path}`);
    const source = contained(renderDir, entry.path, 'reviewed render artifact');
    const artifact = await fileArtifact(source);
    invariant(artifact.bytes === entry.bytes && artifact.sha256 === entry.sha256, `Reviewed render artifact changed after signoff: ${entry.path}`);
    const destination = contained(context.stageDir, entry.path, 'final reviewed render artifact');
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    const copied = await fileArtifact(destination);
    invariant(copied.bytes === artifact.bytes && copied.sha256 === artifact.sha256, `Reviewed render copy mismatch: ${entry.path}`);
    inventory.set(entry.path, entry);
  }
  const actual = (await walk(renderDir)).map((path) => portable(renderDir, path)).filter((path) => path !== 'render-manifest.json');
  invariant(actual.length === inventory.size && actual.every((path) => inventory.has(path)), 'Reviewed render bundle contains unlisted or missing files');
  invariant(Array.isArray(manifest.screenshots) && manifest.screenshots.length === 48, 'Reviewed render bundle must contain exactly 48 PNG matrices');
  invariant(Array.isArray(manifest.motionEvidence) && manifest.motionEvidence.length === 4, 'Reviewed render bundle must contain exactly four motion WebPs');
  const expectedMatrix = new Map(buildCycle08MatrixDescriptors().map((entry) => [`${entry.subject}:${entry.background}:${entry.viewport}:DPR${entry.dpr}`, entry]));
  const matrix = new Map();
  for (const screenshot of manifest.screenshots) {
    const key = `${screenshot?.subject}:${screenshot?.background}:${screenshot?.viewport}:DPR${screenshot?.dpr}`;
    const expected = expectedMatrix.get(key);
    invariant(expected && !matrix.has(key), `Invalid or duplicate reviewed PNG matrix: ${key}`);
    for (const name of ['physicalWidth', 'physicalHeight', 'frameCount', 'renderer', 'backgroundHex']) invariant(screenshot[name] === expected[name], `${key}: reviewed matrix ${name} is invalid`);
    const source = contained(renderDir, screenshot.path, 'reviewed PNG matrix');
    const png = await assertPng(source, key);
    invariant(png.sha256 === screenshot.sha256 && png.bytes.length === screenshot.bytes && png.width === expected.physicalWidth && png.height === expected.physicalHeight, `${key}: reviewed PNG matrix bytes/dimensions mismatch`);
    matrix.set(key, screenshot);
  }
  invariant(matrix.size === 48, 'Reviewed PNG matrix is incomplete');
  const motion = new Map();
  for (const entry of manifest.motionEvidence) {
    const key = `${entry?.subject}:${entry?.speed}`;
    invariant(SUBJECTS.some((subject) => subject.id === entry?.subject) && ['normal', 'slow'].includes(entry?.speed) && !motion.has(key), `Invalid or duplicate reviewed motion artifact: ${key}`);
    invariant(entry.cycles >= 3 && entry.sourceFrameCount === 32 && entry.pageCount === entry.cycles * 32 && entry.frameDelayMs === MOTION_DELAYS[entry.speed] && entry.durationMs === entry.pageCount * entry.frameDelayMs, `${key}: reviewed motion timing/coverage is invalid`);
    const bytes = await readFile(contained(renderDir, entry.path, 'reviewed motion artifact'));
    invariant(bytes.length === entry.bytes && digest(bytes) === entry.sha256, `${key}: reviewed motion artifact hash mismatch`);
    const metadata = await sharp(bytes, { animated: true }).metadata();
    invariant(metadata.format === 'webp' && metadata.pages === entry.pageCount && metadata.pageHeight === entry.height && Array.isArray(metadata.delay) && metadata.delay.every((delay) => delay === entry.frameDelayMs), `${key}: reviewed motion WebP is not the declared animation`);
    motion.set(key, entry);
  }
  invariant(motion.size === 4, 'Reviewed motion matrix is incomplete');
  const outputManifestPath = 'visual/render-manifest.json';
  await mkdir(dirname(contained(context.stageDir, outputManifestPath, 'reviewed render manifest output')), { recursive: true });
  await writeFile(contained(context.stageDir, outputManifestPath, 'reviewed render manifest output'), manifestBytes);
  return Object.freeze({
    manifest,
    manifestArtifact: Object.freeze({ path: outputManifestPath, sha256: manifestSha256, bytes: manifestBytes.length }),
    matrix,
  });
}

/**
 * Copy exact production-browser PNGs supplied by QA. These are runtime evidence;
 * the Sharp all-frame matrices remain alpha-review aids and never replace them.
 * @param {any[]} captures
 * @param {{qaDir:string,stageDir:string,buildId:string,fingerprint:string}} context
 */
async function copyBrowserCaptures(captures, context) {
  invariant(Array.isArray(captures), 'QA review must supply production-browser captures');
  const output = [];
  const keys = new Set();
  const coverage = new Set();
  for (const capture of captures) {
    const key = `${capture?.subject}:${capture?.speed}:${capture?.viewport}:DPR${capture?.dpr}`;
    invariant(SUBJECTS.some((subject) => subject.id === capture?.subject) && ['normal', 'slow'].includes(capture?.speed) && VIEWPORTS.some((viewport) => viewport.id === capture?.viewport) && DPRS.includes(capture?.dpr), `Invalid production-browser capture: ${key}`);
    invariant(!keys.has(key), `Duplicate production-browser capture: ${key}`);
    invariant(capture.buildId === context.buildId && capture.sourceFingerprint === context.fingerprint, `${key}: production-browser capture identity is stale`);
    invariant(typeof capture.browser?.name === 'string' && capture.browser.name.length > 0 && typeof capture.browser?.version === 'string' && capture.browser.version.length > 0, `${key}: browser name/version is missing`);
    invariant(Number.isFinite(Date.parse(String(capture.capturedAt ?? ''))) && (typeof capture.state === 'string' ? capture.state.length > 0 : capture.state && typeof capture.state === 'object'), `${key}: capture timestamp/state is missing`);
    const cleanConsole = (value) => value === 0 || (Array.isArray(value) && value.length === 0);
    invariant(cleanConsole(capture.consoleErrors) && cleanConsole(capture.consoleWarnings), `${key}: browser console is not clean`);
    invariant(SHA256.test(String(capture.sha256 ?? '')) && Number.isInteger(capture.bytes) && capture.bytes > 0, `${key}: QA must bind the browser capture SHA-256 and byte size`);
    const sourceReference = capture.sourcePath ?? capture.path;
    invariant(typeof sourceReference === 'string', `${key}: browser capture source path is missing`);
    const sourcePath = resolve(context.qaDir, sourceReference);
    const source = await assertPng(sourcePath, key);
    invariant(source.sha256 === capture.sha256 && source.bytes.length === capture.bytes, `${key}: browser capture bytes changed after QA signoff`);
    const viewport = VIEWPORTS.find((entry) => entry.id === capture.viewport);
    invariant(source.width === viewport.width * capture.dpr && source.height === viewport.height * capture.dpr, `${key}: browser capture dimensions do not match viewport/DPR`);
    const outputPath = `visual/browser/${capture.subject}-${capture.speed}-${capture.viewport}-dpr${capture.dpr}.png`;
    await copyPng(sourcePath, contained(context.stageDir, outputPath, 'production-browser capture output'), key);
    const clean = { ...capture };
    delete clean.sourcePath; delete clean.path;
    output.push(Object.freeze({ ...clean, path: outputPath, sha256: source.sha256, bytes: source.bytes.length }));
    keys.add(key);
    coverage.add(`${capture.subject}:${capture.speed}:${capture.viewport}`);
  }
  for (const subject of SUBJECTS) for (const speed of ['normal', 'slow']) for (const viewport of VIEWPORTS) {
    invariant(coverage.has(`${subject.id}:${speed}:${viewport.id}`), `Production-browser capture is missing ${subject.id}:${speed}:${viewport.id}`);
  }
  invariant(coverage.size === 16 && keys.size >= 16, 'Production-browser capture matrix requires at least 16 unique subject/speed/viewport captures');
  return Object.freeze(output);
}

/**
 * Bind human decisions to the already-rendered, hash-locked bytes.
 * @param {any} visualInput
 * @param {{buildId:string,fingerprint:string,retestQa:string,reviewedBundle:any,browserCaptures:any[],approvedReferenceSha256:string}} context
 */
function visualPass(visualInput, context) {
  invariant(visualInput?.status === 'PASS', 'Human visual review is not PASS');
  invariant(visualInput.reviewOwner === context.retestQa && Number.isFinite(Date.parse(String(visualInput.reviewedAt ?? ''))), 'Human visual review owner/timestamp is invalid');
  invariant(visualInput.framesInspected?.['ash-servant'] === 32 && visualInput.framesInspected?.demoness === 32, 'Human visual review must explicitly inspect all 32 frames per subject');
  invariant(Number(visualInput.normalSpeedCycles) >= 3 && Number(visualInput.slowSpeedCycles) >= 3, 'Human visual review must explicitly inspect at least three normal and slow cycles');
  const referenceReview = visualInput.referenceReview;
  invariant(referenceReview?.owner === context.retestQa && referenceReview?.referenceSha256 === context.approvedReferenceSha256 && Number.isFinite(Date.parse(String(referenceReview?.completedAt ?? ''))), 'Human reference review owner/hash/timestamp is invalid');
  invariant(typeof referenceReview?.observation === 'string' && referenceReview.observation.length >= 48, 'Human reference review observation is missing');
  invariant(REFERENCE_FEATURES.every((feature) => referenceReview?.features?.[feature] === 'PASS'), 'Human reference review did not PASS every authoritative feature');
  const findingKeys = ['whiteEdgeDefects', 'internalGapResidueDefects', 'erasedHighlightDefects', 'blurDefects', 'morphDefects', 'clippingDefects'];
  invariant(findingKeys.every((key) => visualInput.findings?.[key] === 0), 'Human visual findings are incomplete or not PASS');
  invariant(Array.isArray(visualInput.motionReview), 'Human visual review must explicitly reference four generated motion artifacts');
  const motionReviews = new Map(visualInput.motionReview.map((entry) => [entry?.artifactKey ?? `${entry?.subject}:${entry?.speed}`, entry]));
  invariant(motionReviews.size === visualInput.motionReview.length, 'Human motion review artifact references must be unique');
  const motionEvidence = context.reviewedBundle.manifest.motionEvidence.map((artifact) => {
    const review = motionReviews.get(artifact.artifactKey);
    invariant(review?.status === 'PASS' && Number(review?.cycles) >= artifact.cycles, `${artifact.artifactKey}: human QA must explicitly PASS every rendered motion cycle`);
    invariant(typeof review?.owner === 'string' && review.owner.length >= 3 && typeof review?.observation === 'string' && review.observation.length >= 48, `${artifact.artifactKey}: human motion owner/observation is missing`);
    if (review.artifactSha256 !== undefined) invariant(review.artifactSha256 === artifact.sha256, `${artifact.artifactKey}: QA review artifact hash is stale`);
    return Object.freeze({ ...artifact, ...review, artifactKey: artifact.artifactKey, status: 'PASS', sha256: artifact.sha256, bytes: artifact.bytes, path: artifact.path });
  });
  const clean = { ...visualInput };
  delete clean.screenshots; delete clean.motionReview; delete clean.motionEvidence; delete clean.renderer; delete clean.browserCaptures;
  return Object.freeze({
    pass: Object.freeze({
      ...clean,
      buildId: context.buildId,
      sourceFingerprint: context.fingerprint,
      status: 'PASS',
      renderer: RENDERER,
      rendererVersion: sharp.versions.sharp,
      backgrounds: Object.fromEntries(BACKGROUNDS.map((entry) => [entry.id, entry.hex])),
      renderManifestSha256: context.reviewedBundle.manifestArtifact.sha256,
      renderManifest: context.reviewedBundle.manifestArtifact,
      screenshots: context.reviewedBundle.manifest.screenshots,
      motionEvidence,
      browserCaptures: context.browserCaptures,
    }),
    matrix: context.reviewedBundle.matrix,
  });
}

/**
 * @param {any} issuesInput
 * @param {{buildId:string,fingerprint:string,commitSha:string,owners:any,baselineDir:string,baseline:any,qaDir:string,stageDir:string,matrix:Map<string,any>}} context
 */
async function issuesPass(issuesInput, context) {
  invariant(issuesInput?.status === 'PASS' && Array.isArray(issuesInput.issues), 'Human issue/retest pass is missing or not PASS');
  const issues = new Map(issuesInput.issues.map((entry) => [entry?.id, entry]));
  invariant(issues.size === issuesInput.issues.length && REQUIRED_ISSUES.every((id) => issues.has(id)), 'Human issue/retest input does not cover all required Cycle 08 issues');
  const output = [];
  for (const id of REQUIRED_ISSUES) {
    const source = issues.get(id);
    invariant(source.status === 'VERIFIED', `${id}: human issue status must be VERIFIED`);
    invariant(source.report?.owner === context.owners.targetedQa && source.report?.buildId === context.baseline.summary.buildId, `${id}: original report owner/build must reference the accepted baseline`);
    invariant(source.fix?.owner === context.owners.implementation && typeof source.fix?.completedAt === 'string' && typeof source.fix?.summary === 'string', `${id}: implementation fix record is incomplete`);
    invariant(source.independentRetest?.owner === context.owners.retestQa && source.independentRetest?.status === 'PASS', `${id}: independent retest is missing or not PASS`);
    invariant(source.neighboringRegression?.owner === context.owners.retestQa && source.neighboringRegression?.status === 'PASS', `${id}: neighboring regression is missing or not PASS`);
    const reportEvidence = await materializeBeforeEvidence(source.report.evidence, {
      baselineDir: context.baselineDir,
      baseline: context.baseline,
      stageDir: context.stageDir,
      outputPrefix: `issues/${id}`,
    });
    const retestEvidence = await materializeAfterEvidence(source.independentRetest.evidence, {
      qaDir: context.qaDir,
      stageDir: context.stageDir,
      outputPrefix: `issues/${id}`,
      matrix: context.matrix,
    });
    output.push(Object.freeze({
      ...source,
      report: Object.freeze({ ...source.report, evidence: reportEvidence }),
      fix: Object.freeze({ ...source.fix, buildId: context.buildId, commitSha: context.commitSha }),
      independentRetest: Object.freeze({ ...source.independentRetest, evidence: retestEvidence }),
    }));
  }
  return Object.freeze({
    ...issuesInput,
    buildId: context.buildId,
    sourceFingerprint: context.fingerprint,
    status: 'PASS',
    issues: output,
  });
}

/**
 * @param {any} independentInput
 * @param {{buildId:string,fingerprint:string,owners:any,qaDir:string,stageDir:string,matrix:Map<string,any>}} context
 */
async function independentPass(independentInput, context) {
  invariant(independentInput?.status === 'PASS' && independentInput?.owner === context.owners.independentQa, 'Independent human review owner/status is invalid');
  invariant(independentInput.independence === true && independentInput.blind === true && independentInput.fixDisclosedBeforeFirstObservations === false && independentInput.decision === 'PASS', 'Independent human review must be blind, independent, and PASS');
  invariant(Array.isArray(independentInput.observations), 'Independent human observations are missing');
  const observations = new Map(independentInput.observations.map((entry) => [entry?.issueId, entry]));
  invariant(REQUIRED_ISSUES.every((id) => observations.has(id)), 'Independent human observations do not cover every required issue');
  const output = [];
  for (const id of REQUIRED_ISSUES) {
    const observation = observations.get(id);
    invariant(typeof observation.text === 'string' && observation.text.length >= 48, `${id}: independent human observation is not substantive`);
    const evidence = await materializeAfterEvidence(observation.evidence, {
      qaDir: context.qaDir,
      stageDir: context.stageDir,
      outputPrefix: `independent/${id}`,
      matrix: context.matrix,
    });
    output.push(Object.freeze({ ...observation, evidence }));
  }
  return Object.freeze({
    ...independentInput,
    buildId: context.buildId,
    sourceFingerprint: context.fingerprint,
    status: 'PASS',
    observations: output,
  });
}

/** @param {any} regressionInput @param {{buildId:string,fingerprint:string,owners:any,fingerprintAudit:any,fingerprintArtifact:any}} context */
function regressionPass(regressionInput, context) {
  invariant(regressionInput?.status === 'PASS' && regressionInput?.owner === context.owners.regressionQa, 'Human regression owner/status is invalid');
  invariant(regressionInput.openCritical === 0 && regressionInput.openHigh === 0, 'Human regression has open Critical/High defects');
  invariant(REQUIRED_REGRESSIONS.every((id) => regressionInput.scenarios?.includes(id)), 'Human regression input does not cover every required scenario');
  invariant(regressionInput.fingerprintAuditSha256 === context.fingerprintArtifact.sha256, 'Human regression did not review the exact copied fingerprint audit artifact');
  return Object.freeze({
    ...regressionInput,
    buildId: context.buildId,
    sourceFingerprint: context.fingerprint,
    status: 'PASS',
    fingerprintAuditSha256: context.fingerprintArtifact.sha256,
    fingerprintAudit: context.fingerprintArtifact,
    frozenFingerprints: Object.freeze({
      status: 'PASS',
      baselineBuildId: context.fingerprintAudit.baselineBuildId,
      baselineCommit: context.fingerprintAudit.baselineCommit,
      candidateBuildId: context.fingerprintAudit.candidateBuildId,
      candidateCommit: context.fingerprintAudit.candidateCommit,
      commitSha: context.fingerprintAudit.commitSha,
      sourceFingerprint: context.fingerprintAudit.sourceFingerprint,
      audit: context.fingerprintArtifact,
      groups: context.fingerprintAudit.groups,
    }),
  });
}

/** @param {any} acceptanceInput @param {{buildId:string,fingerprint:string,stageDir:string}} context */
async function acceptancePass(acceptanceInput, context) {
  invariant(acceptanceInput?.status === 'PASS' && acceptanceInput?.decision === 'PASS', 'Explicit Cycle 08 acceptance decision is missing or not PASS');
  invariant(acceptanceInput.openCritical === 0 && acceptanceInput.openHigh === 0, 'Cycle 08 acceptance cannot PASS with open Critical/High defects');
  invariant(typeof acceptanceInput.owner === 'string' && acceptanceInput.owner.length >= 3 && Number.isFinite(Date.parse(String(acceptanceInput.completedAt ?? ''))), 'Cycle 08 acceptance owner/timestamp is missing');
  invariant(Array.isArray(acceptanceInput.criteria), 'Cycle 08 acceptance criteria must be explicit records with evidence links');
  const supplied = acceptanceInput.criteria;
  const criteria = new Map(supplied.map((entry) => [entry?.id, entry]));
  invariant(criteria.size === supplied.length, 'Cycle 08 acceptance criterion ids must be unique');
  const normalized = [];
  for (const id of REQUIRED_ACCEPTANCE) {
    const criterion = criteria.get(id);
    invariant(criterion?.status === 'PASS', `Cycle 08 acceptance ${id} was not explicitly approved PASS`);
    invariant(Array.isArray(criterion.evidence) && criterion.evidence.length > 0, `Cycle 08 acceptance ${id} has no exact evidence links`);
    const evidence = [];
    for (const reference of criterion.evidence) {
      const candidate = typeof reference === 'string' ? reference : reference?.path;
      invariant(typeof candidate === 'string' && !candidate.includes('\\'), `Cycle 08 acceptance ${id} has an invalid evidence path`);
      const path = contained(context.stageDir, candidate, `Cycle 08 acceptance ${id} evidence`);
      const artifact = await fileArtifact(path);
      invariant(typeof reference === 'object' && reference?.sha256 === artifact.sha256 && reference?.bytes === artifact.bytes, `Cycle 08 acceptance ${id} did not bind the exact evidence hash/size: ${candidate}`);
      evidence.push(Object.freeze({ path: candidate, sha256: artifact.sha256, bytes: artifact.bytes }));
    }
    normalized.push(Object.freeze({ ...criterion, id, status: 'PASS', evidence }));
  }
  return Object.freeze({
    ...acceptanceInput,
    schemaVersion: 1,
    cycle: '08',
    buildId: context.buildId,
    sourceFingerprint: context.fingerprint,
    status: 'PASS',
    decision: 'PASS',
    openCritical: 0,
    openHigh: 0,
    criteria: normalized,
  });
}

/** @param {string} stageDir */
async function evidenceInventory(stageDir) {
  const output = [];
  for (const path of await walk(stageDir)) {
    const candidate = portable(stageDir, path);
    if (candidate === 'summary.json') continue;
    const artifact = await fileArtifact(path);
    output.push(Object.freeze({ path: candidate, bytes: artifact.bytes, sha256: artifact.sha256 }));
  }
  return output;
}

/**
 * First phase of the evidence workflow. It creates deterministic visual bytes
 * before human signoff and records every hash in render-manifest.json.
 *
 * @param {{
 *   renderOutputDir:string,
 *   gameRoot?:string,
 *   distDir?:string,
 *   distManifestPath?:string,
 *   assetsManifestPath?:string,
 * }} options
 */
export async function renderCycle08EvidenceReviewBundle(options) {
  invariant(options.renderOutputDir, '--render-only requires an explicit output directory');
  const root = resolve(options.gameRoot ?? defaultGameRoot);
  const distDir = resolve(options.distDir ?? join(root, 'dist'));
  const distManifestPath = resolve(options.distManifestPath ?? join(distDir, 'build-manifest.json'));
  const assetsManifestPath = resolve(options.assetsManifestPath ?? join(distDir, 'assets', 'assets-manifest.json'));
  const outputDir = resolve(options.renderOutputDir);
  const dist = await readAndVerifyDist(distDir, distManifestPath);
  const assetsManifestBytes = await readFile(assetsManifestPath);
  const assetsManifest = JSON.parse(assetsManifestBytes.toString('utf8'));
  invariant(assetsManifest.schemaVersion === 1 && assetsManifest.game === 'inferno-clicker', 'Invalid exact-dist assets manifest');
  const relativeAssetsManifest = portable(distDir, assetsManifestPath);
  const distAssetsEntry = dist.inventory.get(relativeAssetsManifest);
  invariant(distAssetsEntry && distAssetsEntry.bytes === assetsManifestBytes.length && distAssetsEntry.sha256 === digest(assetsManifestBytes), 'Assets manifest is not the exact inventoried dist artifact');
  await access(outputDir).then(() => { throw new Error(`Refusing to overwrite render-only evidence: ${outputDir}`); }, () => {});
  await mkdir(dirname(outputDir), { recursive: true });
  const stagingRoot = await mkdtemp(join(dirname(outputDir), '.cycle08-render-staging-'));
  const stageDir = join(stagingRoot, basename(outputDir));
  await mkdir(stageDir);
  try {
    const atlasAudit = await auditCycle08Atlases(root, distDir, assetsManifest);
    const visual = await renderVisualArtifacts({ stageDir, framesBySubject: atlasAudit.framesBySubject });
    const files = await evidenceInventory(stageDir);
    const renderManifest = Object.freeze({
      schemaVersion: 1,
      cycle: '08',
      version: dist.manifest.version,
      status: 'READY_FOR_QA',
      buildId: dist.manifest.buildId,
      commitSha: dist.manifest.commitSha,
      sourceFingerprint: dist.manifest.sourceFingerprint,
      buildManifestSha256: digest(dist.manifestBytes),
      renderer: RENDERER,
      rendererVersion: sharp.versions.sharp,
      backgrounds: Object.fromEntries(BACKGROUNDS.map((entry) => [entry.id, entry.hex])),
      screenshots: visual.screenshots,
      motionEvidence: visual.motionEvidence,
      files,
    });
    await writeJson(join(stageDir, 'render-manifest.json'), renderManifest);
    const manifestArtifact = await fileArtifact(join(stageDir, 'render-manifest.json'));
    await rename(stageDir, outputDir);
    await rm(stagingRoot, { recursive: true, force: true });
    return Object.freeze({
      schemaVersion: 1,
      cycle: '08',
      version: dist.manifest.version,
      status: 'READY_FOR_QA',
      buildId: dist.manifest.buildId,
      sourceFingerprint: dist.manifest.sourceFingerprint,
      renderOutputDir: outputDir,
      renderManifestSha256: manifestArtifact.sha256,
      renderManifestBytes: manifestArtifact.bytes,
      matrixScreenshots: visual.screenshots.length,
      motionArtifacts: visual.motionEvidence.length,
    });
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Generate a fail-closed, immutable Cycle 08 evidence directory.
 *
 * @param {{
 *   qaReviewPath:string,
 *   automationResultsPath:string,
 *   baselineEvidenceDir:string,
 *   renderedEvidenceDir:string,
 *   gameRoot?:string,
 *   distDir?:string,
 *   distManifestPath?:string,
 *   assetsManifestPath?:string,
 *   outputRoot?:string,
 * }} options
 */
export async function generateCycle08Evidence(options) {
  const root = resolve(options.gameRoot ?? defaultGameRoot);
  const distDir = resolve(options.distDir ?? join(root, 'dist'));
  const distManifestPath = resolve(options.distManifestPath ?? join(distDir, 'build-manifest.json'));
  const assetsManifestPath = resolve(options.assetsManifestPath ?? join(distDir, 'assets', 'assets-manifest.json'));
  const outputRoot = resolve(options.outputRoot ?? join(root, 'reports', 'corrective-cycle-08'));
  const qaReviewPath = resolve(String(options.qaReviewPath ?? ''));
  const automationResultsPath = resolve(String(options.automationResultsPath ?? ''));
  const baselineEvidenceDir = resolve(String(options.baselineEvidenceDir ?? ''));
  const renderedEvidenceDir = resolve(String(options.renderedEvidenceDir ?? ''));
  invariant(options.qaReviewPath, 'A real --qa-review JSON input is required; human observations are never fabricated');
  invariant(options.automationResultsPath, 'A real --automation-results JSON input is required; command results are never fabricated');
  invariant(options.baselineEvidenceDir, 'A real --baseline-evidence-dir is required for genuine pre-fix PNGs');
  invariant(options.renderedEvidenceDir, 'A real --rendered-evidence-dir is required; reviewed visuals are never regenerated after signoff');

  const dist = await readAndVerifyDist(distDir, distManifestPath);
  const buildId = dist.manifest.buildId;
  const fingerprint = dist.manifest.sourceFingerprint;
  const finalDir = join(outputRoot, buildId);
  await access(finalDir).then(() => { throw new Error(`Immutable Cycle 08 evidence already exists: ${finalDir}`); }, () => {});
  const qaReview = await readJson(qaReviewPath);
  const automationInput = await readJson(automationResultsPath);
  assertExactInputIdentity(qaReview, buildId, fingerprint, 'QA review');
  const owners = objectValue(qaReview.passOwners, 'QA review passOwners');
  const ownerValues = [owners.implementation, owners.targetedQa, owners.retestQa, owners.independentQa, owners.regressionQa];
  invariant(ownerValues.every((value) => typeof value === 'string' && value.length >= 3) && new Set(ownerValues).size === ownerValues.length, 'QA review requires five distinct pass owners');
  const baseline = await baselineInventory(baselineEvidenceDir);
  const assetsManifestBytes = await readFile(assetsManifestPath);
  const assetsManifest = JSON.parse(assetsManifestBytes.toString('utf8'));
  invariant(assetsManifest.schemaVersion === 1 && assetsManifest.game === 'inferno-clicker', 'Invalid exact-dist assets manifest');
  const relativeAssetsManifest = portable(distDir, assetsManifestPath);
  const distAssetsEntry = dist.inventory.get(relativeAssetsManifest);
  invariant(distAssetsEntry && distAssetsEntry.bytes === assetsManifestBytes.length && distAssetsEntry.sha256 === digest(assetsManifestBytes), 'Assets manifest is not the exact inventoried dist artifact');

  await mkdir(outputRoot, { recursive: true });
  const stagingRoot = await mkdtemp(join(outputRoot, '.cycle08-staging-'));
  const stageDir = join(stagingRoot, buildId);
  await mkdir(stageDir);
  try {
    const atlasAudit = await auditCycle08Atlases(root, distDir, assetsManifest);
    const runtime = await runtimeEvidence(distDir, fingerprint, atlasAudit.metadataById);
    const budgets = await computeBudgets(assetsManifest, distDir);
    const nativeSource = await nativeSourceEvidence(root, assetsManifest, stageDir);
    const automation = await automationPass(automationInput, {
      buildId,
      fingerprint,
      commitSha: dist.manifest.commitSha,
      inputDir: dirname(automationResultsPath),
      stageDir,
    });
    const reviewedBundle = await copyReviewedRenderBundle({
      renderedEvidenceDir,
      stageDir,
      buildId,
      fingerprint,
      qaReview,
    });
    const browserCaptures = await copyBrowserCaptures(qaReview.visual?.browserCaptures, {
      qaDir: dirname(qaReviewPath),
      stageDir,
      buildId,
      fingerprint,
    });
    const visual = visualPass(qaReview.visual, {
      buildId,
      fingerprint,
      retestQa: owners.retestQa,
      reviewedBundle,
      browserCaptures,
      approvedReferenceSha256: nativeSource.approvedReference.sha256,
    });
    const issues = await issuesPass(qaReview.issues, {
      buildId,
      fingerprint,
      commitSha: dist.manifest.commitSha,
      owners,
      baselineDir: baselineEvidenceDir,
      baseline,
      qaDir: dirname(qaReviewPath),
      stageDir,
      matrix: visual.matrix,
    });
    const independent = await independentPass(qaReview.independent, {
      buildId,
      fingerprint,
      owners,
      qaDir: dirname(qaReviewPath),
      stageDir,
      matrix: visual.matrix,
    });
    const regression = regressionPass(qaReview.regression, {
      buildId,
      fingerprint,
      owners,
      fingerprintAudit: automation.fingerprintAudit,
      fingerprintArtifact: automation.fingerprintArtifact,
    });
    const acceptance = await acceptancePass(qaReview.acceptance, { buildId, fingerprint, stageDir });
    const assets = Object.freeze({
      schemaVersion: 1,
      cycle: '08',
      buildId,
      sourceFingerprint: fingerprint,
      status: 'PASS',
      manifestPath: relativeAssetsManifest,
      manifestSha256: digest(assetsManifestBytes),
      atlases: atlasAudit.reports,
      runtime: runtime.runtime,
      upscaleSamples: runtime.upscaleSamples,
      budgets,
      nativeSource,
    });
    await writeJson(join(stageDir, 'automation.json'), automation.pass);
    await writeJson(join(stageDir, 'assets.json'), assets);
    await writeJson(join(stageDir, 'visual.json'), visual.pass);
    await writeJson(join(stageDir, 'issues.json'), issues);
    await writeJson(join(stageDir, 'independent.json'), independent);
    await writeJson(join(stageDir, 'regression.json'), regression);
    await writeJson(join(stageDir, 'acceptance.json'), acceptance);
    const files = await evidenceInventory(stageDir);
    const defects = Object.freeze({
      critical: Math.max(Number(independent.findingsCritical), Number(regression.openCritical)),
      high: Math.max(Number(independent.findingsHigh), Number(regression.openHigh)),
    });
    invariant(defects.critical === 0 && defects.high === 0, 'Cycle 08 evidence cannot PASS with open Critical/High defects');
    const summary = Object.freeze({
      schemaVersion: 1,
      cycle: '08',
      version: dist.manifest.version,
      status: 'PASS',
      buildId,
      commitSha: dist.manifest.commitSha,
      sourceFingerprint: fingerprint,
      buildManifestSha256: digest(dist.manifestBytes),
      defects,
      passOwners: owners,
      passes: Object.freeze({
        automation: 'automation.json',
        assets: 'assets.json',
        visual: 'visual.json',
        issues: 'issues.json',
        independent: 'independent.json',
        regression: 'regression.json',
        acceptance: 'acceptance.json',
      }),
      files,
    });
    await writeJson(join(stageDir, 'summary.json'), summary);
    const summaryArtifact = await fileArtifact(join(stageDir, 'summary.json'));
    const { validateCorrectiveCycle08Evidence } = await import('./validate-corrective-cycle-08-evidence.mjs');
    await validateCorrectiveCycle08Evidence({ evidenceDir: stageDir, distManifestPath });
    await rename(stageDir, finalDir);
    await rm(stagingRoot, { recursive: true, force: true });
    await writeJson(join(outputRoot, 'index.json'), Object.freeze({
      schemaVersion: 1,
      cycle: '08',
      version: dist.manifest.version,
      status: 'PASS',
      buildId,
      sourceFingerprint: fingerprint,
      evidencePath: `${buildId}/`,
      summaryPath: `${buildId}/summary.json`,
      summarySha256: summaryArtifact.sha256,
      summaryBytes: summaryArtifact.bytes,
    }));
    return Object.freeze({
      schemaVersion: 1,
      cycle: '08',
      version: dist.manifest.version,
      buildId,
      evidenceDir: finalDir,
      distManifestPath,
      matrixScreenshots: visual.pass.screenshots.length,
      motionArtifacts: visual.pass.motionEvidence.length,
      files: files.length,
      status: 'PASS',
    });
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const args = parseCycle08EvidenceArgs(process.argv.slice(2));
  if (args.help) {
    console.log(CLI_HELP);
    return;
  }
  if (args.renderOnly) {
    const result = await renderCycle08EvidenceReviewBundle(/** @type {any} */ (args));
    console.log(`Cycle 08 render bundle READY_FOR_QA (${result.buildId}, ${result.matrixScreenshots} PNG matrices, ${result.motionArtifacts} animated WebPs, render-manifest sha256 ${result.renderManifestSha256})`);
    return;
  }
  const result = await generateCycle08Evidence(/** @type {any} */ (args));
  const { validateCorrectiveCycle08Evidence } = await import('./validate-corrective-cycle-08-evidence.mjs');
  await validateCorrectiveCycle08Evidence({ evidenceDir: result.evidenceDir, distManifestPath: result.distManifestPath });
  console.log(`Cycle 08 evidence PASS (${result.buildId}, ${result.matrixScreenshots} PNG matrices, ${result.motionArtifacts} animated WebPs, ${result.files} inventoried files)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
