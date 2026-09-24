/**
 * FR-LIB-1: builds src/data/exercises.json from a pinned free-exercise-db snapshot
 * (scripts/vendor, public domain) and writes SEED-REPORT.md. Deterministic: same input → same output.
 *
 *   npm run seed
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Exercise } from '../src/engine/types';
import {
  CUSTOM_SEEDS,
  cleanText,
  DROP_RULES,
  equipmentLabel,
  EXTRA_ALIASES,
  INCLUDE_ANYWAY,
  incrementFor,
  isUnilateral,
  KEEP_CATEGORIES,
  KEEP_EQUIPMENT,
  levelFor,
  limitationAreasFor,
  loadTypeFor,
  machineFor,
  mapMuscles,
  patternFor,
  RENAMES,
  requiresFor,
  roleFor,
  slug,
  TIER1_POSES,
  type MachineDef,
  type RawExercise,
} from './seed-rules';

const root = process.cwd();
const read = <T>(p: string): T => JSON.parse(readFileSync(join(root, p), 'utf8')) as T;

export interface SeedResult {
  exercises: Exercise[];
  report: string;
}

export function buildSeed(): SeedResult {
  const raw = read<RawExercise[]>('scripts/vendor/free-exercise-db.json');
  const source = read<{ commit: string }>('scripts/vendor/free-exercise-db.source.json');
  const machines = read<{ machines: MachineDef[] }>('data/machines.json').machines;
  const aliasesJson = read<{ aliases: Record<string, string[]> }>('data/aliases.json').aliases;
  const equipment = read<{ equipment: { id: string; name: string }[] }>('data/equipment.json').equipment;
  const loadTypes = read<{ types: Record<string, { defaultIncrementKg: number }> }>(
    'data/load-types.json',
  ).types;

  const machineById = new Map(machines.map((m) => [m.id, m]));
  const machineByExercise = new Map<string, string>();
  for (const m of machines)
    for (const e of m.exercises)
      if (!machineByExercise.has(e.toLowerCase())) machineByExercise.set(e.toLowerCase(), m.id);
  const names: Record<string, string> = Object.fromEntries([
    ...equipment.map((e) => [e.id, e.name] as const),
    ...machines.map((m) => [m.id, m.name] as const),
  ]);

  const dropped: { name: string; reason: string }[] = [];
  const renamed: [string, string][] = [];
  const byId = new Map<string, Exercise>();

  const build = (
    canonical: string,
    originalName: string | null,
    equip: string,
    primaryRaw: ReturnType<typeof mapMuscles>,
    secondaryRaw: ReturnType<typeof mapMuscles>,
    mechanic: string | null,
    level: Exercise['level'],
    instructions: string[],
  ): Exercise | { drop: string } => {
    const primary = primaryRaw;
    const secondary = secondaryRaw.filter((m) => !primary.includes(m));
    if (!primary.length) return { drop: 'no primary muscle in the 13 groups' };
    if (!instructions.some((i) => i.trim())) return { drop: 'no instructions in the dataset' };
    const machineId = machineFor(canonical, equip, machineByExercise);
    const machine = machineId ? machineById.get(machineId) : undefined;
    const pattern = patternFor(canonical);
    const loadType = loadTypeFor(canonical, equip, machine);
    const requires = requiresFor(canonical, equip, machineId);
    const aliases = new Set<string>();
    for (const a of aliasesJson[canonical] ?? []) aliases.add(a.toLowerCase());
    for (const a of EXTRA_ALIASES[canonical] ?? []) aliases.add(a.toLowerCase());
    if (originalName && originalName !== canonical) aliases.add(originalName.toLowerCase());
    aliases.delete(canonical.toLowerCase());
    const ex: Exercise = {
      id: slug(canonical),
      name: canonical,
      aliases: [...aliases].sort(),
      primary,
      secondary,
      pattern,
      role: roleFor(pattern, mechanic, canonical),
      equipment: equipmentLabel(equip, machine, requires, names),
      requires,
      loadType,
      incrementKg: incrementFor(loadType, machine, loadTypes),
      unilateral: isUnilateral(canonical),
      instructions: instructions.map(cleanText).filter(Boolean),
      limitationAreas: limitationAreasFor(canonical, pattern, equip),
      level,
    };
    if (machineId) ex.machineId = machineId;
    if (TIER1_POSES[canonical]) ex.poseId = TIER1_POSES[canonical];
    return ex;
  };

  for (const r of [...raw].sort((a, b) => a.name.localeCompare(b.name))) {
    const forced = INCLUDE_ANYWAY[r.name];
    const equip = forced ?? r.equipment ?? 'none';
    if (!forced) {
      if (!KEEP_CATEGORIES.includes(r.category)) {
        dropped.push({ name: r.name, reason: `category "${r.category}"` });
        continue;
      }
      if (!KEEP_EQUIPMENT.includes(equip)) {
        dropped.push({ name: r.name, reason: `equipment "${equip}"` });
        continue;
      }
      const rule = DROP_RULES.find((d) => d.re.test(r.name));
      if (rule) {
        dropped.push({ name: r.name, reason: rule.reason });
        continue;
      }
    }
    const canonical = RENAMES[r.name] ?? r.name;
    if (canonical !== r.name) renamed.push([r.name, canonical]);
    const res = build(
      canonical,
      r.name,
      equip,
      mapMuscles(r.primaryMuscles),
      mapMuscles(r.secondaryMuscles),
      r.mechanic,
      levelFor(r.level),
      r.instructions,
    );
    if ('drop' in res) {
      dropped.push({ name: r.name, reason: res.drop });
      continue;
    }
    if (byId.has(res.id)) {
      dropped.push({ name: r.name, reason: `duplicate of "${byId.get(res.id)!.name}"` });
      continue;
    }
    byId.set(res.id, res);
  }

  // machines.json exercises must all resolve (by name or alias); add custom seeds for the gaps.
  const findByName = (n: string) => {
    const k = n.toLowerCase();
    for (const e of byId.values()) if (e.name.toLowerCase() === k || e.aliases.includes(k)) return e;
    return undefined;
  };
  const added: string[] = [];
  for (const c of CUSTOM_SEEDS) {
    if (findByName(c.name)) continue;
    const res = build(c.name, null, c.equipment, c.primary, c.secondary, c.mechanic, c.level, c.instructions);
    if ('drop' in res) throw new Error(`custom seed ${c.name}: ${res.drop}`);
    byId.set(res.id, res);
    added.push(c.name);
  }
  const unresolved: string[] = [];
  for (const m of machines)
    for (const e of m.exercises) if (!findByName(e)) unresolved.push(`${e} (${m.id})`);
  if (unresolved.length)
    throw new Error(`machines.json exercises without a seed entry: ${unresolved.join(', ')}`);
  for (const a of Object.keys(aliasesJson))
    if (!findByName(a)) throw new Error(`aliases.json key "${a}" has no exercise`);

  const exercises = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (exercises.length < 400 || exercises.length > 600)
    throw new Error(`FR-LIB-1: ${exercises.length} exercises is outside 400–600`);

  // ---------- report ----------
  const count = <T extends string>(xs: T[]) =>
    xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
  const table = (rec: Record<string, number>) =>
    Object.entries(rec)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([k, v]) => `| ${k} | ${v} |`)
      .join('\n');
  const reasons = count(dropped.map((d) => d.reason));
  const lines: string[] = [];
  lines.push('# Seed report', '');
  lines.push(
    `Generated by \`npm run seed\` from free-exercise-db commit \`${source.commit}\` (Unlicense). Deterministic.`,
    '',
  );
  lines.push('## Totals', '');
  lines.push('| | Count |', '|---|---|');
  lines.push(`| Dataset rows | ${raw.length} |`);
  lines.push(`| Kept from the dataset | ${exercises.length - added.length} |`);
  lines.push(`| Added as custom seeds (named in machines.json or staples) | ${added.length} |`);
  lines.push(`| **Exercises shipped** | **${exercises.length}** |`);
  lines.push(`| Dropped | ${dropped.length} |`);
  lines.push(`| Renamed to canonical names | ${renamed.length} |`);
  lines.push(`| With a Tier 1 pictogram | ${exercises.filter((e) => e.poseId).length} |`);
  lines.push(
    `| With a movement pattern (auto-suggest eligible) | ${exercises.filter((e) => e.pattern).length} |`,
  );
  lines.push(`| Linked to a machine | ${exercises.filter((e) => e.machineId).length} |`, '');
  lines.push('## Dropped, by reason', '', '| Reason | Count |', '|---|---|', table(reasons), '');
  lines.push(
    '## Kept, by pattern',
    '',
    '| Pattern | Count |',
    '|---|---|',
    table(count(exercises.map((e) => e.pattern ?? '(none)'))),
    '',
  );
  lines.push(
    '## Kept, by load type',
    '',
    '| Load type | Count |',
    '|---|---|',
    table(count(exercises.map((e) => e.loadType))),
    '',
  );
  lines.push(
    '## Kept, by primary muscle',
    '',
    '| Muscle | Count |',
    '|---|---|',
    table(count(exercises.map((e) => e.primary[0]!))),
    '',
  );
  lines.push(
    '## Limitation areas (FR-GYM-5)',
    '',
    '| Area | Exercises |',
    '|---|---|',
    table(count(exercises.flatMap((e) => e.limitationAreas))),
    '',
  );
  lines.push('## Custom seeds added', '', ...added.map((n) => `- ${n}`), '');
  lines.push(
    '## Renamed',
    '',
    '| Dataset name | LiftLog name |',
    '|---|---|',
    ...renamed.map(([a, b]) => `| ${a} | ${b} |`),
    '',
  );
  lines.push(
    '## Dropped exercises',
    '',
    '| Dataset name | Reason |',
    '|---|---|',
    ...dropped.map((d) => `| ${d.name} | ${d.reason} |`),
    '',
  );
  return { exercises, report: lines.join('\n') };
}

const isMain = process.argv[1] && /seed\.ts$/.test(process.argv[1]);
if (isMain) {
  const { exercises, report } = buildSeed();
  writeFileSync(join(root, 'src', 'data', 'exercises.json'), JSON.stringify(exercises) + '\n');
  writeFileSync(join(root, 'SEED-REPORT.md'), report);
  console.log(`seed: ${exercises.length} exercises → src/data/exercises.json, SEED-REPORT.md`);
}
