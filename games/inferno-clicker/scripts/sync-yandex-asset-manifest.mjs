import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { gameRoot } from './lib.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const clips = ['idle', 'inhale', 'blow', 'recovery'];
const wardenClips = ['idle', 'cast', 'hold', 'recovery'];
const pairs = [
  { id: 'BG-FIRE-CHAMBER-Y2', base: 'assets/backgrounds/bg-fire-chamber-yandex-v3', role: 'background', resident: 'startup' },
  ...clips.map((clip) => ({ id: `ASH-${clip.toUpperCase()}-C09`, base: `assets/characters/ash-servant/ash-servant-${clip}-v7`, role: 'character-atlas', resident: 'active-plus-imminent' })),
  ...wardenClips.map((clip) => ({ id: `EMBER-WARDEN-${clip.toUpperCase()}-C09`, base: `assets/characters/demoness/demoness-${clip}-v8`, role: 'character-atlas', resident: 'one-active-atlas' })),
  { id: 'HOST-MAIN-COMPAT', base: 'assets/characters/character-inferno-host-main-v4', role: 'character-atlas', resident: 'stage-7' },
  { id: 'HOST-SENTINEL-COMPAT', base: 'assets/characters/character-inferno-host-sentinel-v4', role: 'character-atlas', resident: 'stage-7' },
  ...['core-low-v2', 'outer-low-v4', 'core-mid-v2', 'outer-mid-v4', 'core-high-v2', 'outer-high-v4']
    .map((name) => ({ id: `FLAME-${name.toUpperCase()}`, base: `assets/flame/atlases/${name}`, role: 'flame-atlas', resident: 'bounded-family' })),
  { id: 'FLAME-STAGE-FLARE', base: 'assets/flame/transitions/stage-flare-v3', role: 'transition-atlas', resident: 'stage-boundary' },
];

const assets = [];
for (const pair of pairs) {
  const webpPath = `${pair.base}.webp`;
  const pngPath = `${pair.base}.png`;
  const [webp, png] = await Promise.all([readFile(join(gameRoot, webpPath)), readFile(join(gameRoot, pngPath))]);
  const metadata = await sharp(webp, { failOn: 'error' }).metadata();
  assets.push({
    id: pair.id,
    role: pair.role,
    runtimeResidency: pair.resident,
    preferred: { path: webpPath, bytes: webp.length, sha256: hash(webp) },
    fallback: { path: pngPath, bytes: png.length, sha256: hash(png) },
    width: metadata.width,
    height: metadata.height,
    decodedRgbaBytes: Number(metadata.width) * Number(metadata.height) * 4,
    loadPolicy: 'capability-selected; exactly one format requested',
  });
}

const alphaMetadata = [];
for (const pair of pairs.filter((entry) => /^(ASH|EMBER-WARDEN)-/u.test(entry.id))) {
  const metadata = JSON.parse(await readFile(join(gameRoot, `${pair.base}.json`), 'utf8'));
  const clip = Object.values(metadata.clips)[0];
  alphaMetadata.push({
    id: pair.id,
    metadata: `${pair.base}.json`,
    metadataSha256: hash(await readFile(join(gameRoot, `${pair.base}.json`))),
    frames: clip.frames.length,
    removedDetachedPartialAlphaPixelCount: metadata.alphaCleanup.removedDetachedPartialAlphaPixelCount,
    detachedPartialAlphaPixelCountMax: Math.max(...clip.frames.map((frame) => frame.detachedPartialAlphaPixelCount)),
    matteRatioMax: Math.max(...clip.frames.map((frame) => frame.matteRatio)),
    internalNeutralResidueRatioMax: Math.max(...clip.frames.map((frame) => frame.internalNeutralResidueRatio)),
  });
}

