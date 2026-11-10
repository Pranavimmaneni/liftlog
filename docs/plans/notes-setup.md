# Setup area notes (M16, FR-DSN-10)

Date: 2026-11-10. Screens: S01–S03 onboarding, S14 Settings (+ gym, profile, data), S21 Install, S22 Scan (+ stickers, machine link), S08 machine card, S26 states, not-found / crash / update / storage.

## Decisions (gap, decision, why)

1. **S01 experience is a list of radio rows, not pills.** The mockup shows three pills; the app has a one-line description per level (FR-ONB-2). Rows keep the description; the chosen row takes the ink fill like a selected chip.
2. **S01 / Profile days per week is a stepper (2–6)**, as in the mockup, in place of the classic five number buttons. Same range, same saved value.
3. **Onboarding titles.** The display title is the step's short name ("About you", "Your gym", "Your split"); the classic question ("How long have you been lifting?") and its help text move onto the first glass card, because only the title may sit on the page. The bar reads "Step n of 3" with the three progress marks kept under it.
4. **S02 / My gym keeps chips, not the mockup's switch list.** The real gym has about 25 toggles (7–11 free weights, 12–40 machines, 4 limitations); a 52 px switch row each would be over 1,300 px. Each group is a glass card of 48 px pills. "More equipment", "More machines", the machine count and units are all kept.
5. **S03 keeps the week strip and "Best fit · n days"** (the mockup drops the strip and says "Recommended"). The chosen split has the accent outline from the mockup. Strip labels are 13 px sentence case.
6. **Bottom bar (`BottomCta`) is see-through in the new look**: only the button, as on the rebuilt logger. Also applies to the routine builder step's "Save routine".
7. **S14 Theme and Look stay segmented controls** on one glass card (the mockup shows "Theme · System ›"). The Look control must be the same element in both looks so switching keeps it in place (the M13 test relies on it), and a segmented control is one tap instead of a sheet.
8. **S14 group labels are not shown** ("Training", "You", "Your data"); they are the groups' accessible names. Install help and the version line are a fourth glass group. The privacy note and restore error sit inside the data group.
9. **S26b delete-all confirm keeps the typed DELETE** (FR-DATA-4) and gains a "Keep my data" secondary button, as in the mockup's "Keep it".
10. **S21 keeps the step illustrations** (FR-PLT-8 "illustrated steps") at the right of each numbered row. "Install now" is the primary button at the bottom when the browser offers it.
11. **S22 scanner**: no "Pick from the list instead" button, because the scanner does not know which list it was opened from; "Print stickers" takes that outlined-pill spot. Close stays a labelled icon button.
12. **S22 sticker sheet**: only the on-screen chrome changed. `sun-setup.css` hides the sun and forces black on white for the stickers in `@media print` in the new look.
13. **S08 machine card** shows the machine's name under "Your machine" (the mockup leads with the name). Tiles, "+ Setting", stack and photo are unchanged.
14. **Empty states in my screens** (no machines for stickers, unknown machine link, not found) follow S26a: centred glass card, bold line, primary button.

## Requests for shared files (not mine to edit)

- `src/copy/en.ts` `look.note` is out of date once M16 lands: it says "the other screens have its colours and type for now". Suggest: "Rising Sun is the new design. Classic stays available here."
- `src/components/Toast.tsx` `EmptyState`: in the new look it is still a left-aligned dashed card with 15 px secondary text. To match HW1S26a: when `useDesign() === 'sun'`, render `<div className="sun-glass rounded-[18px] p-[18px] text-center">` with the message as `<p className="text-[17px] font-bold leading-snug">` and the action under it with `mt-4`; drop `border-dashed`.
- `src/components/Sheet.tsx` danger tone / `src/styles/sun.css`: the mockup's destructive button is a filled accent button (`background: var(--ll-btn); color: var(--ll-btnInk)`); today `.ll-btn[data-variant='destructive']` in the new look is an outlined card-colour button. Change in `sun.css` if the filled version is wanted.
- **Pre-existing, classic look too**: `bg-black` / `text-white` in `S22-scan/index.tsx` produce no CSS, because `@theme` in `app.css` resets `--color-*` and defines neither colour. Without a camera picture the classic scanner shows ink text on the page colour. In the new look I used explicit `rgb()` values; classic is left as it was. Fix for both: add `--color-black` and `--color-white` to `@theme`.

## Not verified

- `UpdateToast` (production service worker only) and `StorageBanner` were restyled by class only; the banner is covered by the existing M5 test, neither was seen in a screenshot.
- Printing the sticker sheet in the new look was not printed or print-previewed.
- The scanner with a live camera (headless Chromium has none): only the no-camera state was seen.
