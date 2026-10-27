# LiftLog handoff (for the next planning session)

Written 2026-10-26. Read this first. It summarises what has been built, where every design and planning document lives, how the project is run, and what is still open. It points to the detailed documents and doesn't repeat them.

## 1. Snapshot

| | |
|---|---|
| What | LiftLog, an offline-first workout tracker. "Paper & Iron" logbook style, pictogram illustrations, no account, no backend |
| Owner | Pranav (tests on a Pixel 8 Pro and an iPhone) |
| Version | **1.1.0** on `main` |
| Live web app | https://liftlog-jade.vercel.app (installable PWA) |
| Demo data | https://liftlog-jade.vercel.app/dev/fixture?auto=1 (use a private window: it replaces local data) |
| Pose sheet | https://liftlog-jade.vercel.app/dev/poses |
| Source | Private repo https://github.com/Pranavimmaneni/liftlog |
| Deploys | Vercel project `liftlog` is connected to GitHub: a push to `main` deploys production, other branches get previews |
| Android | Capacitor 8 APK, built by GitHub Actions (Actions → Android APK → Run workflow). Never built locally: this PC has no JDK or Android SDK |
| Stack | React 19, Vite 8, TypeScript 6, React Router, Dexie 4 (IndexedDB), Tailwind v4 mapped to design tokens, vite-plugin-pwa, Vitest + fake-indexeddb, Playwright + axe, Capacitor 8 |

## 2. What we did, in order

1. **Setup (2026-09-24).** Pranav supplied a handoff pack: PRD, mockups, tokens, pictogram reference and seed data. I wrote `docs/PLAN.md`, resolved 52 gaps and contradictions up front (D1–D52) and ran milestones M0–M6 back to back. Each milestone got a plan (`docs/plans/M<n>.md`), a report (`docs/reports/M<n>.md`), a commit `M<n>: …` and a Vercel deploy.
2. **M0 Foundation:** tooling, CI, tokens and fonts, Paper/Iron theme switching, platform adapter, Dexie v1, PWA shell, `/dev/components`.
3. **M1 Log a workout:** seed library (410 exercises, `SEED-REPORT.md`), engines, the `pictos.py` port (string-identical to the Python), onboarding S01–S04, home, workout, logger, ticket, backup and restore.
4. **M2 Coach:** goal engine, calibration and nudges, split templates with auto-suggest, coverage check with Fix, swap sheet, My Gym (machine photos, settings, increments, custom machines), limitations.
5. **M3 Progression:** progression and deload, override sheet, "Next time" line, full Plan tab, exercise detail, custom exercises, 219 Tier 2 pictograms and `/dev/poses`.
6. **M4 Insight:** weekly and monthly review with insights and one-tap fixes, recomp check, strength levels and body stats, progress hub, session detail, charts with table views.
7. **M5 Motivation and polish:** XP, levels, streak with a rest-week pass, milestones, weekly quest, PR stamps, shareable ticket PNG, QR scan with sticker sheet, backup nudge, install help, storage-error banner, an axe sweep of every screen, a performance budget and Lighthouse CI. A demo contact sheet went to Pranav after M5 (`docs/reports/demo/`).
8. **M6 Android APK:** Capacitor project; native adapter for keep-awake, lock-screen rest notifications, haptics, share and status bar; icons and splash screens; APK workflow; release signing docs; v1.0.0.
9. **Wrap-up:** `docs/reports/FINAL.md`, `docs/reports/TODO-FOR-PRANAV.md`, `LICENSES.md` (D77–D78).
10. **GitHub (2026-09-25).** Pushed to a private repo. Before the push, the history was checked for secrets and personal details, account names were removed from docs, and commit emails were rewritten to the GitHub noreply address. The `gh` CLI was installed per user (logged in `PROGRESS.md`).
11. **1.1.0: Build your own split (D79).** On S03 → "Build your own", each day is a card where you tap muscle groups to combine them (e.g. Chest + Biceps / Shoulders + Triceps / Legs + Back). The app fills each day with standard exercises from `data/muscle-days.json`, then S04 lets you add, remove or replace them. It also works from Plan → Change split. Two fixes shipped with it: the swap sheet works during onboarding and no longer flashes "No alternatives" while loading; the Vitest timeout is now 15 s (D80).
12. **Vercel ↔ GitHub.** Deploys were blocked (`TEAM_ACCESS_REQUIRED`) because the noreply commit email wasn't linked to Vercel. Pranav linked GitHub in his Vercel account, then the repo was connected and auto-deploy confirmed.

## 3. Design and planning documents

**Order of authority** (from `CLAUDE.md`): PRD → mockups → tokens → `pictos.py` → `data/*.json` → `DECISIONS.md`. If the PRD and a mockup disagree, the PRD wins and the conflict is logged in `DECISIONS.md`.

