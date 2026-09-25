/**
 * FR-SUM-2: the session ticket as a PNG, drawn client-side on a canvas with the current theme's
 * tokens and the self-hosted fonts (nothing leaves the phone). 1080 × 1350 (4:5, fits feeds).
 */
export interface TicketImageData {
  number: string;
  name: string;
  dateLine: string;
  lifted: string;
  sets: string;
  reps: string;
  goalPct: number;
  rows: [string, string][];
  prs: string[];
  xpLine: string | null;
  labels: { lifted: string; sets: string; reps: string; goalsMet: string; brand: string };
}

function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(`--ll-${name}`).trim() || fallback;
}

const DISPLAY = "'Big Shoulders Display', Oswald, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const SANS = "'Instrument Sans', system-ui, sans-serif";

export async function renderTicketPng(d: TicketImageData): Promise<Blob> {
  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load(`900 120px ${DISPLAY}`),
      document.fonts.load(`600 32px ${MONO}`),
      document.fonts.load(`700 36px ${SANS}`),
    ]).catch(() => undefined);
  }
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas');
  const col = {
    paper: token('paper', '#F2EADB'),
    card: token('card', '#FBF7EF'),
    ink: token('ink', '#1D1B18'),
    ink2: token('ink2', '#5E574C'),
    rule: token('rule', '#D9CDB6'),
    accent: token('accent', '#9E2B25'),
    brass: token('brassText', '#7A5A12'),
    brassWash: token('brassWash', '#F1E1B8'),
  };
  g.fillStyle = col.paper;
  g.fillRect(0, 0, W, H);

  // Card with hard shadow.
  const x = 70;
  const y = 90;
  const w = W - 140;
  const h = H - 190;
  g.fillStyle = col.ink;
  g.fillRect(x + 12, y + 12, w, h);
  g.fillStyle = col.card;
  g.fillRect(x, y, w, h);
  g.strokeStyle = col.ink;
  g.lineWidth = 4;
  g.strokeRect(x, y, w, h);

  const pad = x + 60;
  g.textBaseline = 'alphabetic';
  g.fillStyle = col.ink2;
  g.font = `600 30px ${MONO}`;
  g.fillText(`${d.labels.brand} · ${d.number}`.toUpperCase(), pad, y + 90);

  g.fillStyle = col.ink;
  let size = d.name.length <= 7 ? 170 : d.name.length <= 10 ? 130 : 100;
  g.font = `900 ${size}px ${DISPLAY}`;
  while (g.measureText(d.name.toUpperCase()).width > w - 360 && size > 60) {
    size -= 6;
    g.font = `900 ${size}px ${DISPLAY}`;
  }
  g.fillText(d.name.toUpperCase(), pad, y + 90 + size * 0.95);
  const afterName = y + 110 + size;
  g.fillStyle = col.ink2;
  g.font = `600 32px ${MONO}`;
  g.fillText(d.dateLine.toUpperCase(), pad, afterName + 20);

  // Stamp.
  const sx = x + w - 150;
  const sy = y + 230;
  g.save();
  g.translate(sx, sy);
  g.rotate((-12 * Math.PI) / 180);
  g.strokeStyle = col.accent;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, 105, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 92, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = col.accent;
  g.textAlign = 'center';
  g.font = `600 20px ${MONO}`;
  g.fillText(d.labels.goalsMet.toUpperCase(), 0, -34);
  g.font = `900 78px ${DISPLAY}`;
  g.fillText(`${d.goalPct}%`, 0, 40);
  g.restore();
  g.textAlign = 'left';

  // Big numbers.
  const ny = afterName + 110;
  const cols: [string, string][] = [
    [d.labels.lifted, d.lifted],
    [d.labels.sets, d.sets],
    [d.labels.reps, d.reps],
  ];
  let cx = pad;
  for (const [label, value] of cols) {
    g.fillStyle = col.ink2;
    g.font = `600 28px ${MONO}`;
    g.fillText(label.toUpperCase(), cx, ny);
    g.fillStyle = col.ink;
    g.font = `900 96px ${DISPLAY}`;
    g.fillText(value, cx, ny + 100);
    cx += Math.max(220, g.measureText(value).width + 70);
  }

  // Perforation.
  const py = ny + 160;
  g.strokeStyle = col.ink;
  g.lineWidth = 4;
  g.setLineDash([18, 12]);
  g.beginPath();
  g.moveTo(x + 30, py);
  g.lineTo(x + w - 30, py);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = col.paper;
  for (const px of [x, x + w]) {
    g.beginPath();
    g.arc(px, py, 30, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // Rows.
  let ry = py + 90;
  for (const [label, value] of d.rows) {
    g.fillStyle = col.ink2;
    g.font = `600 30px ${MONO}`;
    g.fillText(label.toUpperCase(), pad, ry);
    g.fillStyle = col.ink;
    g.font = `700 44px ${MONO}`;
    g.textAlign = 'right';
    g.fillText(value, x + w - 60, ry);
    g.textAlign = 'left';
    g.strokeStyle = col.rule;
    g.lineWidth = 2;
    g.setLineDash([8, 8]);
    g.beginPath();
    g.moveTo(pad, ry + 30);
    g.lineTo(x + w - 60, ry + 30);
    g.stroke();
    g.setLineDash([]);
    ry += 95;
  }
  for (const pr of d.prs.slice(0, 2)) {
    g.fillStyle = col.brassWash;
    g.fillRect(pad, ry - 40, w - 120, 90);
    g.fillStyle = col.brass;
    g.font = `900 60px ${DISPLAY}`;
    g.fillText('PR', pad + 24, ry + 26);
    g.fillStyle = col.ink;
    g.font = `700 34px ${SANS}`;
    g.fillText(pr, pad + 120, ry + 18, w - 260);
    ry += 110;
  }
  if (d.xpLine) {
    g.fillStyle = col.accent;
    g.font = `600 34px ${MONO}`;
    g.fillText(d.xpLine, pad, Math.min(ry + 20, y + h - 50));
  }

  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'),
  );
}
