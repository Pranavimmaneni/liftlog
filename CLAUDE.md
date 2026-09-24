# CLAUDE.md: LiftLog

You are building **LiftLog**, an offline-first workout tracker. It installs as a web app on any iPhone or Android phone, and ships as an Android APK via Capacitor. One person (Pranav) owns this repo and tests on a Pixel 8 Pro and an iPhone.

## Sources of truth (in this order)
1. `docs/PRD.md`: requirements with IDs (FR-…, NFR-…). This is the spec.
2. `design/screens/{light,dark}/*.png`: what each screen looks like (open the PNGs). The matching `.html` files show exact spacing, colours and copy.
3. `design/tokens.css` / `tokens.json`: every colour, font and radius.
4. `design/illustrations/pictos.py`: the reference implementation for pictograms and the muscle map. Port it exactly.
5. `data/*.json`: seed data and tunable constants. Copy them into `src/data/` with `scripts/copy-data.ts`. Never hard-code these numbers.
6. `DECISIONS.md`: every choice you make where the above are silent or conflicting (date, decision, why).

If the PRD and a mockup disagree, follow the PRD and log the conflict in `DECISIONS.md`.

## How to work
- Work **one milestone at a time** (PRD §12). At the end of each milestone, stop and post the milestone report (template below). Don't start the next milestone until told to.
- Start each milestone by writing a short plan in `docs/plans/M<n>.md`: tasks, files, and the requirement IDs they cover.
- **Engines first:** write `src/engine/*` as pure functions with Vitest tests *before* wiring UI. Name tests after requirement IDs (`it('FR-PRG-2: adds one increment when all sets hit repMax')`).
- Keep the app deployable after every commit. Commit small, with messages like `feat(workout): stepper input (FR-WRK-5)`.
- Don't ask questions mid-milestone. Choose the simplest option that satisfies the PRD, log it in `DECISIONS.md`, and continue. Only stop early for something irreversible (e.g. deleting user data) or a blocking contradiction.

## Commands (set these up in M0)
```
npm run dev            # vite dev server
npm run build          # PWA build (Vercel)
npm run build:native   # Capacitor build (VITE_NATIVE=1)
npm run preview        # serve the production build
npm run typecheck      # tsc --noEmit
npm run lint           # eslint + prettier check
npm run test           # vitest
npm run e2e            # playwright (Pixel 7 + iPhone 14, Paper + Iron)
npm run seed           # scripts/seed.ts -> src/data/exercises.json + SEED-REPORT.md
npx cap sync android   # after build:native
```

## Rules
- **Colours:** only CSS variables from `tokens.css` (`var(--ll-ink)` etc., mapped in Tailwind). Never write a hex value in a component. Both themes must look right. Check Paper and Iron for every screen.
- **Platform APIs:** only through `src/platform/` (web + native adapters). Feature code never touches `navigator.wakeLock`, `navigator.vibrate`, BarcodeDetector or Capacitor plugins directly. Always feature-detect (iOS lacks vibrate and BarcodeDetector).
- **Data:**
  - Store weights in kg. Convert at the UI.
  - Every set is written to Dexie the moment it's logged.
  - Schema changes need a new `db.version(n)` with an upgrade function and a migration test.
  - Derived numbers (XP, streaks, tonnage, coverage) are computed, never stored as running totals.
- **Privacy:** no network calls at runtime (fonts self-hosted, no analytics, no CDNs). No backend.
- **Accessibility:**
  - Real `<button>`, `<input>`, `<label>` elements.
  - 44 px targets and visible focus.
  - `aria-label` on icon buttons.
  - Charts get a table view.
  - Respect `prefers-reduced-motion`.
- **Copy:** all user-facing strings go in `src/copy/en.ts`. Plain English, sentence case in body. Uppercase only through the display and label styles.
- **Dependencies:** only those listed in PRD §11 unless you log why in `DECISIONS.md`. Prefer small, hand-rolled SVG over chart libraries.
- **Illustrations:** port `pictos.py` 1:1 (same rig lengths, strokes, halos, angles). Colours come from tokens. New poses go in `src/data/poses.json` and must be checked in `/dev/poses`.
- Don't weaken tests or coverage gates to get green. Fix the code or log the problem.

## Definition of done (per feature)
- Requirement IDs are implemented and referenced in tests.
- Works offline, in both themes, at 360 px and 430 px widths.
- Typecheck, lint, unit and e2e all pass. No axe violations on touched routes.
- Matches the mockup (layout, copy, hierarchy) within reason.

## Milestone report template
```
## M<n> report
Built: <3–6 bullets, with requirement IDs>
Deviations: <what differs from the PRD or mockups and why, or "none">
Decisions logged: <count, and the 1–2 important ones>
Tests: <unit count / coverage for src/engine / e2e pass>
Deployed: <Vercel URL>
Phone checks for Pranav: <copy the checklist for this milestone from docs/PROMPTS.md>
Known issues: <list or "none">
```
