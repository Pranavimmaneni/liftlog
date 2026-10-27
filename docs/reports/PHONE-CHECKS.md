# Phone checks

Checks from `docs/PROMPTS.md`. ✅ = covered by Playwright e2e (Pixel 7 Chromium + iPhone 14 WebKit emulation, Paper + Iron). 📱 = needs a real phone.

## M0
| # | Check | Automated? |
|---|---|---|
| 1 | Pixel: open the URL in Chrome → "Install app" → opens full-screen with the LL icon | Partly ✅: manifest is valid and installable (name, standalone, 192/512 + maskable icons all load). 📱 The install flow and icon on the home screen |
| 2 | iPhone: Safari → Share → Add to Home Screen → opens without Safari bars | 📱 (apple-touch-icon and `apple-mobile-web-app-capable` are in place) |
| 3 | Phone dark mode on/off → app follows. Force Paper and Iron in `/dev/components` | ✅ System follows the emulated colour scheme; forcing Paper/Iron applies instantly and survives reload |
| 4 | Airplane mode, close and reopen → still loads | ✅ on Chromium (real offline). WebKit: precache verified (Playwright limitation, DECISIONS D34). 📱 Do it once on the iPhone |

URL: https://liftlog-jade.vercel.app · components page: https://liftlog-jade.vercel.app/dev/components

## M1
| # | Check | Automated? |
|---|---|---|
| 1 | Fresh install: onboard and log the first set in under 3 minutes | ✅ e2e #1 on all 4 projects (well under 3 min). 📱 Time yourself once |
| 2 | Log a whole real workout: meter fills, rest timer counts down, ticket shows totals | ✅ e2e #2 (every set, meter full, ticket, rotation advances). 📱 The rest alert sound/vibration at zero |
| 3 | Swipe the app away mid-exercise and reopen: back in the session, sets intact | ✅ e2e #4 (page closed and reopened on the same storage). 📱 Real swipe-away on both phones |
| 4 | Back up, delete the app, reinstall, restore | ✅ e2e #5 (export → typed DELETE → restore → data back). 📱 The share sheet / Files save on iOS and the real reinstall |
| 5 | Dumbbell exercises say "kg / hand" | ✅ unit + e2e |

## M2
| # | Check | Automated? |
|---|---|---|
| 1 | Pick a new split: the suggested routine only uses ticked equipment | ✅ e2e (Home DBs preset → no barbell/machine/cable) + unit tests for every preset and limitation |
| 2 | Coverage flags a missing muscle and "+ Fix" adds something sensible | ✅ e2e + integration test. 📱 Judge whether the picks feel sensible to you |
| 3 | Easy first set on a new exercise → heavier second set suggested | ✅ e2e ("Set 1 was easy… Use 25") |
| 4 | Machine photo + seat settings show next time | ✅ e2e with a file upload, survives reload. 📱 Take a real photo with the camera on both phones |

## M3
| # | Check | Automated? |
|---|---|---|
| 1 | Repeat a session where you hit every rep → next time the weight goes up, with a reason | ✅ e2e #7 on all 4 projects ("Up 2.5 kg: every set hit 10", new target on the goal card) |
| 2 | Miss reps twice in a row → weight drops 10% with a reason | ✅ e2e ("Down 10%: two tough sessions in a row") + unit tests for every §5.8 rule |
| 3 | Override a target → it sticks; "Reset to coach's pick" undoes it | ✅ e2e (survives reload, axe clean) + screen test |
| 4 | Look through the pose gallery and note any pose that looks wrong | Partly ✅: every pose stays in frame through the whole movement (unit test); contact sheets in docs/reports/poses/. 📱 Your judgement at /dev/poses |
| 5 | "Log set" feels instant on the iPhone (NFR-PERF-2) | 📱 Chromium ~17 ms; Playwright WebKit on Windows ~250 ms (D58) |

