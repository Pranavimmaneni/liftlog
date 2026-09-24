# Getting LiftLog onto your phones

## One-time setup (about 15 minutes)

1. **GitHub:** create an empty private repo called `liftlog`, then let Claude Code push to it (M0 walks you through this).
2. **Vercel:** sign in at vercel.com with GitHub → Add New → Project → pick `liftlog` → Deploy. The defaults work: Vite is detected and the output folder is `dist`. The free Hobby plan is enough.
3. Every push to `main` now deploys to `https://liftlog-<something>.vercel.app`. Bookmark it.
4. (Optional) Add a custom domain in Vercel → Settings → Domains.

## Install on Android (web app, recommended to start)
1. Open the Vercel URL in **Chrome**.
2. Tap ⋮ → **Install app** (or "Add to Home screen").
3. Open LiftLog from the home screen. It runs full-screen and works offline.

## Install on iPhone (web app)
1. Open the URL in **Safari** (it must be Safari the first time).
2. Tap **Share** → **Add to Home Screen** → Add.
3. Open LiftLog from the home screen icon. Always use the icon, not a Safari tab, because the icon version has its own saved data.
4. iOS 18.4 or later keeps the screen awake during workouts. On older iOS, set Auto-Lock to a longer time while you train.

## Install on Android as an APK (M6 onward)
Use this if you want rest-timer alerts while the phone is locked.
1. On GitHub: **Actions** → **Android APK** → **Run workflow** (build type: debug).
2. When it finishes (about 5–8 minutes), open the run → download **liftlog-apk** → unzip.
3. Send the `.apk` to your phone (Drive, email to yourself, or USB) and open it.
4. Android asks to allow installs from that app (Files/Drive/Chrome). Allow it, then Install.
5. For updates, run the workflow again and install over the top. Your data stays.

## Moving your data between the web app and the APK
They are separate installs with separate storage.
1. In the app you're leaving: Settings → **Back up now** → save the file.
2. In the app you're moving to: Settings → **Restore from backup** → pick the file.

## Updates
- **Web app:** updates download in the background. You'll see "New version: reload". It never reloads mid-workout.
- **APK:** re-run the workflow and install the new APK.

## iPhone App Store?
Not needed. The web app covers the iPhone. A real App Store or TestFlight build needs a paid Apple Developer account ($99/year) and a Mac with Xcode. The code is ready for it (Capacitor), but it's out of scope for v1.
