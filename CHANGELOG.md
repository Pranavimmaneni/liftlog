# Changelog

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
