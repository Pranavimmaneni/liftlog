# Design files

- `screens/light/` and `screens/dark/`: every screen as a PNG (2× scale) and a standalone HTML file. Open the HTML in a browser to inspect exact spacing, colours and copy. File names match the screen IDs in `docs/PRD.md` §4 (S01–S14, V01).
- `tokens.css` / `tokens.json`: the Paper (light) and Iron (dark) themes. `tokens.css` switches on `prefers-color-scheme` and on `[data-theme="paper"|"iron"]`.
- `illustrations/pictos.py`: the pictogram rig, equipment parts, the 10 Tier 1 exercises and the muscle map. Run `python3 pictos.py` interactively, or read it as the spec. `set_theme("dark")` switches palettes.
- `illustrations/light|dark/*.svg`: exports for each Tier 1 exercise (`<id>.svg` full, `<id>.thumb.svg` finish pose only, `<id>.muscles.svg` muscle map). Use them to visually diff the TypeScript port.
- `illustrations/poses-readme.json`: rig constants.

Mockup numbers (weights, dates, names) are sample data, not requirements.

## Rising Sun (M13 onward)

- `../docs/new-design-handoff/HANDOFF.md`: the redesign brief (themes, type, components, the sun, motion, what is and isn't decided).
- `../docs/new-design-handoff/screens/H<theme><id>.dc.html` and `png/`: one mockup per screen per theme (W1/W2 = workout light/dark, F1/F2 = food light/dark, M = motion). Their inline CSS is the spec for spacing and sizes.
- `tokens.json` → `"sun"` and the `[data-design="sun"]` blocks in `tokens.css`: the four Rising Sun themes.
- Compare the build with the mockups: `SHOOT_LOOK=sun npx tsx scripts/shoot.ts <outDir> today=/ …` (see the script header).