## M4
| # | Check | Automated? |
|---|---|---|
| 1 | Weekly review shows one "Going well" and one "Needs work" that match what you did | ✅ e2e on the 6-week fixture (both insights, recomp, next week, monthly muscle trend, axe clean) + unit tests for every §6.7 rule. 📱 Judge whether they match your real week |
| 2 | Log 3 weigh-ins → the recomp check appears | ✅ e2e (empty state → On track/Watch after the third) + unit tests for every §6.8 goal |
| 3 | Strength levels ask for body stats once, then show your next milestone | ✅ e2e (S19 first, "Guideline values", "Next: …", not asked again after reload) |
| 4 | History lists past sessions and you can edit a set there | ✅ e2e (History → S18 → edit set) + screen test for delete session |

## M5
| # | Check | Automated? |
|---|---|---|
| 1 | Finish a session: ticket shows level + XP; Share gives a PNG | ✅ e2e (level card, +XP, milestone card, downloaded file is a real PNG). 📱 The share sheet on each phone |
| 2 | Print stickers, scan one on a machine (iPhone uses the WASM fallback) | Partly ✅: sticker sheet renders a QR per machine, `/m/<id>` opens the logger/detail, unit tests for payload parsing. 📱 Real camera scan on both phones and a print |
| 3 | Install from the install-help steps | ✅ screen renders both platforms' steps; manifest installable (M0). 📱 The install itself |
| 4 | Every screen readable in both themes | ✅ axe sweep of 21 views × Paper/Iron × Pixel/iPhone |

## M6
| # | Check | Automated? |
|---|---|---|
| 1 | Run the "Android APK" workflow, download the APK, install on the Pixel | Partly ✅: workflow in place (debug + signed release), native bundle smoke test passes. 📱 Needs the repo on GitHub, then the install itself |
| 2 | Start a rest timer, lock the phone → notification at rest end | Partly ✅: unit tests for schedule/cancel/permission with mocked plugins. 📱 The real notification |
| 3 | Export from the web app, import into the APK → history appears | ✅ backup/restore round-trip is e2e #5 (same code in the APK). 📱 The cross-install move |

## M7 (1.1.1)
| # | Check | Automated? |
|---|---|---|
| 1 | On a dumbbell exercise, tap the weight and type 22.5, then 122.5. Every digit shows while typing and after | ✅ e2e on all 4 projects (field width ≥ text, value in the box). 📱 The phone keypad (decimal key, comma locales) |
| 2 | Start a workout, tap Undo within 10 s: back on Home, Up next unchanged | ✅ e2e + screen test. 📱 Once on each phone |
| 3 | Start a workout, log one set, Cancel workout: the sheet says "1 logged set"; the workout isn't in History | ✅ screen test + unit test (sets, queue, PRs). 📱 Once |
| 4 | During a workout, Add from list → search for something your gym lacks: it shows under "Not in your gym". Search nonsense → Create custom exercise → save → it opens in the workout | ✅ screen tests. 📱 With your real gym settings |
| 5 | The tab bar shows Today, Plan, Progress; the Library opens from Plan (book icon or button) and Settings | ✅ e2e + screen test |

## M10 (food data; needs a preview deploy of `m10-food-data`)
| # | Check | Automated? |
|---|---|---|
| 1 | Open `/dev/food`, tap "Import library now": the count reaches about 23,000 foods | ✅ e2e on all 4 projects. 📱 Time it on the iPhone and the Pixel |
| 2 | Search "paneer", "dal tadka", "kirkland", "great value oats": results show at once; the timing line says under 150 ms | ✅ unit speed test (30,000 rows) + e2e. 📱 The real timing on both phones |
| 3 | Airplane mode, reopen `/dev/food`, search again: results still show | ✅ e2e on Chromium. 📱 Once on the iPhone |
| 4 | The sample targets show kcal 2950, P 140, C 440, F 70 (same as the F05 mockup) | ✅ unit + e2e |
