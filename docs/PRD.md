# LiftLog: Product Requirements (v3)

The complete specification for building LiftLog end to end. Read it with:
- `CLAUDE.md`: how to work in this repo
- `design/`: screens, tokens, illustrations
- `data/`: seed data and tunable constants

Requirement IDs (`FR-…`, `NFR-…`) are referenced by tests and by the traceability table in §15. When this document and a mockup disagree, this document wins. Record the conflict in `DECISIONS.md`.

---

## 1. Product summary

LiftLog is a workout tracker that plans your training, sets a goal for every set, and pushes those goals up as you get stronger. It is styled like an old-school gym logbook ("Paper & Iron") and uses pictogram illustrations for every common lift.

**Goals**
1. Log a set in one tap when you hit the goal.
2. Always know what to lift next and why.
3. Make progress visible and motivating without rewarding junk volume.
4. Work fully offline, with no account, on any iPhone or Android phone.

**Success metrics (personal use, first 4 weeks)**
- Median time from opening the app to the first logged set: under 20 s.
- At least 70% of sets logged by accepting pre-filled values.
- Target overrides below 15% of sets. A higher rate means the progression constants need tuning.
- Planned sessions completed: at least 80%.

---

## 2. Platforms and distribution

**Decision:** one codebase, shipped two ways.

| Channel | Who | How they install | Status |
|---|---|---|---|
| **Progressive Web App (primary)** | Any iPhone or Android | Open the URL, then "Add to Home Screen" (iOS Safari) or "Install app" (Android Chrome) | Required, from M1 |
| **Android APK (Capacitor)** | Android users who want native alerts | Download the APK built by GitHub Actions and sideload it | Required, M6 |
| iOS App Store / TestFlight | n/a | Needs a paid Apple Developer account and a Mac | Out of scope. The Capacitor iOS project can be added later without code changes. |

Why the PWA is primary: it's the only option that installs on both platforms for free, with no store and one URL. The APK exists because Android lets a native wrapper fire rest-timer alerts while the phone is locked, which a web app cannot do.

### 2.1 Support matrix

- **iOS / iPadOS:** 16.4 or later, installed from Safari. Best on 18.4 or later, where screen wake lock works in installed web apps.
- **Android:** 9 or later, with current Chrome for the PWA. The APK uses the minSdk of the Capacitor version in use.
- **Screen widths:** 360–430 px (primary), up to tablet. The layout is a centred column, max 480 px wide.
- **Desktop browsers:** usable for development and backup restore only. Not a design target.

### 2.2 Platform capabilities and fallbacks (FR-PLT)

| ID | Capability | Android PWA | iOS PWA | Android APK | Required behaviour |
|---|---|---|---|---|---|
| FR-PLT-1 | Offline | ✓ service worker | ✓ | ✓ bundled | Every screen works in airplane mode after first load |
| FR-PLT-2 | Keep screen on during a session | Wake Lock API | Wake Lock API on 18.4+ | Capacitor keep-awake plugin | Use it when available. On older iOS, offer a "Keep screen on" hint in the session header. |
| FR-PLT-3 | Rest-end alert, app open | vibrate + sound | sound + on-screen flash (no vibration API) | haptics + sound | Always a visual cue. Sound is unlocked by the "Start workout" tap. |
| FR-PLT-4 | Rest-end alert, phone locked | not possible | not possible | Local Notifications plugin | Web builds must not claim lock-screen alerts |
| FR-PLT-5 | QR scanning | BarcodeDetector | not available, use the WASM polyfill (`barcode-detector` npm, based on zxing-wasm) | same as Android PWA | Feature-detect, load the polyfill lazily only on the scan screen |
| FR-PLT-6 | Export backup file | Web Share API with file, download fallback | Web Share API with file (to Files) | Capacitor Filesystem + Share | Always produce a `.liftlog.json` file |
| FR-PLT-7 | Durable storage | `navigator.storage.persist()` | call when available (installed web apps keep their own storage) | native WebView storage | Request once after onboarding. Show backup nudges regardless. |
| FR-PLT-8 | Install prompt | `beforeinstallprompt` | none, show illustrated steps (Share → Add to Home Screen) | n/a | "Install help" screen, reachable from Settings and a one-time banner in the browser tab |
| FR-PLT-9 | Status bar colour | `theme-color` per theme | `apple-mobile-web-app-status-bar-style` + `theme-color` | Capacitor StatusBar | Matches the Paper or Iron background |
| FR-PLT-10 | Safe areas | `env(safe-area-inset-*)` | same (notch, home indicator) | same | Tab bar and bottom CTAs clear the home indicator |

Web and APK installs keep **separate data**. Moving between them means export, then import (FR-DATA-3). The install help screen says so.

---

## 3. Principles

1. **One tap when it goes to plan.** Pre-fill everything and make logging a confirmation.
2. **Coach, don't nag.** Every automated change comes with a plain-English reason, and the user can override it.
3. **Reward quality, not volume.**
4. **The phone is the database.** No account, no tracking, no network needed after the first load.
5. **Readable mid-set:** big numbers, 44 px or larger targets, bottom-reachable actions, high contrast in both themes.

---

## 4. Screen inventory

Mockups live in `design/screens/{light,dark}/` as PNG and standalone HTML.

