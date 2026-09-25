# Changelog

## 1.1.0 (2026-09-25)
- Build your own split: combine muscle groups per day (e.g. Chest + Biceps, Legs + Back); LiftLog suggests exercises covering them, then you add, remove or replace on the routine screen. Also in Plan → Change split.
- Routine tabs show full day names and scroll sideways.
- Swap sheet offers alternatives during onboarding, and no longer flashes "No alternatives" while loading.

## 1.0.0 / M6 Android APK (2026-09-25)
- Android app via Capacitor: rest-end notification with the phone locked, keep-screen-on, haptics, share sheet, themed status bar.
- LL monogram icon and Paper/Iron splash screens.
- GitHub Actions workflow for debug and signed release APKs; docs/RELEASE.md.

## M5 Motivation and polish (2026-09-25)
- XP, levels, weekly streak with rest-week pass, milestones and a weekly quest, all derived from the log.
- Shareable ticket image; PR stamp on the set row.
- QR scanning (with an offline iOS fallback), machine links and a printable sticker sheet.
- Backup nudges, install help, storage-error banner; every screen axe-clean in both themes.
- Performance budget and Lighthouse CI (every score >= 90).

## M4 Insight (2026-09-24)
- Weekly and monthly review with "Going well", "Needs work" (one-tap fix) and next week's changes with reasons.
- Recomp check with bodyweight and strength sparklines.
- Strength levels by sex, age and bodyweight ("Guideline values" until standards are sourced), with body stats.
- Progress hub: e1RM charts with table views, PRs, weigh-ins, history; session detail with set editing and delete.

## M3 Progression (2026-09-24)
- Deload weeks (scheduled or after stalls), announced a week ahead on Home and Plan.
- Change-the-target sheet with "Reset to coach's pick", and a "Next time" line with the reason.
- Plan tab: week strip, drag/keyboard reorder, skip to, change split.
- Exercise detail with history and an e1RM chart; custom exercises.
- 219 Tier 2 pictograms from pose data, with a /dev/poses gallery.

## M2 Coach (2026-09-24)
- Weekly hard-set coverage per muscle with "+ Fix", and routines that fill their own gaps.
- Machine photos, named settings and stack increments on the machine logger; custom machines.

## M1 Log a workout (2026-09-24)
- Seeded library of 410 exercises with a deterministic seed report.
- Onboarding (S01–S04) with an auto-built routine, Home, workout list, exercise logger, rest timer, session ticket.
- Goal and progression engine with reasons, calibration and in-session nudges; warm-ups; bonus reps; PRs.
- Tier 1 pictograms and muscle map ported from pictos.py; library search; settings with backup, restore, CSV and delete.

## M0 Foundation (2026-09-24)
- Vite + React 19 + TypeScript strict, ESLint + Prettier, Vitest, Playwright (Pixel 7 + iPhone 14 × Paper + Iron).
- Paper & Iron tokens mapped into Tailwind v4, self-hosted fonts, System/Paper/Iron theme with status-bar colours.
- Platform adapter (web + native stub), Dexie schema v1, local error log, crash screen, backup export/import engine.
- PWA: manifest, LL monogram icons, precaching service worker, "New version" toast that waits for the workout to end.
- `/dev/components`, CI workflow, `vercel.json` with SPA rewrite, cache headers and CSP.
