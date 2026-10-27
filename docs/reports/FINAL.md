# LiftLog 1.0.0: final report

All six milestones (M0–M6) are built, tested, committed on `main` and deployed.
- **Live web app:** https://liftlog-jade.vercel.app
- **Source:** private repo https://github.com/Pranavimmaneni/liftlog
- **Android APK:** built by GitHub Actions (Actions → Android APK → Run workflow).

Handoff summary for the next planning session: `docs/HANDOFF.md`. Per-milestone detail is in `docs/reports/M0.md` … `M6.md`; decisions D1–D78 are in `DECISIONS.md`.

## What works, by requirement (PRD §15 traceability)

| Area | Requirements | Status | Where it's built | Verified by |
|---|---|---|---|---|
| Platform | FR-PLT-1…10 | ✅ all | M0 (PWA, offline, themes), M5 (QR, install help, share), M6 (APK: keep-awake, lock-screen rest alert, haptics, share, status bar) | e2e offline on every project; native adapter unit tests; native bundle smoke test; 📱 device checks |
| Onboarding | FR-ONB-1…6 | ✅ | M1–M2 | e2e #1 (first set well under 3 min) |
| Gym | FR-GYM-1…5 | ✅ | M1–M2: presets, limitations, machine photo/settings/increment, custom machines | unit (filters), e2e M2 checks |
| Library | FR-LIB-1…6 | ✅ (FR-LIB-7 "Could": not built) | M1, M3: 410 exercises, alias search, filters, S16 detail, S17 custom | unit (search < 100 ms, seed rules), SEED-REPORT.md, e2e |
| Routine | FR-RTN-1…6 | ✅ | M1–M3: auto-suggest, swap, coverage + fix, rotation queue, reorder, change split | unit (suggest, coverage, rotation), e2e #6 |
| Workout | FR-WRK-1…14 | ✅ (FR-WRK-15 supersets, "Could": not built) | M1: logger, steppers, effort, calibration and nudges, resume, auto-finish | e2e #2, #3, #4 |
| Timer | FR-TMR-1…4 | ✅ | M1 (timestamps), M6 (lock-screen notification) | unit (timestamp maths), native adapter tests, 📱 |
| Goals | FR-GOAL-1…5 | ✅ | M1–M2: goal engine with reasons, overrides | unit |
| Progression | FR-PRG-1…8 | ✅ | M1 (engine), M3 (deload, S24 override, "Next time") | unit (every §5.8 rule), e2e #7, e2e for the drop after two misses |
| Summaries | FR-SUM-1/2, FR-REV-1…3, FR-STR-1…3, FR-PRO-1 | ✅ | M1 (ticket), M4 (review, recomp, strength levels, hub, S18/S19), M5 (share PNG) | unit (insights, recomp, strength), 6-week fixture, e2e M4 checks |
| Motivation | FR-XP-1…6 | ✅ | M5: XP ledger, levels, streak with rest-week pass, milestones, weekly quest, PR stamps | unit (ledger, levels, streak, quest), e2e ticket |
| Settings/data | FR-SET-1…4, FR-DATA-1…5 | ✅ | M0–M1 (settings, backup/restore/delete/CSV), M5 (backup nudge) | e2e #5 (backup → delete → restore), nudge e2e |
| Illustration/theme | FR-ILL-1…4, FR-THM-1 | ✅ | M1 (pictos.py port, string-identical), M3 (219 Tier 2 poses) | port test against the Python reference, pose-bounds test, `/dev/poses`, contact sheets in docs/reports/poses |
| Non-functional | NFR-* | ✅ with notes below | all milestones | Lighthouse, axe sweep (21 views × 2 themes × 2 phones), coverage gates, migration test, budget script |

## Test results
- **Unit, integration and screen tests:** 334 passing (Vitest) as of 1.1.0.
- **Coverage:** `src/engine` 99.9% lines (gate 90%), overall 84.4% (gate 70%).
- **End-to-end:** **128/128 passing** (1.1.0) on Pixel 7 (Chromium) and iPhone 14 (WebKit), each in Paper and Iron. That covers e2e #1–#7, the phone checks for every milestone, and an accessibility sweep with axe on every screen.
- **Performance:**
  - First-load JS is **163 KB gzipped** (budget 250 KB, `npm run budget`).
  - Library search takes under 100 ms.
  - The PWA precache is 2.6 MB (budget 5 MB).
