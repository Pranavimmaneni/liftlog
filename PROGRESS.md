# PROGRESS

Resume file. If the session resets, read this, then `docs/PLAN.md`, then the current `docs/plans/M<n>.md`.

## Current
- Milestone: **M4 Insight**
- Step: starting (write docs/plans/M4.md)

## Done
- [x] Read handoff; repo root = project folder; `git init`
- [x] `docs/PLAN.md`, `DECISIONS.md` (D1–D52)
- [x] **M0 Foundation**: report docs/reports/M0.md
- [x] **M1 Log a workout**: report docs/reports/M1.md (223 unit, engine 99.3%, overall 84.8%, e2e 52/52)
  - Also shipped early: auto-suggest (FR-RTN-1), swap sheet S23, full goal/progression replay engine (FR-GOAL, FR-PRG-1…6), S20 weigh-in, /dev/fixture
- [x] **M2 Coach**: report docs/reports/M2.md (236 unit, engine 99.2%, e2e 76/76)

- [x] **M3 Progression**: report docs/reports/M3.md (262 unit, engine 99.8%, overall 85.2%, e2e 96/96)

## Next
- M4 Insight: S10 weekly/monthly review + insights (§6.7) incl. next week's goal changes (FR-PRG-8), recomp check (§6.8), S11 strength levels ("Guideline values" chip while standards.json source is TODO), S12 hub (Lifts/Body/History/PRs), S18 session detail at /progress/session/:id, S19 body stats, charts with table views

## How to run things (Windows / Git Bash notes)
- `npm run build` then `npx playwright test` (vite preview on :4173; start with `npx vite preview --port 4173 --strictPort &` if needed)
- Pose contact sheets: `npx tsx scripts/pose-sheet.ts out.png [filter] [--dark] [--arch]`
- Screenshots: `MSYS_NO_PATHCONV=1 [SHOOT_SETUP='/dev/fixture?auto=1&active=1'] npx tsx scripts/shoot.ts <outdir> 'name=/route' 'name=/route|css-to-click'`
- Deploy: `vercel deploy --prod --yes` (project liftlog, team ed-i-th → https://liftlog-jade.vercel.app)
- Don't write big multi-file heredocs in Bash (Git Bash chokes); use the Write tool.
- `tsc -b` includes e2e/ and scripts/: keep them type-clean or the build fails.

## Environment notes
- gh CLI: not installed → GitHub steps in docs/reports/TODO-FOR-PRANAV.md
- Vercel: CLI logged in on this PC
- No Java/Android SDK → APK via GitHub Actions only
- Installed outside the repo: Playwright Chromium + WebKit into %LOCALAPPDATA%\ms-playwright (per-user cache)

## Deployed URL
- https://liftlog-jade.vercel.app (M3)

## Blockers
- (none)
