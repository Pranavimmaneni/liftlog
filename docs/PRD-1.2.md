# LiftLog: PRD addendum for 1.1.1 – 1.3.0

This addendum adds to `docs/PRD.md` (v3). The PRD rules (priorities, IDs, traceability) apply here too. Where this addendum changes the PRD, it says so, and `DECISIONS.md` records why.

## Releases

| Release | Scope | Milestones |
|---|---|---|
| 1.1.1 | Fixes from real use | M7 |
| 1.1.2 | Bigger library, a pictogram for every exercise | M8 |
| 1.2.0 | Game-style redesign, food tracking, combined food + training feedback | M9–M13 (draft IDs below, waiting on Pranav's answers) |
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

## 1.2.0 draft requirements (not approved yet)

Sources: Pranav's food brief (above) and a data-source check on 2026-10-26 (USDA FoodData Central is public domain, CC0; Open Food Facts is ODbL share-alike, so it stays out).

### Food library (FR-FOOD)
| ID | Requirement | Pri |
|---|---|---|
| FR-FOOD-1 | `scripts/seed-foods.ts` builds the food library deterministically and writes `FOOD-SEED-REPORT.md`. Generic foods: USDA FNDDS 2021–23 (5,432 "as eaten" foods, 65 nutrients, household portions like "1 cup"). Branded foods: a subset of USDA Branded Foods (about 15–25k products) from store brands (Kirkland Signature, Member's Mark, Great Value, Trader Joe's, Good & Gather, Kroger, 365, Aldi) and the biggest national brands, latest record per barcode, nothing older than 2020. Branded foods carry label nutrients only; other micros show "not on label". | M |
| FR-FOOD-2 | The library (about 2 MB compressed) downloads once from LiftLog's own site on first use of Food, is stored in IndexedDB and then works offline. It isn't precached (NFR-SIZE-1). | M |
| FR-FOOD-3 | Search by name, brand and alias, with the same typo tolerance as exercises, in under 150 ms over the whole library. Recent, frequent and favourite foods come first. | M |
| FR-FOOD-4 | Offline barcode scanning (UPC/EAN) against the library, using the scanner LiftLog already has. A miss offers "Create food" with the barcode filled in. | S |
| FR-FOOD-5 | Custom foods, recipes (ingredients plus number of servings) and quick add (calories and macros only). | M |

### Diary (FR-DIARY)
| ID | Requirement | Pri |
|---|---|---|
| FR-DIARY-1 | Food tab: a day view by meal (Breakfast, Lunch, Dinner, Snacks), each entry with a time (default now) so meals can be matched to workouts. | M |
| FR-DIARY-2 | Portions in household measures, grams or ounces, with a servings stepper. Every entry is saved the moment it's logged. | M |
| FR-DIARY-3 | Fast logging: copy a meal or a whole day, saved meals, log again from recent. | M |
| FR-DIARY-4 | Water tracking with a daily target. | S |

### Targets (FR-TGT)
| ID | Requirement | Pri |
|---|---|---|
| FR-TGT-1 | Inputs: bodyweight (the shared weigh-ins), height, sex, birth year, activity level and a diet phase (lose / maintain / gain, with a weekly rate). | M |
| FR-TGT-2 | Energy target: Mifflin-St Jeor × activity factor, adjusted for the phase. All constants in `data/nutrition.json`. | M |
| FR-TGT-3 | Macros: protein in g per kg by goal and phase (ISSN range), a fat floor, carbs fill the rest; fibre per 1,000 kcal. | M |
| FR-TGT-4 | Micros from the US Dietary Reference Intakes by age and sex (RDA or AI), with upper limits flagged. | M |
| FR-TGT-5 | Adaptive expenditure: after 3 weeks of logging and weigh-ins, estimate real daily energy use from intake vs the weight trend and offer the new target with the reason. | S |
| FR-TGT-6 | Optional higher carbs on training days. Any target can be overridden; "Reset to coach's pick" restores it. | S |

### Reviews and combined coach (FR-NUT, FR-COACH)
| ID | Requirement | Pri |
|---|---|---|
| FR-NUT-1 | Today: calories left, macro bars, micros as % of target. | M |
| FR-NUT-2 | Weekly and monthly food review: averages, days on target, macro and micro adequacy, top food sources per nutrient, trends. | M |
| FR-COACH-1 | Rule-based combined insights, e.g. protein below target on training days; under 30 g carbs in the 3 h before a workout; a gain phase with flat weight; losing more than 1%/week while e1RM drops; a micro under 70% for the week, with foods from the user's own diary or the library that are rich in it. | M |
| FR-COACH-2 | S10 gets a Food section; "Going well" and "Needs work" draw on both sides, each with a reason and a one-tap fix. | M |
| FR-GAME-1 | Food counts toward XP, streaks and quests only for hitting targets (in range, not "more"), e.g. "Hit protein 5 of 7 days". | S |

### Shared (FR-SHR)
| ID | Requirement | Pri |
|---|---|---|
| FR-SHR-1 | One bodyweight log, one body stats form (now with height and activity) and one goal feed both sides. | M |
| FR-SHR-2 | Backup, restore and CSV export include the food tables (schema version 2 with a migration test). | M |

### Milestones (draft)
| Milestone | Scope |
|---|---|
| M9 Design | Game-style mockups for training and food screens, Paper and Iron |
| M10 Food data and engines | Seed script, schema v2, target and review engines with tests |
| M11 Food UI | Food tab, diary, search, barcode, recipes, water |
| M12 Combined coach | Food reviews, combined insights, food in XP and quests |
| M13 Redesign | The approved mockups on the training screens |

Not possible without a server: scheduled meal reminders (a web app can't fire them while closed), and live product lookups for barcodes outside the library.

