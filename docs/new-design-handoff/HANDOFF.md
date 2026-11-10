# LiftLog redesign: handoff for coding agents

Status: design direction chosen by Pranav. Nothing in `main` has been changed. Build this behind the existing code, on a branch, and do not remove the current UI until he approves the result.

What is in this folder:

- `screens/` : one HTML mockup per screen per theme (390 × 844). File name = `H<theme><screen id>.dc.html`, e.g. `HW2S07` = Workout Dark, S07 Logging a set. Open in a browser; the inline `<style>` in each file is the exact CSS used.
- `png/` : the same boards rendered to PNG.
- Screen ids match `docs/PRD.md` §4 (S01–S26) and the food mockups (F01–F07).

The mockups are static pictures of layout and style. They are not components. Rebuild them in the app's own stack (React 19, Tailwind 4) following the repo `CLAUDE.md` rules: colours only through `--ll-*` tokens, copy in `src/copy/en.ts`, both light and dark, 44 px minimum touch targets.

## 1. The system in one paragraph

Cream, black, red and sage. A "rising sun" (a disc with two rings) sits at the bottom of every screen behind frosted-glass cards. Titles and big numbers are set in blocky capitals (Dela Gothic One); everything else is Hanken Grotesk. The workout side leans white/black/red, the food side leans green, and both use the whole palette. When the user logs something the rings ripple; on a record or a food goal the rings sweep the whole screen.

## 2. Themes

Four themes: the section (LiftLog or Food) picks the family, the app's light/dark setting picks the variant.

| Token | Workout Light (W1) | Workout Dark (W2) | Food Light (F1) | Food Dark (F2) |
|---|---|---|---|---|
| bg | #F3F1EA | #0B0B0A | #E6EDE3 | #12201A |
| card (opaque sheets) | #FBFAF5 | #151514 | #F3F7F0 | #1A2C23 |
| ink (text) | #0D0D0C | #F3F1EA | #12201A | #EEF2E8 |
| dim (secondary text) | #45453F | #BDBBB2 | #3A4A40 | #B7C6B9 |
| accent | #D8321F | #F2473F | #2F6B45 | #8FD3A4 |
| button fill | #E5382A | #F2473F | #2F6B45 | #8FD3A4 |
| button text | #0D0D0C | #0B0B0A | #F3F7F0 | #12201A |
| track (empty bars/rings) | #D9D6CB | #32322F | #C9D6CA | #2E4437 |
| glass | rgba(250,249,244,.80) | rgba(14,14,13,.74) | rgba(241,246,238,.82) | rgba(18,32,26,.76) |
| soft (chips, fields) | rgba(13,13,12,.07) | rgba(243,241,234,.10) | same idea, ink at 7–10 % | same |
| hairline | rgba(13,15,10,.16) | rgba(238,235,221,.18) | light value | dark value |
| sage (positive, "last session") | #9DB5A7 | #9DB5A7 | #7E9A8B | #6E9A82 |
| fat macro colour | #7E9A8B | #9DB5A7 | #D8321F | #F2675A |
| sun disc | #0D0D0C | #1B1F17 | #2F6B45 | #2F6B45 |
| sun wide ring (inner) | #9DB5A7 | #9DB5A7 | #9DB5A7 | #9DB5A7 |
| sun thin ring (outer) | #E5382A | #F2473F | #12201A | #EEF2E8 |

Add these as new `--ll-*` tokens (suggested names: `--ll-bg`, `--ll-card`, `--ll-ink`, `--ll-dim`, `--ll-accent`, `--ll-btn`, `--ll-btn-ink`, `--ll-track`, `--ll-glass`, `--ll-soft`, `--ll-hairline`, `--ll-sage`, `--ll-sun-disc`, `--ll-sun-ring-wide`, `--ll-sun-ring-thin`), scoped by `data-section="workout|food"` and the existing theme attribute. Check the existing token names first and reuse where one already means the same thing.

Muscle map colours stay as in the existing assets: primary #9E2B25, secondary #D6A546.

## 3. Type

- Display: **Dela Gothic One**, 400, uppercase for titles. Used for screen titles (30 px), hero numbers (38–54 px), stepper values (32–40 px). Sizes in the mockups already include a 0.8 scale because the face is wide; copy sizes from the mockup CSS.
- Text: **Hanken Grotesk** 400/500/600/700. Body 16–17, secondary 14–15, smallest 13. Nothing below 13 px.
- Sentence case everywhere except display titles. Tabular numbers for anything that changes.
- Bundle both fonts locally (the app is an offline PWA); do not load from Google Fonts at runtime.

## 4. Components

- **Glass card**: `background: glass; backdrop-filter: blur(22px) saturate(1.5); border: 1px solid hairline;` plus a 1 px inset highlight on the top edge. Radius 18 for hero cards, 14 for lists.
- **Primary button**: full width, height 58, radius 14, button fill and button text tokens, weight 700. One per screen, at the bottom.
- **Secondary button**: glass pill, height 48, radius 24.
- **Stepper**: 56 × 56 buttons either side of a display number with the unit under it.
- **Chips**: height 44, radius 22; selected = ink fill with bg-colour text; unselected = soft fill with hairline.
- **List row**: min height 52, label left (optional 13 px sub-line), value right, hairline between rows.
- **Switch**: 46 × 28; on = sage (workout) or button colour (food).
- **Bottom sheet**: opaque card colour, 28 px top radius, grab handle, 50 % black scrim behind.
- **Tab bar**: floating glass pill. LiftLog: Today · Plan · Progress. Food: Diary · Review · Fasting. `LiftLog | Food` segmented switch sits under the title on top-level screens.
- **Tiles on the logger**: "Last session" = sage fill; "Today's goal" = card with a 2 px accent outline.
- **Pictograms and muscle maps**: reuse the existing exercise assets; pictogram strokes take the ink colour, the accent marks the moving load.

