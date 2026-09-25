# Releasing LiftLog

LiftLog ships two ways: the **web app** (PWA on Vercel) and an **Android APK** (Capacitor), both built from this repo. Version **1.0.0**.

## 1. Bump the version
1. `package.json` → `"version"` (shown in Settings).
2. `android/app/build.gradle` → `versionName "x.y.z"` and **increase `versionCode` by 1**. Android refuses to install an update with the same or a lower code.
3. Add a section to `CHANGELOG.md`, commit, and tag: `git tag v1.0.1 && git push --tags`.

## 2. Web (PWA)
- Deploy: `vercel deploy --prod --yes` (project `liftlog`, team `ed-i-th` → https://liftlog-jade.vercel.app), or push to `main` once Vercel is connected to GitHub.
- Returning users get a "New version" toast. It never reloads during a workout (NFR-OFF-2).

## 3. Debug APK (personal sideloading)
No Android Studio needed:
1. GitHub → **Actions** → **Android APK** → **Run workflow** → `debug`.
2. When it finishes, download the **liftlog-apk** artifact, unzip it, and copy `app-debug.apk` to the phone.
3. Open it on the phone and allow "Install unknown apps" for your file manager when asked.

With the Android SDK and JDK 21 on a PC, the same thing runs locally with `npm run cap:sync` and then `cd android && ./gradlew assembleDebug`. The APK lands in `android/app/build/outputs/apk/debug/`.

## 4. Signed release APK
A release APK is signed with your own key. **Keep the keystore and passwords safe**: updates must be signed with the same key forever.

1. Create a keystore (once). `keytool` comes with any JDK:
   ```bash
   keytool -genkeypair -v -keystore liftlog-release.keystore -alias liftlog -keyalg RSA -keysize 4096 -validity 10000
   ```
2. Base64-encode it:
   ```bash
   base64 -w0 liftlog-release.keystore > keystore.b64
   ```
   (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("liftlog-release.keystore")) > keystore.b64`)
3. GitHub → repo **Settings → Secrets and variables → Actions**. Add four secrets:
   - `ANDROID_KEYSTORE_BASE64`: the contents of `keystore.b64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS` (for example `liftlog`)
   - `ANDROID_KEY_PASSWORD`
4. Run **Actions → Android APK → Run workflow → `release`**, or push a `v*` tag. The workflow decodes the keystore to `android/app/release.keystore` (git-ignored), and `build.gradle` signs the release build with it. The artifact contains `app-release.apk`.
5. Optional check, with the Android SDK build tools: `apksigner verify --print-certs app-release.apk`.

## 5. Moving data between web and APK
The browser tab, the installed PWA and the APK each keep **separate** storage. To move: Settings → **Back up now** in one, then Settings → **Restore from backup** in the other (replace or merge).

## 6. What the APK adds over the web app
- Rest-end notification while the phone is locked (local notifications, FR-PLT-4). Android asks for notification permission the first time a rest timer runs.
- Keep-screen-on, haptics, the Android share sheet for backups and ticket images, and a status bar that follows Paper/Iron.
- Paper and Iron splash screens, and the LL monogram icon.
