# Prompts for Claude Code

Paste these into Claude Code one at a time, in order. After each milestone, run the phone checks yourself before sending the next prompt. Time estimates are rough Claude Code working times. Your own checking time is extra.

---

## 0. Kickoff (paste once, at the start)

> You're building LiftLog from the handoff files in this folder. Read `CLAUDE.md` fully, then `docs/PRD.md`, then look at every PNG in `design/screens/light/` and `design/screens/dark/`, and skim `design/illustrations/pictos.py` and `data/*.json`.
>
> Then reply with:
> 1. A 10-line summary of what you're building.
> 2. Any contradictions or gaps you found in the PRD, mockups or data (with your proposed resolution).
> 3. Your plan for M0 (PRD §12).
>
> Don't write code yet.

Read its answer. If a proposed resolution is wrong, correct it in one message. Then send the M0 prompt.

---

## M0: Foundation (~1–2 h)

> Build **M0 Foundation** from PRD §12. Follow CLAUDE.md.
> - Scaffold Vite + React + TS strict, Tailwind v4 mapped to `design/tokens.css`, self-hosted fonts, theme switching (System/Paper/Iron) with the right status-bar colours, the `src/platform/` adapter (web implementation plus native stubs), the Dexie schema v1 from PRD §7, an error boundary, and `vite-plugin-pwa` with manifest and icons (use a placeholder "LL" monogram in the Paper palette).
> - Add `/dev/components` with Button, Card, Chip, Stepper in both themes.
> - Copy `ci/ci.yml` to `.github/workflows/`. Add `vercel.json` with the SPA rewrite and cache headers.
> - Give me the exact steps to create the GitHub repo and connect Vercel if you can't do it yourself.
>
> Stop and post the M0 report.

**Phone checks (M0)**
1. On the Pixel, open the Vercel URL in Chrome and choose "Install app". It opens full-screen with the LL icon.
2. On the iPhone, open it in Safari and use Share → Add to Home Screen. It opens without the Safari bars.
3. Switch the phone's dark mode on and off. The app follows. Force Paper and Iron in `/dev/components`.
4. Turn on airplane mode, close and reopen the app. It still loads.

---

## M1: Log a workout (~4–6 h)

> Build **M1 Log a workout** from PRD §12. Follow CLAUDE.md.
> - Run the seed script first and show me `SEED-REPORT.md` totals.
> - Build the engines needed for M1 with tests first (warm-ups, goal-set check, bonus, e1RM, volume by load type, rest-timer math).
> - Then build the screens S01, S03 (S02 defaults to full gym), S04 (no coverage yet), S05, S06, S07, S08, S09, S25, plus backup export/import in S14.
> - Port the Tier 1 pictograms and the muscle map from `pictos.py`.
> - Match the mockups in both themes.
>
> Stop and post the M1 report.

**Phone checks (M1)**
1. Fresh install: onboard and log your first set in under 3 minutes.
2. Log a whole real workout. The goal meter fills, the rest timer counts down, and the ticket shows totals.
3. Mid-exercise, swipe the app away and reopen it. You land back in the session with every set intact.
4. Back up, delete the app, reinstall, restore. Everything is back.
5. Check the dumbbell exercise says "kg / hand" everywhere.

---

## M2: Coach (~4–5 h)

> Build **M2 Coach** from PRD §12: goal engine with reasons, calibration and in-session nudges, split templates and auto-suggest from `data/splits.json`, coverage check with "+ Fix", swap sheet (S23), full My Gym (S02, machine photos and settings on S08), and limitations. Engine coverage must be at least 90%.
>
> Stop and post the M2 report.

**Phone checks (M2)**
1. Pick a new split. The suggested routine only uses equipment you ticked.
2. The coverage check flags a missing muscle, and "+ Fix" adds something sensible.
3. On a new exercise, log an easy first set. The app suggests a heavier second set.
4. Add a photo and seat settings for a machine. They show next time you open it.

---

## M3: Progression (~4–6 h)

> Build **M3 Progression** from PRD §12:
> - progression engine (every rule in §5.8, each with a test), `goalChanges` with reasons, override sheet (S24), deload scheduling, bonus tracking
> - Tier 2 poses for about 120 common exercises with a `/dev/poses` gallery
> - pose animation, S16, S17
>
> Show me `/dev/poses` screenshots for review before you finish.
>
> Stop and post the M3 report.

**Phone checks (M3)**
1. Repeat a session where you hit every rep. Next time the weight goes up, with a reason.
2. Miss reps twice in a row. The weight drops 10% with a reason.
3. Override a target. It sticks, and "Reset to coach's pick" undoes it.
4. Look through the pose gallery and note any pose that looks wrong.

---

## M4: Insight (~3–4 h)

> Build **M4 Insight** from PRD §12:
> - weekly/monthly review (S10) with insights (§6.7)
> - recomp check (§6.8) and weigh-ins (S20)
> - strength levels (S11) with body stats (S19)
> - progress hub (S12) and session history (S18)
> - every chart with a table view
>
> Seed a realistic 6-week fixture in dev to demo them.
>
> Stop and post the M4 report.

**Phone checks (M4)**
1. Weekly review shows one "Going well" and one "Needs work" that match what you actually did.
2. Log 3 weigh-ins. The recomp check appears.
3. Strength levels ask for body stats once, then show your next milestone.
4. History lists past sessions, and you can edit a set there.

---

## M5: Motivation and polish (~4–5 h)

> Build **M5** from PRD §12:
> - XP, levels, stamps, streaks with rest-week pass, milestones, weekly quest, shareable ticket image
> - QR scan with the WASM fallback for iOS, plus the sticker sheet
> - backup nudges, install help (S21), all empty and error states
> - full accessibility pass (axe clean) and the performance budget (NFR-PERF)
>
> Add Lighthouse CI on the Vercel preview with every score ≥ 90.
>
> Stop and post the M5 report.

**Phone checks (M5)**
1. A PR set shows the stamp animation, and XP goes up on the ticket.
2. Print the sticker sheet. Scanning a sticker opens that machine on both phones.
3. Turn on the largest system text size. Nothing important is cut off.
4. The install help screen shows the right steps on each phone.

---

## M6: Android APK and release (~2–3 h)

> Build **M6** from PRD §12:
> - add Capacitor Android
> - native platform adapter: keep-awake, local notification when rest ends while the phone is locked, haptics, share/filesystem for backups, status bar per theme
> - app icon and splash in Paper and Iron
> - copy `ci/android-apk.yml` to `.github/workflows/` and make it produce a debug APK
> - set the version to 1.0.0 and write `docs/RELEASE.md` explaining how to cut a signed release APK
>
> Stop and post the M6 report.

**Phone checks (M6)**
1. Run the "Android APK" workflow on GitHub, download the APK, and install it on the Pixel.
2. Start a rest timer and lock the phone. A notification fires when rest ends.
3. Export from the web app and import into the APK. Your history appears.

---

## If something goes wrong

- **It's drifting from the design:** "Compare `<screen>` with `design/screens/light/<file>.png` and list every difference, then fix them."
- **Tests are being skipped:** "Run the full test suite and show me the output. Don't skip or weaken tests."
- **It wants to add a dependency:** "Is this in PRD §11? If not, justify it in DECISIONS.md or build it without."
- **Something breaks on the iPhone only:** "Check this against the FR-PLT table in PRD §2.2 and make sure the platform adapter feature-detects it."
