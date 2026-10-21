# Knockturn LMS – Android Mobile App

The original web app's source (pages, components, styling, business logic, Supabase queries) is copied **unchanged**
into `client/`, wrapped with [Capacitor](https://capacitorjs.com) so it runs as a native Android app and talks to
the **same Supabase database and the same Express backend** as the website. The original web project is untouched.

## What was added / changed (mobile layer only)

| File | Purpose |
|---|---|
| `client/src/native/bridge.ts` | Points `/api/*` calls at your backend; saves/shares Excel/CSV/attachment downloads natively; Android back button; status bar & splash |
| `client/src/main.tsx` | One line: `initNativeBridge()` |
| `client/src/components/layout/Layout.tsx` | On phones the sidebar is a drawer with a ☰ button (web had no way to reopen it once closed). Desktop layout identical |
| `client/index.html` | Removed unused CDN Supabase script; added `viewport-fit=cover` |
| `client/src/index.css` | Small `.is-native` rules (no zoom on input focus, no overscroll) |
| `vite.config.ts` | Same aliases as web, Replit-only plugins removed |
| `capacitor.config.ts`, `android/` | Native shell; `CapacitorHttp` enabled so there are **no CORS issues** |

Supabase URL/key are the same ones already used by the web app (`client/src/lib/supabaseClient.ts`).

## 1. Prerequisites
- Node.js 20+
- JDK 21 (or 17)
- Android Studio (includes the Android SDK) – or just the command-line SDK

## 2. Configure the backend URL
The web app calls `/api/send-leave-notification`, `/api/send-permission-notification`, `/api/apply-leave`,
`/api/forgot-password`, `/api/reset-password` on its own server. A phone app has no "own server", so give it the
public URL of your **already-deployed** Express backend:

```bash
cp .env.example .env
# edit .env
VITE_API_BASE_URL=https://your-lms-backend.example.com   # https, no trailing slash
```

(Everything that uses Supabase directly – login, leaves, balances, comp-off, notifications – works without this.)

## 3. Run in a browser first (optional)
```bash
npm install
npm run dev        # http://localhost:5173 – use Chrome DevTools device mode
```

## 4. Build the APK

### Debug APK (quickest – installable on any phone)
```bash
npm install
npm run android:debug
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`
Copy to the phone and install (allow "install unknown apps"), or `adb install -r app-debug.apk`.

### Using Android Studio
```bash
npm run cap:sync     # builds the web app and copies it into android/
npm run android:open # opens Android Studio
```
Then **Build ▸ Build Bundle(s)/APK(s) ▸ Build APK(s)**, or press ▶ to run on a device/emulator.

### Signed release APK / AAB (Play Store or distribution)
1. Create a keystore (keep it safe, you need it for every update):
   ```bash
   keytool -genkey -v -keystore knockturn-lms.jks -keyalg RSA -keysize 2048 -validity 10000 -alias knockturn
   ```
2. Android Studio ▸ **Build ▸ Generate Signed Bundle / APK** ▸ choose APK (or AAB for Play Store) ▸ select the keystore ▸ *release*.
   Output: `android/app/release/app-release.apk`.
   (CLI alternative: add a `signingConfigs` block to `android/app/build.gradle` and run `npm run android:release`.)

### No local Android SDK? Build in the cloud
Push this folder to a GitHub repo, add the secret `VITE_API_BASE_URL`, then run **Actions ▸ Build Android APK**.
The debug APK is attached as a build artifact.

## 5. App identity
- Package id: `in.knockturn.lms` (change in `capacitor.config.ts`, then re-run `npx cap sync`; for an already-generated `android/` folder also update `android/app/build.gradle`)
- Name: *Knockturn LMS*; icon/splash generated from the Knockturn logo (`assets/`). Re-generate with `npm run assets`.

## 6. Mobile behaviour notes
- **Downloads** (Excel/CSV reports, approved-leaves export, leave attachments): the file is written to app cache and the Android share sheet opens, so users can save to Files/Drive, open in Excel/Sheets, or send via WhatsApp/email.
- **Back button** closes open dialogs/menus, navigates back, and exits from a dashboard/login screen.
- **Login session** persists on the device (same `localStorage` approach as the web app).
- **Password-reset email** links are built by your backend from `FRONTEND_URL` and open in the browser (where the web reset page works). To open them inside the app instead, set up Android App Links for that domain and add an `intent-filter` to `AndroidManifest.xml`; `bridge.ts` already handles the `appUrlOpen` event.
- **Fonts** (Inter/Rajdhani/Orbitron) load from Google Fonts like on the web; the app needs internet anyway for Supabase.

## 7. Updating after web changes
Copy the changed files from the web project's `client/src/` into this project's `client/src/`, then `npm run cap:sync` and rebuild.

## Troubleshooting
- *Emails / forgot-password / apply-leave fail*: `VITE_API_BASE_URL` missing or wrong – rebuild after editing `.env`.
- *`SDK location not found`*: create `android/local.properties` with `sdk.dir=/path/to/Android/Sdk`.
- *Network errors on http:// backend*: use https, or add `android:usesCleartextTraffic="true"` to the `<application>` tag (testing only).
- Inspect the running app: `chrome://inspect` in desktop Chrome with the phone connected via USB.
