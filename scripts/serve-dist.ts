/**
 * Serves dist/ like Vercel does (Brotli, long-cache hashed assets, SPA fallback) for local Lighthouse
 * runs: `vite preview` sends uncompressed files, which isn't what phones get in production.
 *
 *   npx tsx scripts/serve-dist.ts [port]
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

const port = Number(process.argv[2] ?? 4174);
const root = join(process.cwd(), 'dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};
const cache = new Map<string, Buffer>();
type Buffer = ReturnType<typeof readFileSync> & Uint8Array;

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory())
    file = join(root, 'index.html');
  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  let body: Buffer = readFileSync(file);
  const headers: Record<string, string> = { 'content-type': type };
  const hashed = file.includes(join('dist', 'assets'));
  headers['cache-control'] = hashed ? 'public, max-age=31536000, immutable' : 'no-cache';
  if (/text|javascript|json|svg|wasm/.test(type) && /br/.test(String(req.headers['accept-encoding']))) {
    // Only hashed assets are memoised; index.html and friends change on every build.
    const hit: Buffer = (hashed && cache.get(file)) || brotliCompressSync(body);
    if (hashed) cache.set(file, hit);
    body = hit;
    headers['content-encoding'] = 'br';
  }
  res.writeHead(200, headers);
  res.end(body);
}).listen(port, () => console.log(`dist on http://localhost:${port}`));
