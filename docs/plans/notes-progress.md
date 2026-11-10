# Notes from the Progress area (M16, FR-DSN-10)

Date: 2026-11-10. Screens: S09, S10, S11, S12, S18, S19, S20 and `Chart.tsx`. For the lead to move into `DECISIONS.md`.

## Needs a change in a shared file

1. **The `LiftLog | Food` switch shows neither side selected on Progress (and any screen that is not `/`).** `src/components/SectionSwitch.tsx` passes `aria-current` to `NavLink`, but `NavLink` sets `aria-current` itself from the route match, so on `/progress` the LiftLog item has no `aria-current`. The Rising Sun CSS fills the selected item from `[aria-current='page']`, and its unlayered `background: transparent` beats the `bg-ink` class, so nothing is filled. Suggested fix: use a plain `Link` there, or style the selected item from a `data-on` attribute.

## Decisions

| # | Gap | Decision | Why |
|---|---|---|---|
| 1 | S12 mockup has no Lifts / Body / History control | Three pills under the section switch (`role="group"`, `aria-pressed`) | The brief keeps the three views; a second segmented control under the section switch looked like a duplicate of it. Same pills as Week / Month on the S10 mockup |
| 2 | S12 mockup change line reads "+7.0 kg in 7 weeks"; classic shows a percentage | New look shows the kg change between the first and last chart point over the same weeks | Pranav reviewed this mockup. Classic is unchanged |
| 3 | S12 mockup list has four rows; classic also has "This week" and "Strength" tiles and the full record list | List rows: Body weight (opens Body), Level and XP, Streak (sub-line "n of m sessions this week", opens the review), Strength level (opens S11), Records (latest record; tap expands the ten most recent) | Every classic feature stays reachable (handoff §8.1) |
| 4 | Body weight row change figure | Latest weigh-in minus the one before | The mockup number is sample data; this is the simplest honest reading |
| 5 | Chart in the new look | Accent line, ink dot per point, accent dot on the latest, date labels, no grid or y-axis; table view kept. Body view gets its own hero number (latest weigh-in) since the chart no longer labels the last value | Mockup HW1S12 |
| 6 | S09 mockup lists the lifts; classic does not. Classic has sets, reps, bonus reps, "vs last", records, next time, level, milestones | New look: hero (goal sets hit, time / lifted / XP tiles, ticket number), lifts with their sets (three, then "n more lifts"), a details list, then next time, level and milestones on glass. Records show under their lift as "New record · Est. 1-rep max …" | Mockup plus handoff §8.1. Share moved to the header as in the mockup; the ticket image is unchanged |
| 7 | S09 celebration | `celebrateOnce` runs on arrival when the session ended at most 60 s ago, keyed `done-<sessionId>` | As briefed |
| 8 | S10 title | "Review" with the week number or month on the right; Week / Month pills; the period stepper sits at the top of the numbers card | Mockup; the stepper is not in the mockup and must stay |
| 9 | S10 "goal sets" number | Percentage as the figure, "91 of 96" under it | Mockup shows the percentage; classic shows the count |
| 10 | S11 mockup has a back bar although the route keeps the tab bar | `<ScreenHeader backTo="/progress">`; the tab bar stays | Mockup; the router is not mine |
| 11 | S11 muscle map | Highlights the main muscles of the lifts the levels are based on | The mockup's highlighted muscles are sample art; this ties the picture to the data |
| 12 | S11 bars | One sage bar across the five bands per group; the "Next: … at …" line and the estimate stay under it | Mockup drops them; behaviour wins |
| 13 | S18 mockup shows sets as text with an "Edit" link in the header | Each set is a 44 px chip that opens the edit sheet, as in classic | Existing behaviour (tap a set to edit) wins; no extra mode |
| 14 | S19 mockup has a Height field | Left out | The app has no height anywhere (PRD) |
| 15 | S19 sex control | Wrapping pills instead of the segmented control | "Prefer not to say" does not fit a third of 360 px |
| 16 | S20 date field | Stays a native date input | Mockup shows "Today, Mon 9 Nov" as text; the native picker is the existing behaviour |

## How the code is split

- S12: `data.ts` holds the data hooks (`useLifts`, `useBody`, `useHistory`); classic `index.tsx` and `ProgressSun.tsx` both use them.
- S09: `view.ts` holds `summaryView()` (numbers and the share action) and `setsLine()`; classic `index.tsx` and `SummarySun.tsx` both use it.
- S10, S11, S18, S19, S20, `RecompCard`: branch on `useDesign()` in place.