| Document | What it is | Read it when |
|---|---|---|
| `CLAUDE.md` | Working rules for Claude: sources of truth, milestone workflow, commands, hard rules (colours, platform APIs, data, privacy, a11y, copy), definition of done, report template | Always, first |
| `docs/PRD.md` | **The spec (v3).** §1 summary and success metrics, §2 platforms and fallbacks, §4 screen inventory S01–S26 (+ §4.1 specs for screens without mockups), §5 functional requirements with IDs (FR-ONB, GYM, LIB, RTN, WRK, TMR, GOAL, PRG, SUM/REV/STR, XP, SET/DATA, ILL/THM), §6 engine maths, §7 data model, §8 NFRs, §9 design system, §10 illustration system, §11 architecture and allowed dependencies, §12 milestones, §13 testing, §14 out of scope, §15 traceability, Appendix A design rationale | Planning anything new: find or add requirement IDs here |
| `design/README.md` | Map of the design folder | Before opening mockups |
| `design/screens/{light,dark}/` | 15 mockups (S01–S14 + V01 visual system) as 2× PNG plus standalone HTML with exact spacing, colours and copy. Light = Paper, dark = Iron | Building or changing any of those screens |
| `design/tokens.css`, `tokens.json` | Every colour, font and radius for both themes | Any styling. Components never use hex values |
| `design/illustrations/pictos.py` | Reference pictogram rig, equipment parts, 10 Tier 1 exercises and the muscle map. `light/`, `dark/` hold SVG exports; `poses-readme.json` holds rig constants | Adding or changing poses (new poses go in `src/data/poses.json` and get checked at `/dev/poses`) |
| `data/*.json` | Tunable constants and seed data: `splits`, `muscle-days` (1.1.0), `intensity`, `xp`, `standards`, `equipment`, `machines`, `load-types`, `aliases`. `npm run copy-data` copies them to `src/data/` | Changing any number. Never hard-code these values |
| `DECISIONS.md` | **80 logged decisions** (D1–D80): date, the gap or conflict, and the choice | Before re-deciding anything |
| `docs/PLAN.md` | Original build plan: environment found and how D1–D52 were resolved | Background on the early choices |
| `docs/plans/M0–M6.md` | Per-milestone task lists with requirement IDs | Seeing how a milestone was broken down |
| `docs/reports/M0–M6.md` | Milestone reports: built, deviations, tests, phone checks, known issues | What shipped where |
| `docs/reports/FINAL.md` | Requirement-by-requirement status table (PRD §15), test and performance results, not-done list | Current status of any requirement |
| `docs/reports/PHONE-CHECKS.md` | Checks that need a real phone (📱) vs those covered by Playwright | Before release testing |
| `docs/reports/TODO-FOR-PRANAV.md` | Steps only Pranav can do | Checking what's waiting on him |
| `docs/PROMPTS.md` | The original per-milestone prompts and phone-check lists | Writing prompts for new milestones in the same style |
| `docs/INSTALL.md`, `docs/RELEASE.md` | Installing on phones; APK release signing | Distribution work |
| `PROGRESS.md` | Resume file: done list, Windows run notes, environment, blockers | Resuming work |
| `CHANGELOG.md`, `SEED-REPORT.md`, `LICENSES.md` | Release notes; how the 410-exercise library was derived; dependency licences | As needed |

Decisions worth knowing before planning:
- **D2, D3:** the PRD beat the mockups and JSON on nudges and calibration rules.
- **D12, D13:** the seeded catalogue is a lazy JSON chunk; Dexie holds only custom exercises. PRs are a cache rebuilt from `sets`.
- **D23:** strength standards show "Guideline values" until `standards.json` names a source.
- **D58:** Playwright WebKit IndexedDB is slow on Windows. Keep WebKit e2e data small.
- **D74:** no local Android toolchain; the APK comes from CI.
- **D78:** FR-LIB-7 (photos) and FR-WRK-15 (supersets) were deliberately not built.
- **D79:** how custom muscle-group days are filled.

## 4. How the code is organised

| Folder | Contents |
|---|---|
| `src/engine/` | Pure functions, no `Date.now` (pass `now`), covered by Vitest at 99.9%: goal, progression, calibration, deload, coverage, suggest, split, custom-split, rotation, review, strength, xp, e1rm, warmup, timer, search, units |
| `src/db/` | Dexie schema and migrations, repositories (workout, insight, motivation, custom exercises, machines, deload), backup, restore and CSV |
| `src/screens/` | One folder per screen ID (`S04-routine`, `S07-logger`, …), `onboarding/` for S01–S03, plus screen-level integration tests (`m*-screens.test.tsx`, `custom-split.test.tsx`) |
| `src/components/` | Shared UI: Button, Card, Chip, Stepper, Sheet, SegmentedControl, Chart, TabBar, … |
| `src/platform/` | Web and native adapters. The only place that touches wake lock, vibrate, BarcodeDetector or Capacitor plugins |
| `src/illustration/` | The `pictos.py` port and pose animation |
| `src/copy/en.ts` | Every user-facing string |
| `e2e/` | Playwright specs per milestone plus `custom-split.spec.ts`. Projects: Pixel 7 and iPhone 14, each in Paper and Iron |
| `scripts/` | seed, copy-data, budget check, Lighthouse runner, Brotli preview server, screenshot tool, pose contact sheets, native smoke test, icon generation |
| `.github/workflows/` | `ci.yml` (typecheck, lint, unit, e2e), `lighthouse.yml` (≥ 90 gate), `android-apk.yml` (debug or signed APK) |
| `android/` | Capacitor Android project (appId `app.liftlog`, versionCode 2 / versionName 1.1.0) |

