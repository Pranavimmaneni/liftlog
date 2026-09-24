# PROGRESS

Resume file. If the session resets, read this, then `docs/PLAN.md`, then the current `docs/plans/M<n>.md`.

## Current
- Milestone: **M2 Coach**
- Step: starting (plan → coverage engine → S04 coverage + Fix → S08 machine panel → custom machines → e2e #6)

## Done
- [x] Read handoff; repo root = project folder; `git init`
- [x] `docs/PLAN.md`, `DECISIONS.md` (D1–D49)
- [x] **M0 Foundation**: report docs/reports/M0.md
- [x] **M1 Log a workout**: report docs/reports/M1.md (223 unit, engine 99.3%, overall 84.8%, e2e 52/52)
  - Also shipped early: auto-suggest (FR-RTN-1), swap sheet S23, full goal/progression replay engine (FR-GOAL, FR-PRG-1…6), S20 weigh-in, /dev/fixture

## Next (M2)
- engine/coverage.ts (§6.5) + "+ Fix" (FR-RTN-3): coverage card on S04 (onboarding + Plan edit)
- S08 machine panel: photo (compress 800 px JPEG q0.8 Blob), named settings, increment (FR-GYM-2/3); machine notes editor
- Custom machines (FR-GYM-4) in Settings → My gym
- e2e #6 swap exercise; M2 phone checks; screenshots S02/S04/S08 vs mockups
- Then M3: S24 override sheet, deload scheduling (FR-PRG-7), goalChanges list, Tier 2 poses (~120) + /dev/poses, S16, S17, S15 full (drag reorder, change split, deload banner), e2e #7

## How to run things (Windows / Git Bash notes)
- `npm run build` then `npx playwright test` (vite preview on :4173; start with `npx vite preview --port 4173 --strictPort &` if needed)
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
- https://liftlog-jade.vercel.app (M1)

## Blockers
- (none)
