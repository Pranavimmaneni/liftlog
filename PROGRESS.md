# PROGRESS

Resume file. If the session resets, read this, then `docs/PLAN.md`, then the current `docs/plans/M<n>.md`.

## Current
- Milestone: **M5 Motivation and polish**
- Step: starting (write docs/plans/M5.md)

## Done
- [x] Read handoff; repo root = project folder; `git init`
- [x] `docs/PLAN.md`, `DECISIONS.md` (D1–D52)
- [x] **M0 Foundation**: report docs/reports/M0.md
- [x] **M1 Log a workout**: report docs/reports/M1.md (223 unit, engine 99.3%, overall 84.8%, e2e 52/52)
  - Also shipped early: auto-suggest (FR-RTN-1), swap sheet S23, full goal/progression replay engine (FR-GOAL, FR-PRG-1…6), S20 weigh-in, /dev/fixture
- [x] **M2 Coach**: report docs/reports/M2.md (236 unit, engine 99.2%, e2e 76/76)

- [x] **M3 Progression**: report docs/reports/M3.md (262 unit, engine 99.8%, overall 85.2%, e2e 96/96)
- [x] **M4 Insight**: report docs/reports/M4.md (295 unit, engine 99.9%, overall 86.7%, e2e 108/108)

## Next
- M5: XP/levels/stamps/streaks (rest-week pass)/milestones/weekly quest (xp.json, FR-XP), share-ticket PNG (FR-SUM-2), S22 QR scan (/scan, /m/:machineId, self-hosted zxing-wasm fallback) + sticker sheet, backup nudges, S21 install help (/install) + banner, S26 empty/error states + storage-error banner, full axe pass, NFR-PERF budget, Lighthouse CI config/workflow (scores >= 90)
- Then M6: Capacitor Android, native adapter, icons/splash, v1.0.0, docs/RELEASE.md, .github/workflows/android-apk.yml
- Then FINAL.md + complete TODO-FOR-PRANAV.md (incl. standards.json source)

## How to run things (Windows / Git Bash notes)
- `npm run build` then `npx playwright test` (vite preview on :4173; start with `npx vite preview --port 4173 --strictPort &` if needed)
- Pose contact sheets: `npx tsx scripts/pose-sheet.ts out.png [filter] [--dark] [--arch]`
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
- https://liftlog-jade.vercel.app (M4)

## Blockers
- (none)
