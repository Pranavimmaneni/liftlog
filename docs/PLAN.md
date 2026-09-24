# LiftLog build plan (autonomous run, M0 → M6)

Written 2026-09-24 before any code. Sources read: README, CLAUDE.md, PRD v3, all 30 mockup PNGs (light + dark), mockup HTML, pictos.py, poses-readme.json, tokens, data/*.json, PROMPTS.md, INSTALL.md, ci/*.yml.

Run overrides from Pranav (these beat CLAUDE.md for this run):
- Build every milestone back to back. After each: report in `docs/reports/M<n>.md`, commit `M<n>: …`, continue.
- Phone checks: cover what I can with Playwright (Pixel 7 + iPhone 14, Paper + Iron) and list the rest in `docs/reports/PHONE-CHECKS.md`.
- `PROGRESS.md` at the repo root is the resume file. It's updated after every task.

## 1. Environment found

| Tool | State | Consequence |
|---|---|---|
| Node 24.15 / npm 11.12 | ✓ | npm is the package manager (CI uses Node 22, both fine) |
| git 2.52 | ✓, no global identity | Repo-local `user.name "Pranav"` / `user.email` set in this repo only |
| `gh` CLI | **not installed** | Can't create the GitHub repo. Exact commands go in `docs/reports/TODO-FOR-PRANAV.md` |
| `vercel` CLI | ✓ logged in | Deploy with `vercel deploy --prod` after each milestone and record the URL |
| Java / Android SDK | **not installed** | No local APK. The APK is built by `.github/workflows/android-apk.yml` once the repo is on GitHub |
| Python 3.14 | ✓ | Used only to render `pictos.py` reference SVGs for the port's diff test |

## 2. Gaps and contradictions found, and how I resolved them

Every item is also in `DECISIONS.md` (D-numbers match).

| # | Gap / contradiction | Resolution |
|---|---|---|
| D1 | The handoff was unzipped into `liftlog-handoff/`, but every path in the docs assumes the project root | Moved the contents up into the project folder (nothing deleted) and made that the repo root |
| D2 | **S07 mockup shows a nudge on the last set** ("Try 28 kg for the last set?"). PRD §6.4: "Never nudge on the last set" | PRD wins. Nudges show only when at least one set remains after the next one. The mockup layout is used for the nudge card |
| D3 | `intensity.json` `calibration.stepUpIf` = "reps ≥ repMax+2 **or** effort == easy". PRD §6.4: "effort = Easy **with** reps ≥ repMax" | PRD wins. Step up: `reps ≥ repMax+2` or (`effort=easy` and `reps ≥ repMax`). Step down: `reps < repMin`. The JSON strings are descriptive, so the rule lives in the engine and cites the PRD |
| D4 | FR-GOAL-4 says calibration sessions earn no XP, but `xp.json` has `firstSession: 100`, and a new user's first session is always calibration | Per-set XP (goal sets, bonus, PRs) is withheld for calibration exposures. `sessionComplete` is withheld when the whole session was calibration. `firstSession` is a one-time welcome award that is always granted. Calibration sessions don't count toward the streak |
| D5 | `xp.json` `xpForLevel(n)` doesn't say whether it's cumulative | Cumulative: you reach level L+1 at `xpForLevel(L)` total XP (level 1 = 0 XP). Check: ~300 XP/session → level 7 around session 10, which matches the S05/S09 mockups (LV 7, session 11) |
| D6 | Streak "rest-week pass every 8 weeks" is not defined further | Every 8 streak weeks earns one pass (max 1 banked). A missed, completed week uses the pass automatically and shows "Rest week (pass used)". The current, unfinished week never breaks the streak |
| D7 | Mockups S04/S10 merge muscles into "Back" and "Arms". PRD §6.5 / `machines.json` use 13 groups | PRD wins: coverage lists all 13 groups (mockup order, then the rest). Mockup numbers are sample data |
| D8 | S02 mockup shows 12 machines ("9 of 12"). `machines.json` has 42 | S02 shows the 12 most common machines, plus "More machines" that expands the other 30. The counter shows "N of 42" |
| D9 | free-exercise-db has no pattern, limitation areas, load type, increments or machine ids. The PRD requires them (FR-LIB-2, FR-GYM-5) | `scripts/seed.ts` derives them from deterministic rules in `scripts/seed-rules.ts` (name keywords, equipment, force/mechanic, muscles). Every rule and every drop is listed in `SEED-REPORT.md` |
| D10 | free-exercise-db uses 17 muscle names, the app uses 13 | abdominals→abs, abductors→glutes, adductors→quads (as `machines.json` does for hip adduction), middle back + traps→upper back, quadriceps→quads, neck→dropped |
| D11 | Availability needs more than one `equipment`/`machineId` (an incline DB press needs dumbbells **and** a bench, and a cable fly works on a cable tower **or** a functional trainer) | Each exercise gets `requires: string[][]` (AND of OR-groups of equipment/machine ids) in addition to the PRD's `equipment` display label and optional `machineId` |
| D12 | Where do seeded exercises live? "Custom exercises stored alongside seeded ones" vs NFR-PERF-3 "library data lazy-loaded" | The seeded catalogue is a lazy JSON chunk (cached by the service worker). The Dexie `exercises` table holds custom exercises only. A repository merges both. Backups stay small |
| D13 | The PRD data model has a `prs` table, but PRs must survive set edits (FR-WRK-11 "engines recompute") | `prs` is a cache that's rebuilt for an exercise whenever one of its sets is written, edited or deleted. The source of truth is always `sets` |
| D14 | First exposure trivially sets a "best e1RM". Stamping PR on every first set is noise | The first exposure sets the baseline. PRs start from the second exposure |
| D15 | "Bonus: load above target (converted to rep-equivalents)" has no formula | Equivalent reps at target load via Epley: `r' = 30·(load/target·(1+reps/30) − 1)`. Bonus reps = `max(0, floor(r' − repMax))` on goal sets. For assisted, the ratio is inverted on effective load. The one extra set allowed per exercise counts as a bonus set (`extraSetBonus` XP) |
| D16 | Ticket stamp "+8% bonus" isn't defined | Bonus % = bonus reps ÷ (goal sets × repMax), rounded |
| D17 | Stall and deload trigger aren't defined precisely | Stalled = 3 consecutive exposures with no rise in load or total reps, or `missStreak ≥ 2`. When ≥ 3 exercises are stalled (`deload.triggerStalledExercises`), or the week number hits `deloadEveryWeeks` for the level, next week becomes a deload week (announced this week). Deload = sets × 0.6 (rounded, min 1), same loads |
| D18 | Limitation areas ("go easy on" lower back, knees, shoulders, wrists) have no exercise mapping | Seed rules map by pattern and keywords (e.g. squat/lunge/leg-extension → knees; deadlift/good-morning/bent-over row → lower back; overhead press/dip/upright row → shoulders; push-up/front squat/wrist curl → wrists). Listed in SEED-REPORT |
| D19 | Lighthouse ≥ 12 removed the "PWA" category that M5's exit criteria mention | Lighthouse runs performance, accessibility and best practices (each ≥ 90). "PWA" is checked separately by an e2e installability test (manifest, SW, icons, offline) |
| D20 | NFR-SEC-1 CSP has no `script-src 'wasm-unsafe-eval'`, which the iOS QR fallback (zxing-wasm) needs. zxing-wasm also fetches its `.wasm` from jsDelivr by default, which would break the "no runtime network" rule | CSP adds `script-src 'self' 'wasm-unsafe-eval'`. The `.wasm` is self-hosted and passed to `prepareZXingModule` |
| D21 | A QR code *generator* is needed for the sticker sheet but isn't in PRD §11 | Add `qrcode-generator` (MIT, ~10 KB, no deps), lazy-loaded on the sticker page only |
| D22 | Test-only dependencies not in §11: `fake-indexeddb`, `@vitest/coverage-v8`, `jsdom`, `tsx`, `@lhci/cli`, `sharp` (icon generation, dev only) | Dev-only. Logged |
| D23 | `standards.json` `source` is "TODO" | Values kept. S11 shows a "Guideline values" chip (instead of the mockup's "Sample data") while `source` starts with "TODO" or is empty. Added to TODO-FOR-PRANAV |
| D24 | Mockups load Google Fonts from a CDN | Fonts are self-hosted with `@fontsource` (NFR-SEC-1) |
| D25 | Mockup exercise names ("Incline DB Press") differ from dataset names ("Incline Dumbbell Press") | Canonical names follow `aliases.json` and `machines.json`. Short mockup names become aliases. README says mockup names are sample data |
| D26 | Session calibration flag: which sessions count as calibration? | `sessions.calibration = true` when every exercise with work sets in it was a first exposure |
| D27 | "Week N" (S06, S09, S10) isn't defined | Week 1 is the week (per the week-start setting) of the first logged session in the active routine |
| D28 | Unilateral (FR-WRK-14, "should") | Logged as a Left row then a Right row per set. The goal set needs both sides to meet the goal. Volume counts both sides |
| D29 | Sound for rest alerts with no audio files | WebAudio generates a short beep, unlocked by the "Start workout" tap (FR-PLT-3) |
| D30 | Planned sessions per week vs rotation length (e.g. PPL at 6 days = 3 sessions twice) | Weekly target = `daysPerWeek` (FR-RTN-5). At 6 days PPL, the rotation runs Push, Pull, Legs twice, with the first compound swapped on the second pass (`sixDayNote`) |

## 3. Architecture (matches PRD §11)

```
src/
  app/         router, layouts (tab shell), error boundary, service-worker toast
  screens/     one folder per screen S01…S26
  components/  design system: Button, Card, Chip, SegmentedControl, ToggleChip, Switch, Stepper,
               SetRow, SetDots, GoalMeter, Stamp, Ticket, TabBar, Sheet, Toast, EmptyState,
               Sparkline, LineChart(+table), StatTile, Icon
  engine/      pure TS + Vitest: units, load, e1rm, prescription, warmup, goalset, goal,
               calibration, progression, deload, coverage, suggest, rotation, timer, week,
               summary, strength, insights, recomp, xp, streak, milestones, quest, search
  db/          dexie schema v1 (+ migrations), repositories, backup (zod), csv
  data/        copied from /data by scripts/copy-data.ts + exercises.json + poses.json
  illustration/ rig.ts (port of pictos.py), parts.ts, tier1.ts, Pictogram.tsx, MuscleMap.tsx
  platform/    index.ts (picks adapter), web.ts, native.ts
  copy/        en.ts
  styles/      tokens.css (copied), app.css (Tailwind v4 @theme mapping), fonts
scripts/       copy-data.ts, seed.ts, seed-rules.ts, vendor/free-exercise-db.json (pinned sha), gen-icons.ts
e2e/           Playwright specs + axe
```

State: Dexie is the source of truth (`useLiveQuery`). Zustand only for ephemeral workout UI (expanded timer, open sheets, active exercise).

## 4. Milestone plan

Each milestone follows the same loop: `docs/plans/M<n>.md` → engines + tests → UI → typecheck, lint, unit, build, e2e → fix until green → compare every built screen with its PNG in both themes → commit `M<n>: …` → `docs/reports/M<n>.md` → deploy → next.

### M0 Foundation
- Vite + React 19 + TS strict, ESLint (flat) + Prettier, Vitest, Playwright (4 projects: pixel-paper, pixel-iron, iphone-paper, iphone-iron).
- `scripts/copy-data.ts` (data → src/data), tokens.css → Tailwind v4 `@theme` mapping, @fontsource fonts.
- Theme: System/Paper/Iron in `settings`, `data-theme` on `<html>`, `theme-color` + apple status-bar meta per theme (FR-SET-1, FR-PLT-9).
- `src/platform/` web adapter (wake lock, alert, share, scan stub, persist, statusBar) + native stub.
- Dexie schema v1 (all 15 tables of PRD §7), migration test harness.
- Error boundary per route that logs to `errors` (NFR-REL-4) and offers Reload / Export.
- vite-plugin-pwa (injectManifest), manifest, "LL" monogram icons, update toast that never reloads mid-session (NFR-OFF-2).
- `/dev/components` with Button, Card, Chip, Stepper in both themes.
- `.github/workflows/ci.yml`, `vercel.json` (SPA rewrite, cache headers, CSP).
- Deploy to Vercel. TODO file for GitHub.

### M1 Log a workout
- Seed script → `src/data/exercises.json` + `SEED-REPORT.md` (400–600 exercises).
- Engines: units, load/volume, e1rm, prescription, warmup, goalset/bonus, timer, rotation, week, summary, search (basic).
- Illustrations: port pictos.py (rig, parts, 10 Tier 1 exercises, muscle map) + reference-SVG diff test.
- Screens: S01, S02 (defaults to full gym), S03, S04 (manual, no coverage), S05, S06, S07/S08, S09 basic, S25 timer, S13 minimal (for "Add from list"), S14 with backup export/import.
- e2e #1 onboarding → first set, #2 full session → ticket, #3 offline, #4 kill/reload resume, #5 backup round-trip.

### M2 Coach
- Engines: goal (goalFor + reasons), calibration nudges, suggest (auto-fill slots, swap alternatives, fix), coverage.
- S02 complete (presets, all toggles, limitations, units), My Gym editing in Settings, machine photo (compressed Blob) + settings + increment on S08, custom machines (FR-GYM-4), S23 swap sheet, S04 coverage + "+ Fix", limitation filtering.
- e2e #6 swap exercise. Engine coverage ≥ 90%.

### M3 Progression
- Engines: progression (every §5.8 rule), goalChanges, deload scheduling, bonus tracking, hurts freeze.
- S24 override sheet, S15 Plan tab (queue, drag reorder, skip to, week strip, change split, deload banner), S16 exercise detail, S17 custom exercise form, library filters complete.
- Tier 2: ~120 poses in `src/data/poses.json` (archetype rigs + equipment parts), `/dev/poses` gallery, 1.6 s pose animation (reduced-motion aware). Screenshots in `docs/reports/poses/`.
- e2e #7 progression after two sessions.

### M4 Insight
- Engines: insights (§6.7), recomp (§6.8), strength (§6.6), weekly/monthly aggregation.
- S10 weekly/monthly review, S11 strength levels (+ "Guideline values" chip), S19 body stats, S20 weigh-in, S12 progress hub (Lifts / Body / History + PRs), S18 session detail (edit/delete set, delete session), LineChart/Sparkline with table views.
- Dev-only 6-week fixture loader (`/dev/fixture`) for demos and fixture-based tests.

### M5 Motivation + polish
- Engines: xp, levels, streak (rest pass), milestones, quest.
- Stamps + PR animation, XP on Home/ticket, milestone cards, weekly quest on Home, share ticket as PNG (canvas), CSV export.
- S22 QR scan (BarcodeDetector → lazy zxing-wasm polyfill, self-hosted wasm) + sticker sheet (3×8), `/m/:machineId`.
- Backup nudges (FR-DATA-2), S21 install help (+ one-time banner), S26 empty/error states, storage-error banner.
- a11y pass (axe on every route × both themes), performance budget check (initial JS < 250 KB gz), Lighthouse (local + `lighthouserc` + workflow).

### M6 Android APK + release
- Capacitor Android project (`android/` committed), `capacitor.config.ts`, native adapter: keep-awake, local notification for rest end, haptics, filesystem + share, status bar.
- App icon + splash (Paper and Iron), version 1.0.0, `docs/RELEASE.md`, `.github/workflows/android-apk.yml`.
- No local SDK, so the APK comes from CI only (recorded in TODO).

### Wrap-up
`docs/reports/FINAL.md`, `docs/reports/PHONE-CHECKS.md`, `docs/reports/TODO-FOR-PRANAV.md`, `CHANGELOG.md`, `LICENSES.md`.
