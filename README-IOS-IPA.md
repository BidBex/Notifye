# Building Notifye as an iOS `.ipa` File

Apple requires macOS + Xcode (`xcodebuild`) to compile native ARM64 iOS binaries, so a `.ipa` file cannot be compiled directly inside a Linux cloud server. This project is pre-configured with **Capacitor** and **GitHub Actions** so you can generate **`Notifye-unsigned.ipa`** either on GitHub's free macOS runners (no Mac required) or locally on any Mac.

## Option A — Build `.ipa` in the Cloud with GitHub Actions (No Mac Required)

1. Push this project (or the extracted `notifye-ios-ipa-project.zip`) to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Notifye iOS IPA setup"
   git branch -M main
   git remote add origin https://github.com/<your-username>/notifye-ios.git
   git push -u origin main
   ```
2. Open your repository on GitHub and click the **Actions** tab.
3. Select **Build iOS IPA** (it triggers automatically on `main`, or click **Run workflow**).
4. When the workflow finishes (~3–5 minutes), download the **`Notifye-iOS-IPA`** artifact containing **`Notifye-unsigned.ipa`**.

## Option B — Build `.ipa` Locally on a Mac with Xcode

```bash
chmod +x build-ipa.sh
./build-ipa.sh
```

This creates **`./Notifye-unsigned.ipa`** directly in the project root.

## Installing `Notifye-unsigned.ipa` on Your iPhone

- **Sideloadly / AltStore / SideStore**: Open the tool on Windows/Mac, connect your iPhone, drag `Notifye-unsigned.ipa` in, and sign it with your free Apple ID.
- **Apple Developer / TestFlight / Xcode**: Open `ios/App/App.xcworkspace` (or `App.xcodeproj`) in Xcode after running `npx cap add ios && npx cap sync ios`, choose your Signing Team, and press **Run** or **Product → Archive**.

## Interactive Home Screen & Lock Screen Widgets (iOS 17+)

The `.ipa` build automatically embeds the **NotifyeWidgets** extension (`ios-widget/NotifyeWidget.swift`):
- **Small Quick Button Widget**: Press the button right inside the widget to send a notification to your partner without opening the app.
- **Medium Dual Action Widget**: Includes both normal tap and **Priority** buttons directly in the widget.
- **Lock Screen Circular Widget**: One-tap circular button for your iPhone Lock Screen.

Open Notifye once after installing, sign in, and pair with your partner so your widget credentials sync to the shared App Group (`group.com.notifye.app`).

## Note on Google Sign-In inside `.ipa`

- **Hosted Wrapper Mode**: If `capacitor.config.json` includes `server.url` pointing to your deployed HTTPS Notifye URL, the `.ipa` loads your live app directly over HTTPS.
- **Bundled Offline Mode**: If `capacitor.config.json` bundles `dist/` (`capacitor://localhost`), make sure `localhost` is authorized in Firebase Authentication → Settings → Authorized domains, or sign in via the hosted HTTPS mode.
