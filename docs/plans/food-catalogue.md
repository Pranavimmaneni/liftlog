# Food catalogue: every brand (FR-FOOD-8): plan

Request (Pranav, 2026-11-07): "The food database is very very small. Add everything you can get from Walmart, Target, Costco and other stores. Include all the items from all the brands. If there isn't a public dataset, make your own one."

A public dataset exists and is already pinned: USDA Branded Foods (CC0), the label data brand owners and retailers submit. 1.2.0 shipped 17,864 of its ~416,000 current US products. This change ships all of them that pass the FR-FOOD-1 filter. No own dataset: scraping retailer sites breaks their terms, and guessed nutrition would be wrong (D120).

**Exit criteria**
- ~400,000 branded products from every brand, searchable and scannable offline, with the curated store-brand set still first to arrive.
- Search under 150 ms on the whole library (NFR-PERF-5), memory a phone can hold.
- Resumable background download; nothing in the precache or the APK; first-load JS and precache budgets hold.
- Schema v3 with a migration test; typecheck, lint, unit and e2e pass.

| Task | Files | Req |
|---|---|---|
| Seed: every brand into the catalogue (core groups' overflow too), placeholder brands fall back to the owner, 25,000-row shards in `public/food/<version>/`, report by store | `data/food-sources.json`, `scripts/foods/branded.ts`, `scripts/seed-foods.ts`, `FOOD-SEED-REPORT.md` | FR-FOOD-1, FR-FOOD-8 |
| Columnar search index (typed-array postings, one-edit check, fuzzy skip, top-k cut), async build in slices, multi-index search with tab filter, A–Z lists | `src/engine/food-search.ts`, `data/nutrition.json` `search` | FR-FOOD-3, NFR-PERF-5 |
| Schema v3: compact `foodLib` rows, `foodSearch` columns keyed `<version>/<file>`; upgrade empties the old library | `src/db/schema.ts`, `src/db/types.ts`, `src/db/backup.ts` | NFR-REL-3 |
| Resumable chunk-by-chunk import (core, then catalogue; data saver skips the catalogue), lookups decode compact rows | `src/db/food-lib.ts`, `src/db/food.ts` | FR-FOOD-2, FR-FOOD-8 |
| Search hook builds the library index from `foodSearch`; screens resolve only shown ids; catalogue progress line | `src/screens/food/hooks.ts`, `AddFood.tsx`, `NewFood.tsx`, `src/screens/dev/DevFood.tsx`, `src/copy/en.ts` | FR-FOOD-3, NFR-OFF-3 |
| APK: import bundled core chunks, fetch the catalogue from the site (CSP), drop `dist/food` | `src/main.tsx`, `vite.config.ts`, `src/vite-env.d.ts`, `package.json` `homepage` | FR-FOOD-8, NFR-SIZE-1 |
| Hosting: immutable caching + CORS for `/food/`, not rewritten; budget script checks the precache | `vercel.json`, `scripts/check-budget.ts` | NFR-SIZE-1 |
| Tests: seed split, engine (equivalence, tabs, fuzzy skip, top-k, 425k perf), import/resume/meta wipe, v2→v3 migration; e2e imports `?subset=core` | `scripts/foods/foods.test.ts`, `src/engine/food-insight.test.ts`, `src/db/*.test.ts`, `e2e/m10-food-data.spec.ts` | all |

Phone checks for Pranav (not possible here):
1. Pixel 8 Pro and iPhone, installed PWA: open Food once on Wi-Fi; the "Adding every brand" line should reach 100% and disappear (desktop Chrome took ~30 s).
2. Search "great value", "good gather yogurt", "kirkland" and a typo like "protien bar": results under a blink, no stutter while typing.
3. Scan a store-brand barcode from the pantry (e.g. a Great Value or Market Pantry item).
4. APK (after the next CI build): Food search works offline right after install (core), and the catalogue arrives once online.
