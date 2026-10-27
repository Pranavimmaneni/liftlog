# LiftLog: PRD addendum for 1.1.1 – 1.3.0

This addendum adds to `docs/PRD.md` (v3). The PRD rules (priorities, IDs, traceability) apply here too. Where this addendum changes the PRD, it says so, and `DECISIONS.md` records why.

## Releases

| Release | Scope | Milestones |
|---|---|---|
| 1.1.1 | Fixes from real use | M7 |
| 1.1.2 | Bigger library, a pictogram for every exercise | M8 |
| 1.2.0 | Game-style redesign, food tracking, combined food + training feedback | M9–M12 (IDs added when the food brief arrives) |
| 1.3.0 | Supersets, on-device metrics, split builder 2, rem type sizes | later |

**Platform change (D81):** the Android APK is frozen. The PWA added to the home screen is the only supported install. §2 rows for the APK and M6 stay as history; the `android/` project and native adapter are kept but not built, tested or changed.

**Scope change (D82):** nutrition moves out of §14 "Out of scope" into 1.2.0.

## Food brief from Pranav (received 2026-10-26)

Requirement IDs for 1.2.0 are drafted from this brief after M7.

1. Two in one: food tracking and training in one app.
2. Some things are shared by both, e.g. weight tracking.
3. Combine food and training to say what's lacking and give feedback, e.g. lifting a lot but not eating enough protein, or not enough carbs before a workout. A weekly food review (macros and micros), like the training review.
4. A built-in food library of default foods available everywhere: as much data as can be found, including foods common at Costco, Walmart, etc.
5. Take the user's weight and requirements as input, give macro and micro targets from them, and help track against them.
6. Like the training side: goals, weekly and monthly summaries.
7. Include the other features diet tracking apps have, as long as they need no AI API calls.
8. Game-style redesign with new mockups (from the same message as the M7 fixes).

## 1.1.1 requirements (M7)

| ID | Requirement | Pri |
|---|---|---|
| FR-LIB-8 | The in-workout "Add from list" sheet never hides a match: with "In my gym" on, exercises outside the gym that match the search are listed after the gym ones under "Not in your gym". Custom exercises are always listed. An empty result offers "Create custom exercise"; after saving, the new exercise is added to the open workout and its logger opens. | M |
| FR-WRK-5a | The load and reps steppers accept up to 4 digits plus decimals (e.g. 122.5) from the keypad, and the whole value stays visible while typing and after, at 360 and 430 px. | M |
| FR-WRK-16 | A workout started by mistake is easy to undo. For 10 s after it starts, and while nothing is logged, S06 shows "Workout started" with an Undo button. S06 also has "Cancel workout" at all times: it deletes the session and its sets (confirming first when sets would be lost, naming how many), and leaves the Up next queue unchanged. | M |
| FR-NAV-1 | The Library is not a tab. The tab bar is Today, Plan, Progress. The Library opens from a button on the Plan tab and from Settings, as a full screen with a back button. | M |

Changes to the PRD: FR-LIB-4 (the default "In my gym" filter no longer hides matches in the add sheet); §4 S05 tab bar; §11 routing (`/library` is a full-screen route).

## 1.1.2 requirements (M8)

| ID | Requirement | Pri |
|---|---|---|
| FR-LIB-9 | The library holds 600 or more exercises (FR-LIB-1's 400–600 range is raised), and common gym names are aliases (e.g. "tricep press", "skull crusher", "pec deck"). Every addition and alias is listed in `SEED-REPORT.md`. | M |
| FR-ILL-6 | Every exercise has a pictogram as well as its muscle map (FR-ILL-3's muscle-map-only fallback remains only for custom exercises). Every new pose is checked at `/dev/poses`. | M |

## Traceability (additions to PRD §15)

| Area | Requirements | Milestone | Screens | Verified by |
|---|---|---|---|---|
| Library | FR-LIB-8, FR-LIB-9 | M7, M8 | S06, S13, S17 | screen tests, e2e |
| Workout | FR-WRK-5a, FR-WRK-16 | M7 | S06, S07, S08 | component + screen tests, e2e |
| Navigation | FR-NAV-1 | M7 | S05, S13, S14, S15 | screen tests, e2e |
| Illustration | FR-ILL-6 | M8 | S07, S13, S16 | pose bounds test, `/dev/poses` |
