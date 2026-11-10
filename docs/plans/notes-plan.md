# Notes: Plan and Library in the Rising Sun look (M16, FR-DSN-10)

Date: 2026-11-10. Area: S04, S13, S15, S16, S17, S23, S24, `ExerciseRow`. For the lead to move into `DECISIONS.md`.

| # | Gap or conflict | Decision | Why |
|---|---|---|---|
| 1 | HW1S15 shows "Week 7" beside the title and no `LiftLog / Food` switch | Plan uses `<SunTop>` without the switch; the right slot shows the split name (the classic chip) | The app has no week counter; the split name is real information the classic header already shows |
| 2 | HW1S15 lists "8 lifts · 24 sets" per session; classic lists every exercise name | The row shows lifts and planned sets (from `prescribe`), plus "Done this week". Names are one tap away in the editor | Follows the mockup; the list stays one calm glass card |
| 3 | HW1S15 has "In progress" and a handle on the right, no "Skip to" | Kept the drag handle (left), "Next" chip and "Skip to" on every other row | FR-RTN-4/5 behaviour wins over the draft |
| 4 | "Up next" and the reorder hint sat straight on the page | They are the header of the queue's glass card. Same for "Not in your gym" in the Library and the footer note | Only the page title may sit on the sun |
| 5 | Routine builder title was 38 px `whitespace-nowrap` | `.sun-title` (30 px), wraps, split name as plain text under or beside it. From Plan > Edit routine the title is hidden (`showTitle={false}`) because the glass bar already says "Edit routine" with the split name as its subtitle | Fixes the page widening at 360 px; avoids two titles |
| 6 | HW1S04 puts sets × reps and the handle on the right and has no swap button | Row = handle, picture, name with "muscle · sets × reps" under it, swap button. Remove stays in the swap sheet | Swap and remove must stay reachable; long names need the width |
| 7 | HW1S04 coverage is a two-column grid without "+ Fix" | One row per muscle: name, "9 of 10 sets", 6 px bar with the target tick, "+ Fix" when under target | FR-RTN-3 needs the fix button; two columns do not fit it at 360 px |
| 8 | Session tabs and filter pills | New `.sun-plan-pill` (glass pill, ink fill when chosen) in `sun-plan.css`; `Toggle.tsx` in S13 renders it in the new look and the classic `ToggleChip` otherwise | `ToggleChip` forces 12 px text, below the 13 px floor, and belongs to the lead |
| 9 | HW1S13 header has "New"; classic has a button under the list | Both: "New" in the bar (labelled "Create custom exercise") and a glass pill under the list | The list can be 600 rows long, so the bar is the quick way; the lower one keeps the classic place |
| 10 | HW1S16 pins "Swap into…" and "Add to a session" to the bottom | They sit under the hero card, with "Add to today's workout" when a workout is open | Real how-to text is long; pinned buttons covered it while scrolling |
| 11 | HW1S16 history is three rows | Best set, estimated 1-rep max, the chart (with its table view) and the last five sessions in one glass list | Keeps every classic feature |
| 12 | HW1S24 has one weight stepper and one "sets × reps" stepper | Kept the four steppers (sets, reps from, reps to, weight), each full width | FR-PRG-8 edits all four; two side by side were cramped at 390 px |
| 13 | HW1S23 puts the scope pills under the list | Kept the classic order (scope first, then alternatives, Browse, Remove); rows sit straight on the opaque sheet | The scope applies to the tap that follows it |
| 14 | S17 mockup uses selects for muscles | Kept the muscle pills (primary and secondary), all fields on one glass card | Existing behaviour; fewer taps |

Not mine, noticed while checking:

- `src/screens/onboarding/shared.tsx` `BottomCta` keeps an opaque `bg-paper` strip in the new look (visible on Plan > Change split, step 2).
- Logger (`S07`) has 10 px and 11 px text ("Add photo", "+ Setting") in the new look.
