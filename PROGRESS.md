# PROGRESS

Resume file. If the session resets, read this, then `docs/PLAN.md`, then the current `docs/plans/M<n>.md`.

## Current
- Milestone: **M1 Log a workout**
- Step: starting (plan → seed script → engines → UI)

## Done
- [x] Read all handoff files; moved handoff to repo root; `git init` (local identity Pranav)
- [x] `docs/PLAN.md`, `DECISIONS.md`
- [x] **M0 Foundation**: committed, deployed, report in docs/reports/M0.md (34 unit, 24/24 e2e)

## Next
- M1: docs/plans/M1.md, then scripts/seed.ts (vendor free-exercise-db @ a859101), engines, illustrations port, screens S01–S09, S13 min, S14, S25

## How to run things (Windows / Git Bash notes)
- `npm run build` then `npx playwright test` (uses vite preview on :4173)
- Screenshots: `npx vite preview --port 4173 &` then `MSYS_NO_PATHCONV=1 npx tsx scripts/shoot.ts <outdir> name=/route …`
  (MSYS_NO_PATHCONV stops Git Bash rewriting /routes into paths)
- Deploy: `vercel deploy --prod --yes` (project liftlog, team ed-i-th, alias https://liftlog-jade.vercel.app)

## Environment notes
- gh CLI: not installed → GitHub steps in docs/reports/TODO-FOR-PRANAV.md
- Vercel: CLI logged in on this PC
- No Java/Android SDK → APK via GitHub Actions only
- Installed outside the repo: Playwright Chromium + WebKit browsers into %LOCALAPPDATA%\ms-playwright (per-user cache, not global npm)

## Deployed URL
- https://liftlog-jade.vercel.app (M0)

## Blockers
- (none)