const outerFlameMetadata = [];
for (const family of ['low', 'mid', 'high']) {
  const base = `assets/flame/atlases/outer-${family}-v4`;
  const metadataBytes = await readFile(join(gameRoot, `${base}.json`));
  const metadata = JSON.parse(metadataBytes);
  const cleanup = metadata.visualCleanup;
  outerFlameMetadata.push({
    family,
    metadata: `${base}.json`,
    metadataSha256: hash(metadataBytes),
    frames: metadata.frames.length,
    sourceInternalLowChromaMattePixelCount: cleanup.sourceInternalLowChromaMattePixelCount,
    sourceInternalOliveMattePixelCount: cleanup.sourceInternalOliveMattePixelCount,
    sourceStickerEdgePixelCount: cleanup.sourceStickerEdgePixelCount,
    retintedPixelCount: cleanup.retintedPixelCount,
    suppressedMattePixelCount: cleanup.suppressedMattePixelCount,
    featheredStickerEdgePixelCount: cleanup.featheredStickerEdgePixelCount,
    detachedAlphaPixelCount: cleanup.detachedAlphaPixelCount,
    internalLowChromaMattePixelCount: cleanup.internalLowChromaMattePixelCount,
    internalOliveMattePixelCount: cleanup.internalOliveMattePixelCount,
    neutralEdgePixelCount: cleanup.neutralEdgePixelCount,
    coolEdgePixelCount: cleanup.coolEdgePixelCount,
    stickerEdgePixelCount: cleanup.stickerEdgePixelCount,
    pngWebpDecodedRgbaParity: cleanup.pngWebpVisibleDecodedRgbaParity,
  });
}

const stageFlareBase = 'assets/flame/transitions/stage-flare-v3';
const stageFlareMetadataBytes = await readFile(join(gameRoot, `${stageFlareBase}.json`));
const stageFlareMetadata = JSON.parse(stageFlareMetadataBytes);
const stageFlareAudit = {
  metadata: `${stageFlareBase}.json`,
  metadataSha256: hash(stageFlareMetadataBytes),
  frames: stageFlareMetadata.frames.length,
  alphaFloorInclusive: stageFlareMetadata.alphaCleanup.alphaFloorInclusive,
  sourceDetachedAlphaPixelCount: stageFlareMetadata.alphaCleanup.sourceAudit.detachedAlphaPixelCount,
  sourceNeutralEdgePixelCount: stageFlareMetadata.alphaCleanup.sourceAudit.neutralEdgePixelCount,
  sourceCoolEdgePixelCount: stageFlareMetadata.alphaCleanup.sourceAudit.coolEdgePixelCount,
  removedLowAlphaPixelCount: stageFlareMetadata.alphaCleanup.removedLowAlphaPixelCount,
  removedDetachedAlphaPixelCount: stageFlareMetadata.alphaCleanup.removedDetachedAlphaPixelCount,
  detachedAlphaPixelCount: stageFlareMetadata.alphaCleanup.detachedAlphaPixelCount,
  neutralEdgePixelCount: stageFlareMetadata.alphaCleanup.neutralEdgePixelCount,
  coolEdgePixelCount: stageFlareMetadata.alphaCleanup.coolEdgePixelCount,
  backgroundAudits: stageFlareMetadata.alphaCleanup.backgroundAudits,
  pngWebpDecodedRgbaParity: stageFlareMetadata.alphaCleanup.pngWebpDecodedRgbaParity,
};

const decodedById = new Map(assets.map((asset) => [asset.id, asset.decodedRgbaBytes]));
const frameCacheBytes = 512 * 832 * 4;
const residencyScenarios = [
  {
    id: 'startup-low',
    components: ['BG-FIRE-CHAMBER-Y2', 'FLAME-CORE-LOW-V2', 'FLAME-OUTER-LOW-V4'],
    extraDecodedBytes: 0,
  },
  {
    id: 'low-to-mid-transition-stage-3',
    components: [
      'BG-FIRE-CHAMBER-Y2', 'FLAME-CORE-LOW-V2', 'FLAME-OUTER-LOW-V4',
      'FLAME-CORE-MID-V2', 'FLAME-OUTER-MID-V4', 'FLAME-STAGE-FLARE',
      'ASH-IDLE-C09', 'ASH-INHALE-C09',
    ],
    extraDecodedBytes: 0,
  },
  {
    id: 'mid-to-high-transition-stage-6',
    components: [
      'BG-FIRE-CHAMBER-Y2', 'FLAME-CORE-MID-V2', 'FLAME-OUTER-MID-V4',
      'FLAME-CORE-HIGH-V2', 'FLAME-OUTER-HIGH-V4', 'FLAME-STAGE-FLARE',
      'ASH-IDLE-C09', 'ASH-INHALE-C09', 'EMBER-WARDEN-IDLE-C09',
    ],
    extraDecodedBytes: frameCacheBytes,
  },
  {
    id: 'stage-7-entry-host-and-character-handoff',
    components: [
      'BG-FIRE-CHAMBER-Y2', 'FLAME-CORE-HIGH-V2', 'FLAME-OUTER-HIGH-V4',
      'FLAME-STAGE-FLARE', 'ASH-IDLE-C09', 'ASH-INHALE-C09',
      'EMBER-WARDEN-IDLE-C09', 'HOST-MAIN-COMPAT', 'HOST-SENTINEL-COMPAT',
    ],
    extraDecodedBytes: frameCacheBytes,
  },
];
for (const scenario of residencyScenarios) {
  for (const id of scenario.components) if (!decodedById.has(id)) throw new Error(`${scenario.id}: unknown residency component ${id}`);
  scenario.decodedBytes = scenario.components.reduce((sum, id) => sum + decodedById.get(id), scenario.extraDecodedBytes);
  scenario.decodedMiB = Math.round(scenario.decodedBytes / 1024 / 1024 * 100) / 100;
}
const maximumDecodedResidencyBytes = Math.max(...residencyScenarios.map((scenario) => scenario.decodedBytes));
if (maximumDecodedResidencyBytes > 64 * 1024 * 1024) throw new Error('Decoded runtime residency exceeds 64 MiB.');

