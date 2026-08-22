// @ts-check

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { defringe, normalizedSource } from './build-cycle06-character-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(root, 'visual-references', 'cycle-08-sources');
const demonessFramesRoot = join(sourceRoot, 'demoness-frames');
const approvedReferenceRelativePath = 'visual-references/stage-references/stage-5-demoness-reference-view.jpg';

const DEMONESS_CELL = Object.freeze({ width: 512, height: 832 });
const DEMONESS_VISIBLE_HEIGHT = 720;
const DEMONESS_MAX_VISIBLE_WIDTH = 500;
const DEMONESS_GUTTER = 6;
const SERVANT_CELL = Object.freeze({ width: 256, height: 320 });

async function cleanAndFrame(path) {
  // Built-in ImageGen sometimes paints the transparency checker into RGB.
  // Remove both neutral checker tones globally before any resize; adaptive
  // single-colour border flood leaves a dark square fringe at the silhouette.
  const source = await normalizedSource(path, true, undefined);
  const trimmed = await sharp(source.data, { raw: { width: source.width, height: source.height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  const proportionalWidth = Math.round(trimmed.info.width * DEMONESS_VISIBLE_HEIGHT / trimmed.info.height);
  const visibleWidth = Math.min(DEMONESS_MAX_VISIBLE_WIDTH, proportionalWidth);
  const left = Math.floor((DEMONESS_CELL.width - visibleWidth) / 2);
  const right = DEMONESS_CELL.width - visibleWidth - left;
  const top = DEMONESS_CELL.height - DEMONESS_VISIBLE_HEIGHT - DEMONESS_GUTTER;
  return sharp(trimmed.data)
    .resize({
      width: visibleWidth,
      height: DEMONESS_VISIBLE_HEIGHT,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .extend({
      top,
      bottom: DEMONESS_GUTTER,
      left,
      right,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function assembleDemonessSheet(clip) {
  const frames = [];
  for (let index = 0; index < 8; index += 1) {
    const path = join(demonessFramesRoot, clip, `frame-${index}.png`);
    frames.push(await cleanAndFrame(path));
  }
  const output = join(sourceRoot, `demoness-${clip}-8-source.png`);
  await sharp({
    create: {
      width: DEMONESS_CELL.width * 4,
      height: DEMONESS_CELL.height * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(frames.map((input, index) => ({
    input,
    left: index % 4 * DEMONESS_CELL.width,
    top: Math.floor(index / 4) * DEMONESS_CELL.height,
  }))).png({ compressionLevel: 9 }).toFile(output);
}

function removeDetachedServantContourTiles(data, width, height) {
  const source = Buffer.from(data);
  const output = Buffer.from(data);
  let removedPixels = 0;
  const opaqueNeighbour = (x, y) => {
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        if (ox === 0 && oy === 0) continue;
        const nx = x + ox; const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (source[(ny * width + nx) * 4 + 3] >= 245) return true;
      }
    }
    return false;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = source[index + 3];
      if (alpha <= 0 || alpha >= 245 || opaqueNeighbour(x, y)) continue;
      output[index] = 0; output[index + 1] = 0; output[index + 2] = 0; output[index + 3] = 0;
      removedPixels += 1;
    }
  }
  return { data: defringe(output, width, height), removedPixels };
}

async function cleanServantSource(clip) {
  const source = join(sourceRoot, `ash-servant-${clip}-8-source.png`);
  const decoded = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (decoded.info.width !== 1024 || decoded.info.height !== 640 || decoded.info.channels !== 4) {
    throw new Error(`${source}: expected retained 1024x640 RGBA Cycle 08 source sheet`);
  }
  const output = Buffer.from(decoded.data);
  for (let index = 0; index < 8; index += 1) {
    const left = index % 4 * SERVANT_CELL.width;
    const top = Math.floor(index / 4) * SERVANT_CELL.height;
    const cell = await sharp(decoded.data, { raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 } })
      .extract({ left, top, width: SERVANT_CELL.width, height: SERVANT_CELL.height })
      .raw()
      .toBuffer();
    const cleaned = removeDetachedServantContourTiles(cell, SERVANT_CELL.width, SERVANT_CELL.height);
    for (let y = 0; y < SERVANT_CELL.height; y += 1) {
      const sourceOffset = y * SERVANT_CELL.width * 4;
      const targetOffset = ((top + y) * decoded.info.width + left) * 4;
      cleaned.data.copy(output, targetOffset, sourceOffset, sourceOffset + SERVANT_CELL.width * 4);
    }
  }
  await sharp(output, { raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(source);
}

async function sourceRecord(relativePath, role) {
  const path = join(sourceRoot, relativePath);
  const [bytes, metadata] = await Promise.all([readFile(path), sharp(path).metadata()]);
  return {
    path: `visual-references/cycle-08-sources/${relativePath.split('\\').join('/')}`,
    role,
    width: metadata.width,
    height: metadata.height,
    channels: metadata.channels,
    hasAlpha: Boolean(metadata.hasAlpha),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

async function rootImageRecord(relativePath, role) {
  const path = join(root, ...relativePath.split('/'));
  const [bytes, metadata] = await Promise.all([readFile(path), sharp(path).metadata()]);
  return {
    path: relativePath,
    role,
    width: metadata.width,
    height: metadata.height,
    channels: metadata.channels,
    hasAlpha: Boolean(metadata.hasAlpha),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

async function writeSourceManifest() {
  const demonessFrames = [];
  for (const clip of ['idle', 'cast', 'hold', 'recovery']) {
    for (let index = 0; index < 8; index += 1) {
      demonessFrames.push(await sourceRecord(join('demoness-frames', clip, `frame-${index}.png`), `${clip} authored frame ${index}`));
    }
  }
  const assembledSheets = [];
  for (const clip of ['idle', 'cast', 'hold', 'recovery']) {
    assembledSheets.push(await sourceRecord(`demoness-${clip}-8-source.png`, `${clip} cleaned 4x2 source sheet`));
  }
  for (const clip of ['idle', 'inhale', 'blow', 'recovery']) {
    assembledSheets.push(await sourceRecord(`ash-servant-${clip}-8-source.png`, `${clip} retained-and-cleaned 4x2 source sheet`));
  }
  const manifest = {
    schemaVersion: 1,
    cycle: '08',
    generationMode: 'built-in OpenAI ImageGen',
    approvedReference: {
      ...await rootImageRecord(approvedReferenceRelativePath, 'Authoritative user-approved Stage 5 Demoness reference'),
      provenance: 'User-supplied Stage 5 reference retained verbatim in visual-references; used as the identity and costume authority for the native C08 redraw.',
      featureChecklist: ['face', 'crown-hair', 'silhouette', 'closed-high-neck-costume', 'ember-copper-palette', 'proportions', 'hands', 'scale-dominance'],
    },
    identityMaster: await sourceRecord('demoness-identity-master.png', 'Demoness identity master'),
    demonessFrames,
    assembledSheets,
    nativeSourceGate: {
      demonessMinimumRawWidth: Math.min(...demonessFrames.map((entry) => entry.width)),
      demonessMinimumRawHeight: Math.min(...demonessFrames.map((entry) => entry.height)),
      targetCell: [512, 832],
      maxSourceToAtlasUpscale: 1,
      oldRasterUpscaleUsed: false,
    },
    servantLineage: {
      policy: 'C07 accepted silhouettes and motion retained; source sheets copied losslessly before superseded runtime files were removed, then alpha/metadata rebuilt as v6',
      c07AtlasSha256: {
        idle: '9ac2921f64c1abad1f0caf35e179bf37db9d5517f6c9a7aa05ce56893f162388',
        inhale: 'dd1f2193d8d81fa18ce0c8914bddac8ef8753c79f53adfa05213d482cd6181c0',
        blow: '5ee00f85cc19d4feca6085d608154817c4f90b1a1a4feae76affbcdb3d5c80ad',
        recovery: 'c7c631a25ce0e6880d8924a2d31d81ad9e23d082bce8d2861f594b83729624bd',
      },
    },
    promptContract: {
      useCase: 'identity-preserving full-body game character redraw',
      positive: 'Use the high-resolution Demoness identity master and the supplied pose reference; preserve face, crown and hair, closed high-neck black armor, ember-copper palette and full-body silhouette; render crisp native detail and clear negative spaces around arms and inside bends.',
      negative: 'No exposed chest, white matte, white halo, neutral residue inside limb gaps, blur, extra limbs, extra fingers, cropping, text or watermark.',
    },
    assembly: {
      checkerRemoval: 'neutral checker tones converted to alpha before resize',
      servantContourCleanup: 'legacy partial-alpha tiles without an adjacent opaque authored pixel are removed; the remaining one-pixel antialias band is defringed from opaque character colour',
      visibleFrameBox: [500, 720],
      cell: [512, 832],
      bottomGutter: 6,
      resizePolicy: 'high-resolution raw portrait is trimmed, downscaled to 720px visible height, width capped at 500px without cropping hands, and bottom-rooted',
    },
  };
  await writeFile(join(sourceRoot, 'source-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function assembleCycle08CharacterSources() {
  await mkdir(sourceRoot, { recursive: true });
  for (const clip of ['idle', 'cast', 'hold', 'recovery']) await assembleDemonessSheet(clip);
  for (const clip of ['idle', 'inhale', 'blow', 'recovery']) await cleanServantSource(clip);
  await writeSourceManifest();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assembleCycle08CharacterSources().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
