/**
 * Minimal streaming CSV reader for the USDA Branded Foods files (up to 1.5 GB each, FR-FOOD-1).
 * Handles quoted fields, "" escapes and newlines inside quotes. Reads straight out of the zip
 * with `unzip -p`, so nothing is extracted to disk.
 */
import { spawn } from 'node:child_process';

/** Splits CSV text into records; keeps state between chunks. */
export class CsvParser {
  private field = '';
  private row: string[] = [];
  private quoted = false;
  private pendingQuote = false;

  /** Feeds a chunk and returns the records completed by it. */
  push(chunk: string): string[][] {
    const out: string[][] = [];
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i]!;
      if (this.quoted) {
        if (this.pendingQuote) {
          this.pendingQuote = false;
          if (c === '"') {
            this.field += '"';
            continue;
          }
          this.quoted = false; // closing quote, fall through to unquoted handling
        } else if (c === '"') {
          this.pendingQuote = true;
          continue;
        } else {
          this.field += c;
          continue;
        }
      }
      if (c === '"' && this.field === '') this.quoted = true;
      else if (c === ',') {
        this.row.push(this.field);
        this.field = '';
      } else if (c === '\n') {
        this.row.push(this.field.endsWith('\r') ? this.field.slice(0, -1) : this.field);
        out.push(this.row);
        this.row = [];
        this.field = '';
      } else this.field += c;
    }
    return out;
  }

  /** Flushes a final record without a trailing newline. */
  end(): string[][] {
    if (this.pendingQuote) this.quoted = false;
    if (this.field === '' && this.row.length === 0) return [];
    this.row.push(this.field);
    const r = this.row;
    this.row = [];
    this.field = '';
    return [r];
  }
}

export function parseCsv(text: string): string[][] {
  const p = new CsvParser();
  return [...p.push(text), ...p.end()];
}

/**
 * Streams `entry` out of `zip` and calls `onRow(record, header)` for every data row.
 * `onRow` returning `false` stops early.
 */
export async function streamZipCsv(
  zip: string,
  entry: string,
  onRow: (row: string[], col: (name: string) => number) => boolean | void,
): Promise<number> {
  const child = spawn('unzip', ['-p', zip, entry], { stdio: ['ignore', 'pipe', 'inherit'] });
  child.stdout.setEncoding('utf8');
  const parser = new CsvParser();
  let header: string[] | null = null;
  let index = new Map<string, number>();
  const col = (name: string) => {
    const i = index.get(name);
    if (i === undefined) throw new Error(`${entry}: no column ${name}`);
    return i;
  };
  let n = 0;
  let stopped = false;
  const handle = (rows: string[][]) => {
    for (const r of rows) {
      if (stopped) return;
      if (!header) {
        header = r;
        index = new Map(r.map((h, i) => [h, i]));
        continue;
      }
      n++;
      if (onRow(r, col) === false) {
        stopped = true;
        child.kill();
        return;
      }
    }
  };
  for await (const chunk of child.stdout) {
    handle(parser.push(chunk as string));
    if (stopped) break;
  }
  if (!stopped) handle(parser.end());
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null || stopped) resolve();
    else child.on('close', () => resolve());
  });
  return n;
}
