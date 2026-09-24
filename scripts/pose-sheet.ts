/**
 * Contact sheet of every Tier 2 pictogram (FR-ILL-2 review aid, also used for docs/reports/poses).
 *
 *   npx tsx scripts/pose-sheet.ts <out.png> [filter[,filter…]] [--dark] [--arch]   (env OFFSET/LIMIT page the list)
 *
 * Renders straight from src/data/poses.json with the app's renderer and theme tokens, so no dev
 * server is needed.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import posesJson from '../src/data/poses.json' with { type: 'json' };
import { tier2Defs, type PoseData } from '../src/illustration/tier2';
import { layersFor } from '../src/illustration/tier1';

const args = process.argv.slice(2);
const dark = args.includes('--dark');
const [out = 'poses.png', filter = ''] = args.filter((a) => !a.startsWith('--'));
const poses = posesJson as unknown as PoseData;
const defs = tier2Defs(poses);
const seen = new Set<string>();
const ids = Object.keys(defs)
  .filter((id) => filter.split(',').some((q) => id.includes(q) || poses.poses[id]!.a.includes(q)))
  // --arch: one representative per archetype.
  .filter((id) => {
    if (!args.includes('--arch')) return true;
    const a = poses.poses[id]!.a;
    if (seen.has(a)) return false;
    seen.add(a);
    return true;
  })
  .slice(Number(process.env.OFFSET ?? 0), Number(process.env.OFFSET ?? 0) + Number(process.env.LIMIT ?? 999));
const tokens = readFileSync('src/styles/tokens.css', 'utf8');

const cells = ids
  .map((id) => {
    const l = layersFor(defs[id]!);
    const body = l.back + l.ghost + l.solid + l.arrow;
    return `<figure><svg viewBox="0 0 240 170" fill="none">${body}</svg><figcaption>${id}<br><small>${poses.poses[id]!.a}</small></figcaption></figure>`;
  })
  .join('');

const html = `<!doctype html><html data-theme="${dark ? 'iron' : 'paper'}"><head><style>${tokens}
body{margin:0;background:var(--ll-paper);font:11px monospace;color:var(--ll-ink)}
main{display:grid;grid-template-columns:repeat(6,240px);gap:8px;padding:8px}
figure{margin:0;background:var(--ll-panel);border-radius:6px}
svg{width:240px;height:170px;display:block}figcaption{padding:2px 6px 6px}
</style></head><body><main>${cells}</main></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1520, height: 400 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`${ids.length} poses → ${out}`);