## 5. The rising sun

One SVG, fixed behind the content, 390 × 844 viewBox, circles centred at (195, 860), so about the top third of the disc shows above the bottom edge. Scale with the viewport width and keep it anchored to the bottom.

```
thin ring : r 325, stroke 14, no fill   (outer)
wide ring : r 284, stroke 44, no fill   (next to the sun)
disc      : r 250, filled
```

A faint grain texture overlays the page background. Content scrolls over the sun; the sun does not scroll. Sheets and the scanner screen hide it.

## 6. Motion: "Echo"

Two events. Both originate from the sun's centre.

1. **Ripple** (set logged, food logged, weigh-in saved): three thin rings (r 318, stroke 6, button colour) scale 0.82 → 1.5 and fade out, staggered 250 ms, about 1.4 s in total. Nothing else moves; no message.
2. **Celebration** (new record; calories, protein, carbs or fat goal reached; workout finished): page dims (bg colour at 90 %), six bold rings (r 318, stroke 26, colours cycling button → sage → ink) scale 0.8 → 3.9 staggered 250 ms so they sweep the whole screen, a centred message fades in (display title + one line, e.g. "New record" / "Bench Press · 67.5 kg × 10"), then everything fades and the screen is back to normal. About 3 s; a tap dismisses it early.

Rules: each goal celebrates once per day; if several fire together, show one celebration and list the lines. With `prefers-reduced-motion`, skip the rings and show the message as a 2 s toast. The mockups (`HM*` files) loop these on a timer for demonstration only; in the app they play once per event. Reference keyframes are in those files.

## 7. Screens

Workout (W1 and W2): S01 About you · S02 Your gym · S03 Pick a split · S04 Routine builder · S05 Today · S06 Active workout · S07 Logging a set · S08 Logging on a machine · S25 Rest timer · S09 Workout summary · S10 Weekly review · S11 Strength levels · S12 Progress · S13 Library · S14 Settings · S15 Plan · S16 Exercise detail · S17 Custom exercise · S18 Past session · S19 Body stats · S20 Weigh-in sheet · S21 Install help · S22 Scan a machine · S23 Swap sheet · S24 Change target sheet · S26a Empty state · S26b Delete confirm.

Food (F1 and F2): F01 Diary · F02 Add food · F03 Portion sheet · F04 Create food · F05 Targets · F06 Review · F07 Fasting.

Decisions Pranav made on specific screens; keep these:

- **Today** is two cards. Workout card: session name, sets · time, muscle map of the day's muscles, Start/Resume button, month dot-calendar with streak. Food card: kcal left, small "Log food" button, four rings (protein, carbs, fat, fiber). Kept deliberately sparse.
- **Logging a set**: large pictogram + muscle map, the list of today's sets, weight and reps steppers, "Last session" and "Today's goal" tiles, rest time in the header, one Log button.
- **Rest timer**: ring countdown with Skip, set list, "How did set N feel?" Easy / Solid / Hard, "Start set N now".
- **Food diary**: kcal left, four bars including fiber, meals.
- **Add food**: search + Scan, a prominent "Create a new food" button, suggestions, recents.

## 8. Not decided or not real: read before building

1. **Features dropped from mockups for calm, not from the product.** Every existing feature must survive. Where a mockup omits one, keep the feature and place it in the nearest quiet spot: rest −15 s / +15 s and the "Hurts" effort option (put in a "…" menu on the rest timer), per-set "last time" values, date numbers on the calendar (show on tap), macro targets under the Today rings (shown in the diary), and the `LiftLog | Food` switch on Today.
2. **Screens S01–S04, S08–S11, S13–S24, S26 and F03–F07 are first drafts** in the chosen style. Pranav reviewed and iterated Today, Active workout, Logging, Rest, Progress, Diary and Add food; he has not yet reviewed the rest. Treat their layout as a starting point and their style as fixed. For behaviour, the PRD wins over the mockup.
3. **Placeholder data**: fiber numbers, calendar training days, strength levels, review text and all weights are made up.
4. **Pictograms**: six of the eight lift pictograms in the mockups were redrawn for the mockups. Use the app's real assets.
5. **Food palette** and whether the ring swap should also have swapped the ring colours are still open with Pranav. Keep the colours as tokens so they can change in one place.
6. **Unverified**: the motion has only been checked as still frames; real-device performance of `backdrop-filter` over the sun on low-end Android (Capacitor WebView) is untested. Provide an opaque-card fallback when blur is unsupported or slow.
7. Contrast was checked automatically for text on cards (AA). Text sitting on glass over the sun was checked by eye only; re-check in the build, especially secondary text where a card crosses the red ring.

## 9. Suggested build order

1. Tokens, fonts, the sun background, glass card, buttons, tab bar (no screen changes yet).
2. Today, Active workout, Logging, Rest timer.
3. Food diary, Add food, Portion, Create food.
4. Echo motion.
5. Everything else, one PRD screen id per change, each checked in both themes.