| ID | Screen | Mockup | Notes |
|---|---|---|---|
| S01 | Onboarding 1: about you | ✓ | |
| S02 | Onboarding 2: your gym | ✓ | |
| S03 | Onboarding 3: pick a split | ✓ | |
| S04 | Routine builder + coverage | ✓ | Also reachable from the Plan tab |
| S05 | Home / Today tab | ✓ | Gear icon opens S14 |
| S06 | Active workout (today's list + goal meter) | ✓ | |
| S07 | Exercise logger: free weight | ✓ | |
| S08 | Exercise logger: machine (scanned/settings) | ✓ | Same component as S07 with a machine panel |
| S09 | Session ticket (summary) | ✓ | |
| S10 | Weekly / monthly review | ✓ | |
| S11 | Strength levels | ✓ | |
| S12 | Progress hub (Lifts / Body / History) | ✓ | |
| S13 | Library (search, filters, results) | ✓ | |
| S14 | Settings | ✓ | |
| S15 | Plan tab: rotation queue + edit routine | spec §4.1 | |
| S16 | Exercise detail (from Library) | spec §4.1 | |
| S17 | Create/edit custom exercise | spec §4.1 | |
| S18 | Session detail (history) | spec §4.1 | |
| S19 | Body stats form (sex, birth year, bodyweight) | spec §4.1 | Shown the first time S11 opens |
| S20 | Weigh-in sheet | spec §4.1 | |
| S21 | Install help | spec §4.1 | |
| S22 | QR scan + sticker sheet | spec §4.1 | |
| S23 | Swap-exercise sheet | spec §4.1 | |
| S24 | Override-target sheet | spec §4.1 | |
| S25 | Rest timer (inline + expanded) | spec §4.1 | |
| S26 | Confirmations, empty and error states | spec §4.1 | |
| V01 | Visual system reference | ✓ | Not an app screen |

### 4.1 Specs for screens without mockups

Compose these from the existing components. Keep them visually consistent with the mockups.

- **S15 Plan tab**
  - "Up next" queue: every session in order with its exercises. Drag to reorder sessions. Tap a session to open S04 for that session.
  - "Skip to…" makes any session next.
  - A week strip shows sessions done out of planned.
  - A "Change split" button re-runs S03 and keeps the history.
  - Deload week banner when one is scheduled (FR-PRG-7).
- **S16 Exercise detail**
  - Large animated illustration (or muscle-map fallback), full step-by-step instructions, and muscles worked.
  - Equipment, and whether it's in your gym.
  - Your history for this exercise: last 5 sessions, best set, e1RM chart.
  - Buttons: "Add to a session", "Swap into…".
  - Aliases shown under the name.
- **S17 Custom exercise form**
  - Fields: name (required, unique), primary muscle (required), secondary muscles, equipment or machine, load type (required), unilateral toggle, increment, notes.
  - No illustration. It uses the muscle map.
  - Validation shows inline errors.
- **S18 Session detail**
  - The ticket layout (S09) for a past session, with every set.
  - Actions: edit a set, delete a set, delete the session (with confirm).
- **S19 Body stats**
  - Sex (male / female / prefer not to say). If not given, use the lower of the two band sets and say so.
  - Birth year and bodyweight.
  - Explains why each is asked. Every field is optional. Without bodyweight, S11 shows an empty state.
- **S20 Weigh-in sheet**
  - Number stepper (0.1 kg / 0.2 lb steps), pre-filled with the last value, and date (defaults to today).
  - Saving updates the recomp check.
- **S21 Install help**
  - Detects the platform and shows 3 illustrated steps for iOS Safari or Android Chrome.
  - Explains that web and APK data are separate, and links to backup.
- **S22 QR**
  - Full-screen camera view with a viewfinder. A match opens S08 for that machine.
  - Unknown codes show "This sticker isn't from your LiftLog".
  - The sticker sheet page prints a 3×8 grid of QR codes with the machine name and a pictogram, generated from My Gym.
  - QR payload: `liftlog://machine/<machineId>`, with a web fallback URL `/m/<machineId>`.
- **S23 Swap sheet**
  - Up to 6 alternatives with the same primary muscle and pattern, filtered to My Gym, ranked compound-first, then last used.
  - Choose: "this session only" or "replace in routine".
- **S24 Override sheet**
  - Edit the weight / reps / sets target for the next exposure, with the reason shown.
  - "Reset to coach's pick" restores the engine's target.
- **S25 Rest timer**
  - Inline chip on S07 and S08 (see mockup): tap to expand to a large countdown with ±15 s buttons and Skip.
  - Default length comes from the exercise role (Settings), and runs from timestamps.
- **S26 States**
  - Every list has an empty state: one line of copy plus the next action. Examples: "No sessions yet: start your first workout"; "No results for 'xyz': create a custom exercise".
  - Destructive actions confirm in a bottom sheet that names what will be lost.
  - Storage errors show a banner with "Export backup".
  - A crash boundary shows "Something broke. Your logged sets are saved." with Reload and Export buttons.

---

## 5. Functional requirements

Priority: **M** = must (v1), **S** = should (v1 if time), **C** = could (later).

### 5.1 Onboarding (FR-ONB)
| ID | Requirement | Pri |
|---|---|---|
| FR-ONB-1 | 3-step onboarding (S01–S03) completes in under 90 s. The back button keeps the answers. | M |
| FR-ONB-2 | S01 collects experience (3 levels), goal (build muscle / get stronger / recomp / general fitness) and days per week (2–6). It shows the resulting intensity ("Coach's call") with Easier and Harder buttons. | M |
| FR-ONB-3 | S02 collects a gym preset plus individual equipment and machine toggles, optional body areas to go easy on, and units (kg/lb). | M |
| FR-ONB-4 | S03 recommends a split using `splits.json` `recommendRule`, but any split can be chosen. | M |
| FR-ONB-5 | Onboarding ends on S04 with an auto-built routine, then S05. Leaving mid-way resumes where the user stopped. | M |
| FR-ONB-6 | Sex, age and bodyweight are **not** asked in onboarding (they're deferred to S19). | M |

### 5.2 My Gym and equipment (FR-GYM)
| ID | Requirement | Pri |
|---|---|---|
| FR-GYM-1 | The gym profile stores equipment ids and machine ids (from `equipment.json` and `machines.json`). It's editable from Settings. | M |
| FR-GYM-2 | Per machine the user can store a photo (compressed to a max 800 px long edge, JPEG q≈0.8, stored as a Blob), named settings (key/value, e.g. Seat = 4) and an increment. | M |
| FR-GYM-3 | Machine photo and settings show on S08 whenever that machine's exercise is open. | M |
| FR-GYM-4 | Custom machines can be added (name, category, load type, increment). | S |
| FR-GYM-5 | Limitation areas exclude exercises that load those areas from suggestions (the mapping lives in exercise metadata). They stay searchable. | M |

### 5.3 Exercise library (FR-LIB)
| ID | Requirement | Pri |
|---|---|---|
| FR-LIB-1 | `scripts/seed.ts` builds `src/data/exercises.json` from free-exercise-db (public domain), keeping 400–600 exercises with a recognisable name and a common equipment tag. The script is deterministic and writes `SEED-REPORT.md` listing what was dropped and why. | M |
| FR-LIB-2 | Each exercise has: id, name, aliases[], primary[] and secondary[] (the 13 groups), pattern (from `splits.json`), role (compound/isolation), equipment and machineId?, loadType, increment, unilateral, instructions[], poseId?, limitationAreas[], level. | M |
| FR-LIB-3 | Search matches name and aliases, case- and punctuation-insensitive, with prefix and fuzzy matching (tolerates 1 typo). Results appear in under 100 ms. | M |
| FR-LIB-4 | Filters: in my gym (default on), muscle, equipment, level. Recently used exercises sit at the top when the search is empty. | M |
| FR-LIB-5 | Exercises not available in the user's gym show dimmed with a "Not in gym" tag. | M |
| FR-LIB-6 | Custom exercises (S17) are stored alongside seeded ones and can be edited and deleted (confirm, and history is kept). | M |
| FR-LIB-7 | Optional "Show photo" displays the dataset photos when present. Off by default, loaded lazily and cached. | C |

### 5.4 Routines and rotation (FR-RTN)
| ID | Requirement | Pri |
|---|---|---|
| FR-RTN-1 | Split templates come from `splits.json`. Auto-suggest fills each slot with the best available exercise (pattern + muscle match, in gym, not limited). Compounds come first and exercises are sized to `sessionMinutesTarget`. | M |
| FR-RTN-2 | Users can add, remove, reorder (drag and keyboard) and swap exercises per session (S04, S23). | M |
| FR-RTN-3 | Live coverage check: weekly hard sets per muscle vs the target band. Secondary muscles count 0.5 and warm-ups count 0. Groups below the band are flagged, and "+ Fix" adds the best exercise to the lightest session. | M |
| FR-RTN-4 | Sessions form a rotation queue. Home shows "Up next". Completing a session advances the queue, and the user can skip to any session. | M |
| FR-RTN-5 | The weekly target is a session count (= days per week). The week starts Monday by default (setting). | M |
| FR-RTN-6 | Changing the split archives the old routine. History, PRs and goals for shared exercises are kept. | M |

### 5.5 Workout logging (FR-WRK)
| ID | Requirement | Pri |
|---|---|---|
| FR-WRK-1 | "Start workout" creates a session from the up-next routine session, unlocks audio, and requests wake lock (FR-PLT-2). | M |
| FR-WRK-2 | S06 lists the exercises with thumbnail, target (sets × reps @ load), set dots and a bonus chip. The current exercise is highlighted. | M |
| FR-WRK-3 | Goal meter: a segmented bar with one segment per goal set, filled when a goal set is met, plus a separate gold bonus indicator. It shows `done / total goal sets`. | M |
| FR-WRK-4 | S07/S08 show the illustration and muscle map, goal card, last-session card (date, load, reps per set), the logbook and the active set. | M |
| FR-WRK-5 | The active set uses steppers for load (in exercise increments) and reps. They're pre-filled with the goal, and long-press opens a numeric keypad. "Log set N" saves in one tap. | M |
| FR-WRK-6 | After logging a set, an optional one-tap effort chip appears: Easy / Solid / Hard (default none). A "Hurts" option sits behind a "…" menu. | M |
| FR-WRK-7 | Warm-up rows are generated per `intensity.json.warmup` and marked "W". They're logged by tap and excluded from goals, volume, XP and PRs. | M |
| FR-WRK-8 | A set is a **goal set** when reps ≥ repMin and load ≥ target (for assisted: assistance ≤ target). **Bonus** = reps above repMax + load above target (converted to rep-equivalents) + up to 1 extra set per exercise. | M |
| FR-WRK-9 | In-session nudge (calibration and auto-adjust): after a set, if the step-up or step-down rule fires, show the nudge with "Use X". | M |
| FR-WRK-10 | Unplanned exercises can be added from the Library or by scanning. They're logged the same way and don't count toward the meter. | M |
| FR-WRK-11 | Past sets can be edited or deleted during and after a session. Engines recompute. | M |
| FR-WRK-12 | "Finish workout" is available at any time. Sessions with 0 work sets are discarded after a confirm. A session auto-finishes after 3 h idle. | M |
| FR-WRK-13 | Every logged set is written to IndexedDB immediately. Killing the app mid-session loses nothing, and reopening resumes the session. | M |
| FR-WRK-14 | Unilateral exercises log left and right. A goal set needs both sides. | S |
| FR-WRK-15 | Supersets / circuits | C |

### 5.6 Rest timer (FR-TMR)
| ID | Requirement | Pri |
|---|---|---|
| FR-TMR-1 | Starts automatically on logging a work set. Length comes from Settings by role (compound / isolation). | M |
| FR-TMR-2 | Computed from start timestamp + duration, so it stays correct after backgrounding or locking. | M |
| FR-TMR-3 | Controls: ±15 s, Skip. The expanded view is S25. | M |
| FR-TMR-4 | At zero: alert per FR-PLT-3/4, and the chip turns oxblood/brick until dismissed or the next set. | M |

### 5.7 Goal engine (FR-GOAL)
| ID | Requirement | Pri |
|---|---|---|
| FR-GOAL-1 | `goalFor(exercise, history, profile, settings) → {sets, repMin, repMax, load, warmups[], reason}`. It's a pure function. | M |
| FR-GOAL-2 | Sets and rep ranges come from `intensity.json` by level, goal modifier and role, with the Easier/Harder nudge applied. | M |
| FR-GOAL-3 | Loads are rounded to the exercise or machine increment and respect the load type (§6.1). | M |
| FR-GOAL-4 | No history: the first exposure is **calibration**. Load starts empty and the user enters the first set; the next sets use the step rules. Calibration sessions earn no streak or XP. | M |
| FR-GOAL-5 | The target shown on S07 always includes the reason line (e.g. "Up 2 kg: every set hit 10 last time"). | M |

### 5.8 Progression (FR-PRG)
| ID | Requirement | Pri |
|---|---|---|
| FR-PRG-1 | Evaluated after each exposure of an exercise (not weekly). | M |
| FR-PRG-2 | All sets reached repMax and the last set's effort ≠ Hard: add one increment. If that increment is more than 5% of the load, raise repMax by 2 instead (big-jump rule). | M |
| FR-PRG-3 | All sets reached repMin but not all reached repMax: hold the load and aim for +1 rep on the weakest set. | M |
| FR-PRG-4 | Any set below repMin: hold. Two consecutive misses: −10% load (rounded) and reset to repMin. | M |
| FR-PRG-5 | Assisted load type: the same logic with assistance going down. Bodyweight: progress reps, then suggest bodyweight_plus once repMax + 3 reps is reached. | M |
| FR-PRG-6 | "Hurts" freezes progression for that exercise and offers a swap. The freeze clears after one pain-free exposure. | M |
| FR-PRG-7 | Deload per `intensity.json.deload`: every N weeks (by level), or when 3 or more exercises stall at once. It's announced on Home and the Plan tab the week before. | M |
| FR-PRG-8 | Every change creates a `goalChange` record with a human reason. S10 lists next week's changes, and S24 can override any of them. | M |

### 5.9 Summaries, progress, strength (FR-SUM, FR-REV, FR-STR)
| ID | Requirement | Pri |
|---|---|---|
| FR-SUM-1 | Session ticket (S09): goal sets met / total and completion stamp, bonus reps, tonnage (with bodyweight rules), sets, reps, duration, PRs (e1RM before and after), XP gained, change vs the last same session, "Next time" preview. | M |
| FR-SUM-2 | The ticket can be shared as a PNG image (rendered client-side) through the share sheet. | S |
| FR-REV-1 | Weekly review (S10), available from Monday for the previous week: sessions done/planned, goal-set %, PRs, one "Going well" and one "Needs work" insight (rules in §6.7) with a one-tap fix, and next week's changes with reasons. | M |
| FR-REV-2 | Monthly review: the same structure over the calendar month, plus a per-muscle hard-sets trend. | M |
| FR-REV-3 | Recomp check: bodyweight trend and average e1RM trend as two single-series sparklines (never a dual axis). Status rules are in §6.8. | M |
| FR-STR-1 | Strength levels (S11) come from benchmark lifts in `standards.json` only. Each shows the current band, a marker position within it, the next milestone (load) and an ETA from the recent e1RM slope. | M |
| FR-STR-2 | Muscle groups trained only on machines show the `machineOnlyMessage` plus the benchmark that would unlock them. | M |
| FR-STR-3 | If body stats are missing, S19 opens first. Copy always includes "General guidelines, not medical advice". | M |
| FR-PRO-1 | Progress hub (S12): Lifts (pick an exercise; e1RM line chart; table view), Body (weigh-ins chart; list), History (session list → S18), and PR list. | M |

### 5.10 Motivation (FR-XP)
| ID | Requirement | Pri |
|---|---|---|
| FR-XP-1 | XP events, values, caps and exclusions come from `xp.json`. XP is computed from the log (derived, not stored as a running total) so edits stay consistent. | M |
| FR-XP-2 | Levels and titles come from the `xp.json` formula. The level shows on Home and the ticket. | M |
| FR-XP-3 | PR = a new best e1RM for an exercise from a work set with reps ≥ repMin. PR stamp animation on the set row and the ticket. Warm-ups never count. | M |
| FR-XP-4 | Weekly streak per `xp.json.streak`, including a rest-week pass every 8 weeks (applied automatically, and shown). | M |
| FR-XP-5 | Milestones (tonnage with fun equivalents, session counts, first bodyweight pull-up) show a one-time card on the ticket. | S |
| FR-XP-6 | One weekly quest generated from weak spots, shown on Home, completed automatically. | S |

### 5.11 Settings and data (FR-SET, FR-DATA)
| ID | Requirement | Pri |
|---|---|---|
| FR-SET-1 | Theme: System / Paper / Iron (default System). Applies instantly and persists. | M |
| FR-SET-2 | Units kg/lb. Stored internally in kg. Display rounding respects the unit's increments. Switching doesn't alter history. | M |
| FR-SET-3 | Rest defaults (compound / isolation), warm-ups on/off, rest alert on/off, week start day. | M |
| FR-SET-4 | Profile, My Gym and Body stats editing. Profile changes regenerate future goals and never rewrite history. | M |
| FR-DATA-1 | "Back up now" exports every table (including machine photos as base64) to `liftlog-YYYY-MM-DD.liftlog.json` with a schema version. | M |
| FR-DATA-2 | Backup nudge on Home after 7 days without a backup, and after every 10th session. Dismissible. | M |
| FR-DATA-3 | "Restore from backup" validates the file (schema version, zod), shows a preview (sessions, date range), then replaces or merges. It's migration-aware for older schema versions. | M |
| FR-DATA-4 | "Delete all data" needs a typed confirmation ("DELETE"), then clears the DB and returns to onboarding. | M |
| FR-DATA-5 | Optional CSV export of sets (date, exercise, set, load, reps, effort) for spreadsheets. | S |

### 5.12 Illustrations and theme (FR-ILL, FR-THM)
| ID | Requirement | Pri |
|---|---|---|
| FR-ILL-1 | Port `design/illustrations/pictos.py` to TypeScript React components with identical geometry: `<Pictogram poseId variant="full|thumb" animate?>` and `<MuscleMap primary secondary>`. | M |
| FR-ILL-2 | The 10 poses in `pictos.py` ship in M1. Tier 2 adds about 120 common exercises (pose data authored in `src/data/poses.json`, plus equipment parts) in M3, reviewed in a `/dev/poses` gallery route (dev builds only). | M |
| FR-ILL-3 | Exercises without a pose show the muscle-map fallback plus an equipment label (see S13). | M |
| FR-ILL-4 | Animation interpolates start → end joint angles on a 1.6 s ease-in-out loop on S07/S16 only. It's disabled with `prefers-reduced-motion`. | S |
| FR-THM-1 | All colours come from CSS variables in `design/tokens.css`. No hex values in components. Illustration colours use the same variables. | M |

---

## 6. Engine specifications

All engines live in `src/engine/`. They're pure TypeScript with no React or Dexie imports, and are 100% unit-tested.

### 6.1 Load handling
Load types, increments and volume rules are in `data/load-types.json`.
- **Dumbbell:** the logged load is per hand, and volume = load × 2 × reps.
- **Bodyweight:** volume uses the latest bodyweight on or before the session date. If none is recorded, volume is excluded and flagged.
- **Assisted:** volume = (bodyweight − assistance) × reps.

### 6.2 e1RM
Epley: `load × (1 + reps/30)`, only for work sets with reps ≤ 12. Assisted exercises use effective load; bodyweight exercises use bodyweight (+ added).

### 6.3 Goal generation
Covered in FR-GOAL. The reason text is templated from the rule that fired, e.g.:
- "First time: find your weight"
- "Up 2 kg: every set hit 10"
- "Same weight: aim for 9 reps on set 3"
- "Down 10%: two tough sessions in a row"
- "Deload week: 60% of your usual sets"

### 6.4 Calibration and in-session nudges
From `intensity.json.calibration`:
- **Step up** when reps ≥ repMax + 2, or effort = Easy with reps ≥ repMax.
- **Step down** when reps < repMin.
- The step is one increment. Never nudge on the last set.

### 6.5 Coverage
Weekly hard sets per muscle = Σ over routine sessions of (primary: sets × 1; secondary: sets × 0.5). This is compared to `weeklyHardSetsPerMuscle` for the level and goal.

### 6.6 Strength levels
- Ratio = best recent e1RM (last 8 weeks) / bodyweight. Pull-ups use reps.
- Thresholds = `standards.json` values by sex × `ageAdjust`.
- The marker is placed within its band linearly.
- ETA = (next threshold − current) / weekly e1RM slope (linear regression over the last 6 weeks). Shown only if the slope is > 0, as "~N weeks" (or "~N months" if more than 12 weeks). Otherwise: "Keep logging to see an estimate".

### 6.7 Insights (rule-based)
Evaluated in order. Take the first match for each of "Going well" and "Needs work".
- **Going well:**
  1. e1RM up ≥ 5% on a benchmark in 4 weeks.
  2. All planned sessions done.
  3. Goal-set rate ≥ 90%.
  4. New PRs ≥ 2.
- **Needs work:**
  1. A muscle below 60% of its weekly target → fix: add an exercise.
  2. An exercise stalled for 3 exposures → fix: swap.
  3. Sessions missed ≥ 2 → fix: lower days per week.
  4. Hurts flags → fix: swap.

### 6.8 Recomp check
Uses the last 6 weeks.
- **Recomp / build-muscle goal:** "On track" when e1RM slope > 0 and bodyweight change is within ±1%/week (recomp) or +0.25–0.5%/week (build muscle). Otherwise "Watch" with one line of explanation.
- **Get-stronger goal:** only strength matters.
- **General fitness:** consistency only.
- Needs at least 3 weigh-ins, or it shows an empty state.

### 6.9 XP, levels, streaks
Covered in `xp.json` and FR-XP.

---

## 7. Data model (Dexie, `src/db/`)

Schema version 1. Every future change adds a new `db.version(n)` with an upgrade function and a migration test (NFR-REL-3).

| Table | Key and indexes | Fields |
|---|---|---|
| `meta` | `key` | schemaVersion, installedAt, lastBackupAt, onboardingStep |
| `profile` | `id` (singleton) | experience, goal, daysPerWeek, nudge, units, sex?, birthYear?, limitations[] |
| `bodyweights` | `++id, date` | date, kg |
| `gym` | `id` (singleton) | presetId, equipmentIds[], machineIds[] |
| `machineNotes` | `machineId` | photoBlob?, settings{}, incrementKg?, customName? |
| `exercises` | `id, name, *aliases, primary, isCustom` | see FR-LIB-2 |
| `routines` | `id, active` | splitId, createdAt, archivedAt?, sessions[{id, name, items[{exerciseId, order}]}] |
| `queue` | `id` (singleton) | routineId, nextSessionIndex |
| `sessions` | `id, startedAt, routineSessionId` | startedAt, endedAt?, calibration, deload, notes? |
| `sets` | `id, sessionId, exerciseId, [exerciseId+loggedAt]` | idx, kind (warmup/work/extra), loadKg, reps, side?, effort?, hurts, goalMet, bonusReps, loggedAt |
| `goals` | `exerciseId` | sets, repMin, repMax, loadKg, reason, frozen, missStreak, updatedAt |
| `goalChanges` | `++id, exerciseId, at` | from, to, reason, at, overridden |
| `prs` | `++id, exerciseId, at` | e1rm, loadKg, reps, setId |
| `settings` | `key` | theme, restCompoundSec, restIsolationSec, warmups, restAlert, weekStart |
| `errors` | `++id, at` | message, stack, route (local-only error log, capped at 200 entries) |

Derived values (XP, streak, tonnage, coverage) are computed from these tables with memoised selectors, never stored as running totals.

---

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-PERF-1 | Cold start to interactive in under 2.0 s on a mid-range Android (e.g. Pixel 6a) from the installed PWA. Warm start under 1.0 s. |
| NFR-PERF-2 | Logging a set: UI feedback in under 100 ms, persisted in under 300 ms. |
| NFR-PERF-3 | Initial JS under 250 KB gzipped. The library data, pose data, charts and QR decoder are lazy-loaded. |
| NFR-PERF-4 | Library search returns in under 100 ms for 600 exercises. |
| NFR-OFF-1 | 100% of features work offline after first load. Only the first install and app updates need a network. |
| NFR-OFF-2 | Service worker updates show a "New version: reload" toast and never reload mid-session. |
| NFR-REL-1 | No data loss if the app is killed at any point (FR-WRK-13). Writes are transactional per set. |
| NFR-REL-2 | A backup round-trip (export → delete → import) restores byte-equal data, excluding ids where the schema says otherwise. |
| NFR-REL-3 | Every schema migration has a test that loads a fixture of the previous version and verifies the upgrade. |
| NFR-REL-4 | An error boundary on every route. Errors are logged locally to `errors` and never sent anywhere. |
| NFR-A11Y-1 | WCAG 2.2 AA in both themes: 4.5:1 text contrast, 3:1 UI component contrast, 44 × 44 px targets, visible focus rings. |
| NFR-A11Y-2 | Screen-reader labels on every icon button, the meter, steppers ("Load, 26 kilograms per hand, increase") and charts (with a table view). |
| NFR-A11Y-3 | Respects `prefers-reduced-motion` and system text size up to 200% without clipping primary actions. |
| NFR-SEC-1 | No backend, no analytics, no third-party requests at runtime (fonts are self-hosted). Strict CSP: `default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'`. |
| NFR-SEC-2 | Backup files contain no secrets. Import validates schema and size (≤ 50 MB) before touching the DB. |
| NFR-PRIV-1 | All data stays on the device. Health-adjacent data (bodyweight, pain flags) is never transmitted. The privacy note in Settings says so. |
| NFR-COMP-1 | Meets the support matrix in §2.1. Playwright e2e runs on emulated Pixel 7 (Chromium) and iPhone 14 (WebKit). |
| NFR-UX-1 | One-handed use: primary actions in the bottom 40% of the screen. No hover-only affordances. |
| NFR-UX-2 | Copy is plain English and sentence case in body text. Uppercase is reserved for display and label styles. |
| NFR-I18N-1 | English only in v1. All strings live in `src/copy/en.ts`, ready for translation. Numbers and dates are formatted with `Intl`. |
| NFR-MAINT-1 | TypeScript strict, ESLint + Prettier, no `any` in `src/engine`. At least 90% line coverage in `src/engine`, 70% overall. |
| NFR-MAINT-2 | Tunable numbers live in `data/*.json` (copied into `src/data/`), not in code. |
| NFR-SIZE-1 | APK under 15 MB. PWA precache under 5 MB (exercise photos are not precached). |
| NFR-LIC-1 | free-exercise-db is public domain (Unlicense). Fonts are OFL. Record every third-party licence in `LICENSES.md`. |

---

## 9. Design system

- **Tokens:** `design/tokens.json` and `design/tokens.css` (Paper = light, Iron = dark). Map Tailwind colours to the CSS variables. Never use hex in components.
- **Type:**
  - Big Shoulders Display 800/900 (display, uppercase)
  - Instrument Sans 400–700 (body)
  - IBM Plex Mono 500/600 (labels, logbook numbers)
  - Self-host all three via `@fontsource`.
- **Core components** (each with a Storybook-free visual test page at `/dev/components` in dev builds):
  - Button (primary / secondary / ghost / destructive), Card, Chip (plain / on / brass / red / soft), SegmentedControl, ToggleChip, Switch, Stepper, SetRow (logbook), SetDots, GoalMeter, Stamp, Ticket, TabBar, Sheet (bottom sheet), Toast, EmptyState, Pictogram, MuscleMap, Sparkline, LineChart (single series + table), StatTile.
- **Motifs:**
  - Hard offset shadow only on the single most important element per screen.
  - Stamps for PRs and completion.
  - Ticket for the session summary.
  - Ruled logbook rows.
- **Motion:** 150–220 ms ease-out for state changes. The stamp animation is 400 ms (scale 1.4 → 1 with −12° rotation). None when reduced motion is on.

---

## 10. Illustration system

See `design/illustrations/`:
- `pictos.py`: the reference implementation
- `light/`, `dark/`: SVG exports for the full illustration, thumbnail and muscle map of each of the 10 exercises
- `poses-readme.json`: rig constants

Rules:
- Side view, figure faces right.
- Ghost = start, solid = finish, red dotted arrow = the path of the weight.
- The near arm has a halo in the panel colour.
- Equipment is built from shared parts.
- Pose data is JSON, so poses can be animated and extended without an artist.

---

## 11. Technical architecture

- **Stack:**
  - React 19 + Vite + TypeScript (strict)
  - React Router (data router)
  - Dexie + `dexie-react-hooks` for live queries
  - Zustand only for ephemeral session UI state
  - Tailwind CSS v4 with token variables
  - zod for backup validation
  - Recharts, or hand-rolled SVG for the 2 chart types (prefer SVG for bundle size)
  - `vite-plugin-pwa` (injectManifest, Workbox)
  - Vitest + Testing Library, Playwright
  - Capacitor (latest stable) for Android
- **Build targets:**
  - `npm run build` → PWA for Vercel.
  - `npm run build:native` → the same app with `VITE_NATIVE=1` (disables the service worker and uses Capacitor plugins through a `platform/` adapter).
- **Platform adapter:** `src/platform/` exposes `keepAwake()`, `alert()`, `share(file)`, `scan()`, `persist()`, `statusBar(theme)`. It has a web implementation and a Capacitor implementation, and feature code never touches `navigator` or Capacitor directly.
- **Folder layout:**
```
src/
  app/        routes, layout, error boundaries
  screens/    S01..S26 (one folder per screen)
  components/ design-system components
  engine/     goal, progression, calibration, coverage, e1rm, strength, insights, xp, streak (pure + tests)
  db/         dexie schema, migrations, repositories, backup
  data/       copied from /data plus exercises.json, poses.json
  illustration/ Pictogram, MuscleMap, rig, parts
  platform/   web + native adapters
  copy/       en.ts
  styles/     tokens.css, fonts
scripts/      seed.ts, copy-data.ts
e2e/          playwright specs
```
- **Routing:** `/onboarding/*`, `/` (Home), `/workout`, `/workout/:exerciseId`, `/summary/:sessionId`, `/plan`, `/library`, `/library/:exerciseId`, `/progress/*`, `/settings/*`, `/install`, `/scan`, `/m/:machineId`, `/dev/*` (dev only). Vercel needs an SPA rewrite to `index.html`.
- **Hosting:** Vercel (static). The `vercel.json` includes the SPA rewrite and long-cache headers for hashed assets, with `no-cache` on `index.html` and `sw.js`.

---

## 12. Milestones

Every milestone ends deployable, with passing CI and an updated `CHANGELOG.md`. Claude Code stops after each one and reports (see `docs/PROMPTS.md`).

| # | Scope | Exit criteria |
|---|---|---|
| **M0 Foundation** | Repo, tooling, CI (`ci/ci.yml`), tokens + fonts + theme switching, platform adapter stubs, Dexie schema v1, error boundary, Vercel deploy, PWA install shell, `/dev/components` with Button, Card, Chip, Stepper | Installs on an iPhone and an Android phone from the Vercel URL; Paper/Iron switch works offline |
| **M1 Log a workout** | Seed script + library data, S01–S03 minimal (gym defaults to full gym), manual routine builder (S04 without coverage), rotation queue, S05, S06, S07/S08, steppers, effort, warm-ups, rest timer (FR-TMR), Tier 1 pictograms + muscle map, S09 basic, backup export/import | Onboard and log a real workout in under 3 min; kill the app mid-session and resume; backup round-trip passes |
| **M2 Coach** | Goal engine, calibration, nudges, split templates + auto-suggest, coverage check + Fix, swap sheet, My Gym (photos, settings), S02 complete, limitations | Goal reasons shown; engine tests ≥ 90% coverage |
| **M3 Progression** | Progression engine, goalChanges, override sheet, deload, bonus tracking, Tier 2 poses + `/dev/poses`, pose animation, S16, S17 | Every §5.8 rule has a test; 120+ poses reviewed |
| **M4 Insight** | S10 weekly/monthly, insights, recomp check, weigh-ins (S20), S11 + S19, S12 + S18, charts with table views | Reviews generate correctly from fixture data |
| **M5 Motivation + polish** | XP, levels, stamps, streaks, milestones, quests, share ticket image, QR scan + sticker sheet (S22), backup nudges, install help (S21), empty and error states, a11y pass, performance budget | Lighthouse PWA/a11y/perf ≥ 90 on mobile; axe clean |
| **M6 Android APK + release** | Capacitor Android project, native adapter (keep awake, local notifications for rest end, haptics, share, status bar), `ci/android-apk.yml`, app icon + splash in Paper/Iron, version 1.0.0 | Signed or debug APK installs on a Pixel; lock-screen rest alert fires; data export → import from web works |

---

## 13. Testing strategy

- **Unit (Vitest):** every engine function, including edge cases:
  - assisted, bodyweight, dumbbell volume
  - big-jump rule
  - two-miss drop
  - deload trigger
  - calibration steps
  - XP caps
  - streak rest pass
  - strength band placement and ETA
  - kg/lb rounding
- **Component (Testing Library):** Stepper, GoalMeter, SetRow, SegmentedControl, the theme switch.
- **E2E (Playwright, Pixel 7 + iPhone 14 emulation, both themes):**
  1. onboarding → first set
  2. full session → ticket
  3. offline session (context offline)
  4. kill/reload mid-session resume
  5. backup export → delete → import
  6. swap exercise
  7. progression after two sessions
- **Accessibility:** `@axe-core/playwright` on every route in both themes.
- **Lighthouse CI** on the Vercel preview: PWA, performance, accessibility and best practices, each ≥ 90.
- **Manual device matrix** (Pranav): iPhone (latest iOS, Safari install), Pixel 8 Pro (Chrome install and APK). Checklist per milestone in `docs/PROMPTS.md`.

---

## 14. Out of scope (v1)

Accounts, cloud sync, social features and leaderboards, supersets and circuits, nutrition, AI-generated coaching, Apple Watch / Wear OS, an iOS App Store build, localisation beyond English.

---

## 15. Traceability

| Area | Requirements | Milestone | Screens | Verified by |
|---|---|---|---|---|
| Platform | FR-PLT-1…10 | M0, M5, M6 | all, S21 | e2e offline; manual device matrix |
| Onboarding | FR-ONB-1…6 | M1, M2 | S01–S03 | e2e #1 |
| Gym | FR-GYM-1…5 | M2 | S02, S08, S14 | unit (filters), e2e |
| Library | FR-LIB-1…7 | M1, M3 | S13, S16, S17 | unit (search), seed report |
| Routine | FR-RTN-1…6 | M1, M2 | S04, S05, S15, S23 | unit (coverage, suggest), e2e #6 |
| Workout | FR-WRK-1…15 | M1 | S06–S08, S25 | e2e #2, #4 |
| Timer | FR-TMR-1…4 | M1, M6 | S25 | unit (timestamp math), manual |
| Goals | FR-GOAL-1…5 | M2 | S07 | unit |
| Progression | FR-PRG-1…8 | M3 | S10, S15, S24 | unit, e2e #7 |
| Summaries | FR-SUM, FR-REV, FR-STR, FR-PRO | M1, M4 | S09–S12, S18–S20 | unit (insights, recomp, strength), fixtures |
| Motivation | FR-XP-1…6 | M5 | S05, S09 | unit |
| Settings/data | FR-SET-1…4, FR-DATA-1…5 | M0, M1, M5 | S14 | e2e #5 |
| Illustration/theme | FR-ILL-1…4, FR-THM-1 | M0, M1, M3 | S07, S13, S16 | visual check at `/dev/poses`, `/dev/components` |
| Non-functional | NFR-* | all | all | Lighthouse CI, axe, coverage gates, migration tests |

---

## Appendix A: why the design is the way it is (review findings)

- **Rotation, not dates:** missing a day shouldn't break the week.
- **Per-exposure progression with effort taps:** faster and more accurate than weekly batches.
- **Load types and per-exercise increments:** dumbbells per hand, machine stacks, assisted machines.
- **Calibration instead of guessed starting weights:** machine loads vary by brand.
- **Goal sets and e1RM as headline metrics:** tonnage is a fun stat only. XP rewards quality.
- **Strength levels from free-weight benchmarks only:** framed as the next milestone, never "Behind".
- **My Gym photos and settings before QR stickers:** stickers get removed.
- **3-step onboarding:** body stats are deferred until they're needed.
- **Steppers instead of the keyboard, wake lock, timestamp timers:** built for the gym floor.
- **Paper & Iron visual system:** own pictogram illustrations instead of inconsistent stock photos.