- **Lighthouse (mobile), production build served with Brotli like Vercel:**

  | Page | Performance | Accessibility | Best practices | SEO |
  |---|---|---|---|---|
  | First visit (onboarding) | 90 | 100 | 100 | 91 |
  | Install help | 94–96 | 100 | 100 | 91 |

  `.github/workflows/lighthouse.yml` enforces ≥ 90 in CI.
- **Pictograms:** 229 (10 Tier 1 ported 1:1 from pictos.py plus 219 Tier 2). A test checks that every joint stays in frame through the whole animation.

## Not done, and why
- **FR-LIB-7, dataset photos** ("Could"). It would add hundreds of image files outside the precache budget, and the pictograms cover the need (D78).
- **FR-WRK-15, supersets and circuits** ("Could"). This needs a separate logger flow; left for a later version (D78).
- **The APK hasn't been built on this PC,** which has no JDK or Android SDK (D74). The GitHub workflow builds it. The native web bundle and the adapter are tested here. Because of that, **NFR-SIZE-1's APK size (< 15 MB) is unverified** until the first CI build.
- **Vercel preview Lighthouse runs** need a bypass secret (D71, TODO 7). Until then the same audit runs against the production build in CI.
- **NFR-A11Y-3:** reduced motion is respected (pictogram animation and stamps). Text size is set in px, as in the mockups, so browser text-size settings have limited effect. Pinch-zoom is allowed, and no primary action clips at 360 px width. A real test at 200% system text is a phone check.
- **Strength standards** are starter values. The app says **"Guideline values"** until `standards.json` has a published source (TODO 5).
- **Test-environment limits:**
  - Playwright's WebKit on Windows has slow IndexedDB (~100–250 ms per operation, D58). A few heavy tests are marked slow.
  - A true offline reload can't run in Playwright's WebKit (D34).
  - Both are covered by phone checks.

## Deployed URL
**https://liftlog-jade.vercel.app** (production, version 1.1.0, adds Build your own split by muscle groups).

Every push to `main` on GitHub deploys automatically (TODO 6, done); `vercel deploy --prod --yes` in this folder still works. Demo data: open https://liftlog-jade.vercel.app/dev/fixture?auto=1 in a fresh or private window.

## Install on your phones (short version of docs/INSTALL.md)
- **iPhone:**
  1. Open the URL in **Safari**, then tap **Share** → **Add to Home Screen** → **Add**.
  2. Always open it from the icon, which keeps its own data.
  3. iOS 18.4+ keeps the screen awake during workouts. On older iOS, raise Auto-Lock while you train.
- **Android, web app:** open the URL in **Chrome** → ⋮ → **Install app**.
- **Android, APK** (adds lock-screen rest alerts):
  1. GitHub → Actions → **Android APK** → Run workflow (`debug`).
  2. Download **liftlog-apk**, unzip, copy the `.apk` to the phone and open it.
  3. To update, install the new APK over the old one; your data stays.
- **Moving data between web and APK:** Settings → Back up now in one, then Restore from backup in the other.

## Your TODO list, in order
Full steps are in `docs/reports/TODO-FOR-PRANAV.md`.
1. ~~**Push to GitHub.**~~ Done: https://github.com/Pranavimmaneni/liftlog (private).
2. **Install the web app** on the Pixel (Chrome → Install app) and the iPhone (Safari → Add to Home Screen).
3. **Do the 📱 phone checks** in `docs/reports/PHONE-CHECKS.md`.
4. **Build and install the APK** from GitHub Actions. Allow notifications, and "Alarms & reminders" if alerts arrive late.
5. **Give `standards.json` a real source.** Replace the bands, fill in `"source"`, then run `npm run copy-data`.
6. ~~Connect Vercel to GitHub so every push deploys.~~ Done.
7. *(Optional)* Add `VERCEL_AUTOMATION_BYPASS_SECRET` so Lighthouse CI can audit previews.
8. *(Optional)* Create a keystore and 4 secrets for a signed release APK (`docs/RELEASE.md`).
