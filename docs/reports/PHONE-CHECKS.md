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