await writeFile(join(gameRoot, 'assets/assets-manifest-yandex-1.0.0.json'), `${JSON.stringify({
  schemaVersion: 1,
  game: 'inferno-clicker',
  version: '1.0.0',
  cycle: '09',
  generatedBy: 'scripts/sync-yandex-asset-manifest.mjs',
  primaryArtBudgetUnchanged: true,
  compatibilityFormatsLoadedTogether: false,
  maximumDecodedResidencyBytes,
  maximumDecodedResidencyMiB: Math.round(maximumDecodedResidencyBytes / 1024 / 1024 * 100) / 100,
  residencyModel: {
    method: 'sum of decoded RGBA bytes for every simultaneously resident runtime component; includes two servant atlases, one Warden atlas, one 512x832 Warden handoff frame, flame transition overlap, flare, background, and both host parts',
    frameCacheBytes,
    scenarios: residencyScenarios,
  },
  assets,
  alphaAudit: {
    frames: alphaMetadata.reduce((sum, entry) => sum + entry.frames, 0),
    removedDetachedPartialAlphaPixelCount: alphaMetadata.reduce((sum, entry) => sum + entry.removedDetachedPartialAlphaPixelCount, 0),
    detachedPartialAlphaPixelCountMax: Math.max(...alphaMetadata.map((entry) => entry.detachedPartialAlphaPixelCountMax)),
    entries: alphaMetadata,
  },
  outerFlameAudit: {
    frames: outerFlameMetadata.reduce((sum, entry) => sum + entry.frames, 0),
    sourceInternalLowChromaMattePixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.sourceInternalLowChromaMattePixelCount, 0),
    sourceInternalOliveMattePixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.sourceInternalOliveMattePixelCount, 0),
    sourceStickerEdgePixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.sourceStickerEdgePixelCount, 0),
    retintedPixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.retintedPixelCount, 0),
    suppressedMattePixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.suppressedMattePixelCount, 0),
    featheredStickerEdgePixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.featheredStickerEdgePixelCount, 0),
    detachedAlphaPixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.detachedAlphaPixelCount, 0),
    internalLowChromaMattePixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.internalLowChromaMattePixelCount, 0),
    internalOliveMattePixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.internalOliveMattePixelCount, 0),
    neutralEdgePixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.neutralEdgePixelCount, 0),
    coolEdgePixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.coolEdgePixelCount, 0),
    stickerEdgePixelCount: outerFlameMetadata.reduce((sum, entry) => sum + entry.stickerEdgePixelCount, 0),
    pngWebpDecodedRgbaParity: outerFlameMetadata.every((entry) => entry.pngWebpDecodedRgbaParity),
    entries: outerFlameMetadata,
  },
  stageFlareAudit,
  generatedBackground: {
    runtime: 'assets/backgrounds/bg-fire-chamber-yandex-v3.webp',
    fallback: 'assets/backgrounds/bg-fire-chamber-yandex-v3.png',
    source: 'visual-references/yandex-release-09/bg-fire-chamber-yandex-v3-source.png',
    method: 'OpenAI ImageGen minimal local retouch; concentric/rune-like geometry replaced with irregular non-repeating heat-damaged basalt while retaining the natural central hearth',
  },
  compatibilityManifest: 'assets/yandex-compatibility-manifest-v1.json',
  legacyManifest: 'assets/assets-manifest.json',
}, null, 2)}\n`);

console.log(`Yandex asset manifest PASS (${assets.length} pairs, ${maximumDecodedResidencyBytes} decoded bytes)`);
