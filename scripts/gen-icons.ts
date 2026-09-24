/**
 * Generates the placeholder "LL" monogram icons (M0 prompt) in the Paper palette, plus Iron
 * variants used by the Android splash/icon in M6. Letters are drawn as rectangles so the
 * output doesn't depend on installed fonts. Colours mirror design/tokens.json.
 */
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const tokens = JSON.parse(readFileSync(join(process.cwd(), 'design', 'tokens.json'), 'utf8')) as {
  themes: Record<'paper' | 'iron', Record<string, string>>;
};

function monogram(theme: 'paper' | 'iron', size: number, safe: number): string {
  const t = tokens.themes[theme];
  // Glyph box: 100 units wide. Two block "L"s with an accent bar underneath.
  const s = (size * (1 - 2 * safe)) / 100;
  const ox = size * safe;
  const oy = size * safe;
  const r = (x: number, y: number, w: number, h: number, fill: string) =>
    `<rect x="${(ox + x * s).toFixed(2)}" y="${(oy + y * s).toFixed(2)}" width="${(w * s).toFixed(2)}" height="${(h * s).toFixed(2)}" fill="${fill}"/>`;
  const ink = t.ink;
  const body = [
    r(14, 16, 14, 56, ink),
    r(14, 58, 32, 14, ink),
    r(54, 16, 14, 56, ink),
    r(54, 58, 32, 14, ink),
    r(14, 78, 72, 7, t.accent),
  ].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${t.paper}"/>${body}</svg>`;
}

async function png(svg: string, out: string) {
  await sharp(Buffer.from(svg)).png().toFile(out);
}

const dir = join(process.cwd(), 'public', 'icons');
mkdirSync(dir, { recursive: true });
await png(monogram('paper', 192, 0.08), join(dir, 'icon-192.png'));
await png(monogram('paper', 512, 0.08), join(dir, 'icon-512.png'));
await png(monogram('paper', 512, 0.2), join(dir, 'maskable-512.png'));
await png(monogram('paper', 180, 0.1), join(dir, 'apple-touch-icon.png'));
await png(monogram('iron', 512, 0.08), join(dir, 'icon-iron-512.png'));
writeFileSync(join(dir, 'favicon.svg'), monogram('paper', 64, 0.06));

// Native assets (M6): Capacitor's assets tool reads these from ./assets.
const assets = join(process.cwd(), 'assets');
mkdirSync(assets, { recursive: true });
await png(monogram('paper', 1024, 0.08), join(assets, 'icon-only.png'));
await png(monogram('paper', 1024, 0.22), join(assets, 'icon-foreground.png'));
await png(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${tokens.themes.paper.paper}"/></svg>`,
  join(assets, 'icon-background.png'),
);
await png(monogram('paper', 2732, 0.4), join(assets, 'splash.png'));
await png(monogram('iron', 2732, 0.4), join(assets, 'splash-dark.png'));
console.log('icons written to public/icons and assets/');
