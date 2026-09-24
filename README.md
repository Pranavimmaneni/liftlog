# LiftLog handoff: start here

Everything Claude Code needs to build LiftLog end to end: a workout tracker that installs on any iPhone or Android as a web app, plus an Android APK.

## What's in this folder

| Path | What it is |
|---|---|
| `CLAUDE.md` | Rules and workflow for Claude Code (it reads this automatically) |
| `docs/PRD.md` | The full spec: requirements with IDs, engines, data model, non-functional requirements, milestones, tests |
| `docs/PROMPTS.md` | The exact prompts to paste, milestone by milestone, with a phone checklist for each |
| `docs/INSTALL.md` | Deploying to Vercel and installing on iPhone, Android and as an APK |
| `design/` | 14 screens + visual system board in light and dark (PNG + HTML), tokens, pictogram code and SVGs |
| `data/` | Machines, equipment, split templates, intensity rules, strength bands, XP rules, search aliases |
| `ci/` | GitHub Actions: CI checks and the cloud Android APK build |

## How to use it (first session: about 30 min of your time)

1. Make an empty folder for the project, e.g. `~/code/liftlog`, and unzip this package into it.
2. Open a terminal there and start Claude Code with Opus 5.5 (`claude`, then `/model` to pick Opus 5.5 if it isn't already selected).
3. Paste the **Kickoff** prompt from `docs/PROMPTS.md`. Read its summary and fix any wrong assumptions.
4. Paste **M0**. When it reports, do the M0 phone checks (install on both phones).
5. Continue milestone by milestone (M1 → M6). Do each milestone's phone checks before moving on.

Rough total: 6 milestones and about 22–31 hours of Claude Code work. You'll have a usable app on both phones after M1.

## Two things to know
- `data/standards.json` holds **starter** strength bands, not a cited standard. Before you trust the strength-levels screen, have Claude Code (or you) swap in a published source and fill in its `source` field.
- The web app and the APK keep separate data. Use Settings → Back up / Restore to move between them.
