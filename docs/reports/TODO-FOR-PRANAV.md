# TODO for Pranav

Things that need your accounts, devices or judgement. In order.

## 1. Put the code on GitHub (the `gh` CLI isn't installed on this PC)

Create an **empty private** repo called `liftlog` at https://github.com/new (no README, no .gitignore), then in this folder:

```bash
git remote add origin https://github.com/<your-username>/liftlog.git
git push -u origin main
```

Or install the GitHub CLI (`winget install GitHub.cli`), run `gh auth login`, then:

```bash
gh repo create liftlog --private --source . --push
```

After the push, the **CI** workflow runs automatically (Actions tab).

## 2. Connect Vercel to GitHub (optional, for deploy-on-push)

The app is already deployed from this PC with the Vercel CLI to **https://liftlog-jade.vercel.app** (project `liftlog`, team `ed-i-th`).
To deploy on every push instead: Vercel → project **liftlog** → Settings → Git → Connect Git Repository → pick `liftlog`.

## 3. Let Lighthouse CI audit Vercel previews (optional)
Vercel previews are behind Vercel Authentication, so the Lighthouse job can't open them without a bypass token.
1. Vercel → project **liftlog** → Settings → Deployment Protection → **Protection Bypass for Automation** → Generate secret.
2. GitHub → repo **liftlog** → Settings → Secrets and variables → Actions → New repository secret: name `VERCEL_AUTOMATION_BYPASS_SECRET`, value = that secret.
Until then, Lighthouse CI audits the production build served the same way (Brotli) on every push.

## 4. Get the Android APK
There's no Android SDK/JDK on this PC, so the APK is built by GitHub Actions (needs step 1 done first).
1. GitHub → repo **liftlog** → **Actions** → **Android APK** → **Run workflow** → `debug`.
2. Download the **liftlog-apk** artifact, unzip, copy `app-debug.apk` to the Pixel, open it and allow installs from your file manager.
3. First rest timer: allow notifications. If the "rest over" notification comes late, Settings → Apps → LiftLog → **Alarms & reminders** → allow.
4. For a signed release APK later, follow `docs/RELEASE.md` §4 (keystore + 4 GitHub secrets).
