import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { transformAsync } from '@babel/core';
import presetEnv from '@babel/preset-env';
import { build as bundle } from 'esbuild';
import { buildIdentity, fileInfo, gameRoot, walk } from './lib.mjs';

const targetArgument = process.argv.find((argument) => argument.startsWith('--target='));
const releaseTarget = targetArgument?.slice('--target='.length) ?? 'web';
if (!['web', 'yandex'].includes(releaseTarget)) throw new Error(`Unsupported build target: ${releaseTarget}`);
const testDriver = process.argv.includes('--test-driver');

const dist = join(gameRoot, testDriver ? 'dist-e2e' : 'dist');
const identity = await buildIdentity();
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const bundled = await bundle({
  entryPoints: [join(gameRoot, 'src/main.js')],
  outfile: join(dist, 'game.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2017'],
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  charset: 'utf8',
  define: {
    '__INFERNO_BUILD_TARGET__': JSON.stringify(releaseTarget),
    '__INFERNO_TEST_DRIVER__': testDriver ? 'true' : 'false',
  },
  write: false,
});
const bundledJavaScript = bundled.outputFiles.find((file) => file.path.endsWith('game.js'));
if (!bundledJavaScript) throw new Error('esbuild did not produce the browser bundle.');
const transpiled = await transformAsync(bundledJavaScript.text, {
  babelrc: false,
  configFile: false,
  comments: false,
  compact: true,
  minified: true,
  sourceMaps: false,
  presets: [[presetEnv, {
    bugfixes: true,
    modules: false,
    useBuiltIns: false,
    targets: { chrome: '49', firefox: '52', safari: '9', edge: '15' },
  }]],
});
if (!transpiled?.code) throw new Error('Babel did not produce the compatibility bundle.');
await writeFile(join(dist, 'game.js'), `${transpiled.code}\n`);

await cp(join(gameRoot, 'src/styles.css'), join(dist, 'styles.css'));

const clips = ['idle', 'inhale', 'blow', 'recovery'];
const wardenClips = ['idle', 'cast', 'hold', 'recovery'];
const runtimeAssets = [
  'assets/backgrounds/bg-fire-chamber-yandex-v3.webp',
  'assets/backgrounds/bg-fire-chamber-yandex-v3.png',
  ...clips.flatMap((clip) => [
    `assets/characters/ash-servant/ash-servant-${clip}-v7.webp`,
    `assets/characters/ash-servant/ash-servant-${clip}-v7.png`,
  ]),
  ...wardenClips.flatMap((clip) => [
    `assets/characters/demoness/demoness-${clip}-v8.webp`,
    `assets/characters/demoness/demoness-${clip}-v8.png`,
  ]),
  'assets/characters/character-inferno-host-main-v4.webp',
  'assets/characters/character-inferno-host-main-v4.png',
  'assets/characters/character-inferno-host-sentinel-v4.webp',
  'assets/characters/character-inferno-host-sentinel-v4.png',
  ...['core-low-v2', 'outer-low-v4', 'core-mid-v2', 'outer-mid-v4', 'core-high-v2', 'outer-high-v4']
    .flatMap((name) => [`assets/flame/atlases/${name}.webp`, `assets/flame/atlases/${name}.png`]),
  'assets/flame/transitions/stage-flare-v3.webp',
  'assets/flame/transitions/stage-flare-v3.png',
  ...['fire/embers-wood-bed', 'fire/charcoal-crackle', 'fan/fan-soft-a', 'fan/fan-soft-b', 'fan/fan-soft-c']
    .flatMap((name) => [`assets/audio/${name}.ogg`, `assets/audio/${name}.mp3`]),
];

for (const asset of runtimeAssets) {
  const destination = join(dist, asset);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(gameRoot, asset), destination);
}

let html = await readFile(join(gameRoot, 'index.html'), 'utf8');
html = html
  .replace("window.__INFERNO_PLATFORM_TARGET__ = 'web';", `window.__INFERNO_PLATFORM_TARGET__ = '${releaseTarget}';`)
  .replace('<link rel="stylesheet" href="./src/styles.css" />', '<link rel="stylesheet" href="./styles.css" />')
  .replace('<script type="module" src="./src/main.js"></script>', '<script defer src="./game.js"></script>')
  .replace('<script>', `<script>\n      window.globalThis = window.globalThis || window;\n      if (!Object.fromEntries) Object.fromEntries = function(entries) { var result = {}; for (var i = 0; i < entries.length; i += 1) result[entries[i][0]] = entries[i][1]; return result; };`)
  .replace('</head>', `    <meta name="build-id" content="${identity.buildId}">\n    <meta name="release-target" content="${releaseTarget}">\n  </head>`);
await writeFile(join(dist, 'index.html'), html);

const files = await walk(dist, (path) => !path.endsWith('.DS_Store') && !path.endsWith('.gitkeep'));
const manifestFiles = await Promise.all(files.map(async (file) => {
  const info = await fileInfo(file);
  return { ...info, path: relative(dist, file).split(sep).join('/') };
}));
const payloadBytes = manifestFiles.reduce((sum, file) => sum + file.bytes, 0);
const manifest = {
  ...identity,
  version: '1.0.0',
  target: releaseTarget,
  generatedBy: 'scripts/build.mjs',
  nativeEsm: false,
  syntaxTarget: 'chrome49/firefox52/safari9/edge15',
  transpiler: 'esbuild-iife+babel-preset-env',
  testDriver,
  unpackedBytes: 0,
  runtimeAssetCount: runtimeAssets.length,
  rasterPolicy: 'one-selected-format-per-asset',
  files: manifestFiles,
};
let manifestJson = '';
for (let iteration = 0; iteration < 8; iteration += 1) {
  manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  const total = payloadBytes + Buffer.byteLength(manifestJson);
  if (manifest.unpackedBytes === total) break;
  manifest.unpackedBytes = total;
}
manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
if (payloadBytes + Buffer.byteLength(manifestJson) !== manifest.unpackedBytes) throw new Error('Unable to stabilize self-inclusive unpacked byte count.');
if (manifest.unpackedBytes >= 90 * 1024 * 1024) throw new Error(`Unpacked build is ${manifest.unpackedBytes} bytes (limit: <90 MiB)`);
await writeFile(join(dist, 'build-manifest.json'), manifestJson);
console.log(`build:${releaseTarget}${testDriver ? ':test-driver' : ''} PASS (${manifest.files.length} files, ${manifest.unpackedBytes} unpacked bytes)`);