Hard rules (details in `CLAUDE.md`):
- Colours only from tokens, and both themes checked.
- Platform APIs only through `src/platform/`.
- Weights stored in kg; every set written to Dexie as it's logged.
- Schema changes need `db.version(n)` with an upgrade function and a migration test.
- Derived numbers (XP, streaks, coverage) are computed, never stored.
- No network calls at runtime.
- 44 px targets; charts have a table view.
- Copy goes in `en.ts`.
- New dependencies need a decision entry.
- Never weaken tests to get green.

## 5. Current quality bar

- **Unit, integration and screen tests:** 334 passing. Coverage gates: `src/engine` ≥ 90% (at 99.9%), overall ≥ 70% (~84%).
- **End-to-end:** 128/128 across the 4 Playwright projects, with axe on every touched screen.
- **Performance:** first-load JS 163 KB gzipped (budget 250 KB); precache 2.6 MB (budget 5 MB); Lighthouse mobile ≥ 90 in every category.
- **Commands:** `npm run typecheck | lint | test | build | e2e | budget`. Run e2e after `npm run build`; it uses `vite preview` on :4173.

## 6. Not done, open items and known limits

**Not built (PRD "Could", D78):** FR-WRK-15 supersets and circuits; FR-LIB-7 exercise photos.

**Out of scope for v1 (PRD §14):** accounts, cloud sync, social features, nutrition, AI coaching, watch apps, iOS App Store build, localisation.

**Waiting on Pranav** (`docs/reports/TODO-FOR-PRANAV.md`):
1. Install the web app on both phones.
2. Do the 📱 phone checks.
3. Build and install the APK from Actions. This is also the first check of the NFR-SIZE-1 target (APK < 15 MB).
4. Give `standards.json` a published source.
5. *(Optional)* Add a Vercel bypass secret so Lighthouse can audit previews.
6. *(Optional)* Set up a release keystore for a signed APK.

**Known limits:**
- Text sizes are in px (as in the mockups), so a test at 200% system text size still needs a real phone.
- A true offline reload can't be tested in Playwright's WebKit (D34).
- WebKit e2e is slow on Windows (D58); full e2e takes about 6 minutes.

**Environment quirks (Windows, Git Bash):**
- Set `MSYS_NO_PATHCONV=1` when passing `/route` arguments.
- Python file writes need `newline='\n'`.
- Large heredocs break; use the Write tool instead.
- Lighthouse runs through Playwright's Chromium (`scripts/lighthouse-local.ts`).
- More in `PROGRESS.md`.

## 7. Ideas for the next round (not decided; for the planner to weigh)

- **Custom split follow-ups:**
  - Save and reuse custom day templates.
  - Choose how many exercises per group, or a time budget per day.
  - Reorder days.
  - Show coverage while picking groups on S03.
- **Supersets and circuits (FR-WRK-15):** needs a logger flow for paired exercises and rest after the pair, plus summary and XP rules.
- **Exercise photos (FR-LIB-7):** would need lazy, non-precached images to stay within the 5 MB budget.
- **Real strength standards:** source the data, then retune S11.
- **Tuning from real use:** the PRD §1 success metrics (time to first set, % of sets accepted pre-filled, override rate under 15%, sessions completed) suggest an on-device, offline stats view to check them after 4 weeks.
- **Android release:** signed APK and, if wanted, the Play Store (needs a policy review of exact-alarm use, D75).
- **iOS:** only through the PWA unless an Apple developer account becomes available.
- **Larger, previously out of scope:** optional encrypted sync or export to a file provider. This would break "no backend", so it needs an explicit PRD change.

When planning new work, add requirement IDs to `docs/PRD.md` (or a v1.2 addendum) first, then follow the `CLAUDE.md` workflow: plan file → engines and tests → UI → all checks green → screenshots in both themes → report.

## 8. Suggested opening prompt for a new session

> Read `docs/HANDOFF.md`, then `CLAUDE.md`, `docs/PRD.md` and `DECISIONS.md`. LiftLog 1.1.0 is live and every milestone M0–M6 is done. Help me plan the next version: propose a scoped v1.2 with requirement IDs, the milestones and the open questions you need me to answer. Don't write code yet.
