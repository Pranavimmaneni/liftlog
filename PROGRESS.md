# PROGRESS

Resume file. If the session resets, read this, then `docs/PLAN.md`, then the current `docs/plans/M<n>.md`.

## Current
- Milestone: **Done** (M0–M6 + wrap-up)
- Step: waiting on Pranav's TODO list (docs/reports/TODO-FOR-PRANAV.md)

## Done
- [x] Read handoff; repo root = project folder; `git init`
- [x] `docs/PLAN.md`, `DECISIONS.md` (D1–D52)
- [x] **M0 Foundation**: report docs/reports/M0.md
- [x] **M1 Log a workout**: report docs/reports/M1.md (223 unit, engine 99.3%, overall 84.8%, e2e 52/52)
  - Also shipped early: auto-suggest (FR-RTN-1), swap sheet S23, full goal/progression replay engine (FR-GOAL, FR-PRG-1…6), S20 weigh-in, /dev/fixture
- [x] **M2 Coach**: report docs/reports/M2.md (236 unit, engine 99.2%, e2e 76/76)

- [x] **M3 Progression**: report docs/reports/M3.md (262 unit, engine 99.8%, overall 85.2%, e2e 96/96)
- [x] **M4 Insight**: report docs/reports/M4.md (295 unit, engine 99.9%, overall 86.7%, e2e 108/108)
- [x] **M5 Motivation and polish**: report docs/reports/M5.md (321 unit, engine 99.9%, overall 84.5%, e2e 124/124, first-load JS 163 KB gz, Lighthouse >= 90)
- [x] Demo for Pranav after M5: docs/reports/demo/demo-{paper,iron}.png + live link
- [x] **M6 Android APK**: report docs/reports/M6.md (326 unit, e2e 124/124, native smoke OK; APK via CI only, D74)

- [x] **Wrap-up**: docs/reports/FINAL.md, TODO-FOR-PRANAV.md complete (8 steps), LICENSES.md, D77–D78

## Next
- Nothing planned. Possible v1.1: supersets (FR-WRK-15), dataset photos (FR-LIB-7), iOS build if an Apple account appears

## How to run things (Windows / Git Bash notes)
- `npm run build` then `npx playwright test` (vite preview on :4173; start with `npx vite preview --port 4173 --strictPort &` if needed)
- Pose contact sheets: `npx tsx scripts/pose-sheet.ts out.png [filter] [--dark] [--arch]`
- Lighthouse locally: `npx tsx scripts/serve-dist.ts 4175` (background) then `MSYS_NO_PATHCONV=1 LH_BASE=http://localhost:4175 npx tsx scripts/lighthouse-local.ts / /install` (lighthouse can't spawn Chrome itself here; the script uses Playwright's Chromium)
- Screenshots: `MSYS_NO_PATHCONV=1 [SHOOT_SETUP='/dev/fixture?auto=1&active=1'] npx tsx scripts/shoot.ts <outdir> 'name=/route' 'name=/route|css-to-click'`
- Deploy: `vercel deploy --prod --yes` (project liftlog, team ed-i-th → https://liftlog-jade.vercel.app)
- Don't write big multi-file heredocs in Bash (Git Bash chokes); use the Write tool.
- Python edits: open(..., 'w', newline='
') or files get CRLF (.gitattributes normalises on add).
- Playwright WebKit IndexedDB is ~100-250 ms/op on Windows (D58): keep WebKit e2e data small.
- `tsc -b` includes e2e/ and scripts/: keep them type-clean or the build fails.

## Environment notes
- gh CLI: not installed → GitHub steps in docs/reports/TODO-FOR-PRANAV.md
- Vercel: CLI logged in on this PC
- No Java/Android SDK → APK via GitHub Actions only
- Installed outside the repo: Playwright Chromium + WebKit into %LOCALAPPDATA%\ms-playwright (per-user cache)

## Deployed URL
- https://liftlog-jade.vercel.app (1.0.0)

## Blockers
- (none)
