/**
 * Copies the tunable data in /data and the design tokens into src/ (NFR-MAINT-2).
 * /data and /design stay the source of truth; never edit the copies.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dataSrc = join(root, 'data');
const dataDst = join(root, 'src', 'data');
mkdirSync(dataDst, { recursive: true });

let n = 0;
for (const f of readdirSync(dataSrc)) {
  if (!f.endsWith('.json')) continue;
  const from = join(dataSrc, f);
  const to = join(dataDst, f);
  const body = readFileSync(from, 'utf8');
  JSON.parse(body); // fail loudly on invalid JSON
  if (!existsSync(to) || readFileSync(to, 'utf8') !== body) writeFileSync(to, body);
  n++;
}

mkdirSync(join(root, 'src', 'styles'), { recursive: true });
copyFileSync(join(root, 'design', 'tokens.css'), join(root, 'src', 'styles', 'tokens.css'));
console.log(`copy-data: ${n} data files + tokens.css copied into src/`);
