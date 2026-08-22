// @ts-check

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileInfo, gameRoot } from './lib.mjs';

const manifestPath = join(gameRoot, 'assets/assets-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

// Asset metadata hashes must describe the canonical Git bytes, not whichever
// CRLF checkout happened to generate the manifest on Windows. Normalize every
// referenced JSON document before hashing so a clean LF checkout is reproducible.
for (const entry of manifest.assets) {
  if (typeof entry.metadata !== 'string') continue;
  const metadataPath = join(gameRoot, entry.metadata);
  const metadataSource = await readFile(metadataPath, 'utf8');
  JSON.parse(metadataSource);
  await writeFile(metadataPath, metadataSource.replace(/\r\n?/g, '\n'));
}
const sourceManifestPath = 'visual-references/cycle-08-sources/source-manifest.json';
const sourceManifestInfo = await fileInfo(join(gameRoot, sourceManifestPath));
manifest.cycle08SourceManifest = {
  path: sourceManifestPath,
  bytes: sourceManifestInfo.bytes,
  sha256: sourceManifestInfo.sha256,
};

const configs = [
  ...['idle', 'inhale', 'blow', 'recovery'].map((clip) => ({
    family: 'ASH-SERVANT',
    clip,
    fromCycle: 'C07',
    toCycle: 'C08',
    version: 'v6',
    atlas: [1024, 640],
    cell: [256, 320],
  })),
  ...['idle', 'cast', 'hold', 'recovery'].map((clip) => ({
    family: 'DEMONESS',
    clip,
    fromCycle: 'C07',
    toCycle: 'C08',
    version: 'v7',
    atlas: [2048, 1664],
    cell: [512, 832],
    runtimeDrawBox: [504, 840],
  })),
];

for (const config of configs) {
  const clipUpper = config.clip.toUpperCase();
  const previousId = `CH-${config.family}-${clipUpper}-${config.fromCycle}`;
  const nextId = `CH-${config.family}-${clipUpper}-${config.toCycle}`;
  const index = manifest.assets.findIndex((entry) => entry.id === previousId || entry.id === nextId);
  if (index < 0) throw new Error(`Missing manifest entry ${previousId}`);

  const familyPath = config.family === 'ASH-SERVANT' ? 'ash-servant' : 'demoness';
  const basename = `${familyPath}-${config.clip}-${config.version}`;
  const relativeAtlas = `assets/characters/${familyPath}/${basename}.webp`;
  const relativeMetadata = `assets/characters/${familyPath}/${basename}.json`;
  const atlasInfo = await fileInfo(join(gameRoot, relativeAtlas));
  const metadataInfo = await fileInfo(join(gameRoot, relativeMetadata));
  const metadata = JSON.parse(await readFile(join(gameRoot, relativeMetadata), 'utf8'));
  if (metadata.cycle !== '08') throw new Error(`${relativeMetadata}: expected Cycle 08 metadata`);
  if (metadata.atlasWidth !== config.atlas[0] || metadata.atlasHeight !== config.atlas[1]) throw new Error(`${relativeMetadata}: atlas geometry mismatch`);
  if (metadata.frameWidth !== config.cell[0] || metadata.frameHeight !== config.cell[1]) throw new Error(`${relativeMetadata}: cell geometry mismatch`);

  manifest.assets[index] = {
    ...manifest.assets[index],
    id: nextId,
    path: relativeAtlas,
    metadata: relativeMetadata,
    width: config.atlas[0],
    height: config.atlas[1],
    bytes: atlasInfo.bytes,
    decodedBytes: config.atlas[0] * config.atlas[1] * 4,
    sha256: atlasInfo.sha256,
    metadataSha256: metadataInfo.sha256,
    cycle: '08',
    version: config.version,
    cellWidth: config.cell[0],
    cellHeight: config.cell[1],
    sourceSheet: metadata.sourceSheet,
    sourceSheetSha256: metadata.sourceSheetSha256,
    ...(config.runtimeDrawBox ? { runtimeDrawBox: config.runtimeDrawBox } : {}),
  };
}

for (const entry of manifest.assets) {
  if (typeof entry.metadata !== 'string') continue;
  entry.metadataSha256 = (await fileInfo(join(gameRoot, entry.metadata))).sha256;
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('Cycle 08 character manifest entries synchronized');
