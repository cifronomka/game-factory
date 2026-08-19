import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { gameRoot } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, item, index, list) => {
  if (item.startsWith('--')) pairs.push([item.slice(2), list[index + 1]]);
  return pairs;
}, []));
const root = resolve(gameRoot, args.root ?? '.');
const port = Number(args.port ?? 4173);
const mime = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.txt', 'text/plain; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.webp', 'image/webp'], ['.png', 'image/png'], ['.mp3', 'audio/mpeg'], ['.ogg', 'audio/ogg'], ['.opus', 'audio/ogg'], ['.flac', 'audio/flac']]);

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  let file = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(root)) { response.writeHead(403).end('Forbidden'); return; }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    await access(file);
    response.setHeader('Content-Type', mime.get(extname(file)) ?? 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}`));
