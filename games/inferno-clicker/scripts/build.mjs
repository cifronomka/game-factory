import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildIdentity, fileInfo, gameRoot, walk } from './lib.mjs';

const dist = join(gameRoot, 'dist');
const identity = await buildIdentity();
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(gameRoot, 'index.html'), join(dist, 'index.html'));
await cp(join(gameRoot, 'src'), join(dist, 'app'), { recursive: true });
await cp(join(gameRoot, 'assets'), join(dist, 'assets'), { recursive: true });
await rm(join(dist, 'assets/PROVENANCE.md'), { force: true });
await rm(join(dist, 'app/platforms/dev'), { recursive: true, force: true });
const platformIndexPath = join(dist, 'app/platforms/index.js');
const productionPlatformIndex = (await readFile(platformIndexPath, 'utf8'))
  .replace("export * from './dev/index.js';\n", '');
await writeFile(platformIndexPath, productionPlatformIndex);

const htmlPath = join(dist, 'index.html');
const html = (await readFile(htmlPath, 'utf8'))
  .replaceAll('./src/', './app/')
  .replace('</head>', `    <meta name="build-id" content="${identity.buildId}">\n  </head>`);
await writeFile(htmlPath, html);

const files = await walk(dist, (path) => !path.endsWith('.DS_Store') && !path.endsWith('.gitkeep'));
for (const ignored of await walk(dist, (path) => path.endsWith('.gitkeep') || path.endsWith('.DS_Store'))) {
  await rm(ignored, { force: true });
}
const manifestFiles = await Promise.all(files.map(async (file) => {
  const info = await fileInfo(file);
  return { ...info, path: info.path.replace(/^dist\//, '') };
}));
const manifest = { ...identity, generatedBy: 'scripts/build.mjs', files: manifestFiles };
await writeFile(join(dist, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`build PASS (${manifest.files.length} runtime files)`);
