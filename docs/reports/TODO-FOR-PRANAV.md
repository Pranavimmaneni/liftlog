# TODO for Pranav

These steps need your accounts, your phones or your judgement. Do them in order. Steps 1–5 matter; 6–8 are optional.

## 1. ~~Put the code on GitHub~~ ✅ done 2026-09-25
Private repo: **https://github.com/Pranavimmaneni/liftlog** (branch `main`). Commits use your GitHub no-reply email, and the history was checked for secrets and personal details before the push. CI and Lighthouse run on every push (Actions tab).

## 2. Install the web app on both phones
It's live at **https://liftlog-jade.vercel.app**.
- **Pixel (Chrome):** open the link, tap ⋮, then **Install app**.
- **iPhone (Safari):** open the link, tap **Share**, then **Add to Home Screen**. From then on, always open it from the icon.

In-app help is at `/install`. Full steps are in `docs/INSTALL.md`.

## 3. Do the phone checks
`docs/reports/PHONE-CHECKS.md` lists every check for M0–M7 (skip M6: Android is frozen). The ones marked 📱 need a real phone: install flows, the real camera, the share sheets, real airplane mode, whether logging feels instant on the iPhone, and whether you agree with the poses at `/dev/poses`.

## 4. ~~Get the Android APK~~ ⏸ frozen 2026-10-26 (D81: web app only for now)
There's no Android SDK or JDK on this PC, so GitHub Actions builds the APK.
1. GitHub → **liftlog** → **Actions** → **Android APK** → **Run workflow** → `debug`.
2. Download the **liftlog-apk** artifact and unzip it. Copy `app-debug.apk` to the Pixel, open it, and allow installs from your file manager.
3. The first rest timer asks for notification permission: allow it. If the "rest over" notification arrives late, go to Settings → Apps → LiftLog → **Alarms & reminders** → allow.
4. To move your data: in the web app, Settings → **Back up now**; in the APK, Settings → **Restore from backup**.

## 5. Give the strength standards a real source
`src/data/standards.json` (copied from `data/standards.json`) holds **starter** values. Until its `"source"` field names a published source, the strength-levels screen shows a **"Guideline values"** chip (D23).
1. Pick a published strength-standards table and replace the bands in `data/standards.json` (bodyweight ratios per level, male/female).
2. Set `"source"` to the citation, for example `"source": "<publisher>, <table name>, <year>"`.
3. Run `npm run copy-data` (or any build). The chip disappears once `source` no longer starts with "TODO".

## 6. Connect Vercel to GitHub ✅ done (2026-09-25)
The Vercel project is connected to the GitHub repo: every push to `main` deploys to production, other branches get preview deploys. Keep GitHub linked at vercel.com/account/authentication, or Vercel blocks deploys from the noreply commit email.

## 7. Let Lighthouse CI audit Vercel previews (optional)
Vercel previews sit behind Vercel Authentication.
1. Vercel → project **liftlog** → Settings → Deployment Protection → **Protection Bypass for Automation** → Generate secret.
2. GitHub → repo → Settings → Secrets and variables → Actions → add `VERCEL_AUTOMATION_BYPASS_SECRET` with that value.

Until then, Lighthouse CI audits the production build, served with the same Brotli compression, on every push.

## 8. ~~Signed release APK~~ ⏸ frozen 2026-10-26 (D81)
Follow `docs/RELEASE.md` §4: create a keystore, then add 4 GitHub secrets. Then run the workflow with `release`, or push a `v1.0.0` tag. Keep the keystore safe: every future update must be signed with it.
