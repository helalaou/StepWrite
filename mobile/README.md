# StepWrite for iPhone and Android

This folder packages the StepWrite web client ([`client/`](../client)) as an iPhone app and an
Android app with [Capacitor](https://capacitorjs.com). Each app runs the same React client in
the phone's web view. Hands-free mode works there just as in a browser: you speak your answers,
StepWrite asks follow-up questions, and the final text appears at the end. The StepWrite server
still runs on a computer, and the apps reach it over the network.

## What you need

- Node.js 22 or newer for this folder (Capacitor 8 requires it).
- A running StepWrite server (`npm start` from the repository root; see the
  [main README](../README.md#getting-started)).
- For the iPhone app: a Mac with Xcode. The app runs on iOS 15 or later.
- For the Android app: Android Studio, or the Android SDK command-line tools with a JDK 21.
  The app runs on Android 7.0 (API 24) or later.

## Build

```bash
cd mobile
npm install
npm run build
```

`npm run build` builds the web client into `mobile/www` and copies it into the `ios/` and
`android/` projects. Run it again after every change to `client/` or `capacitor.config.json`.

The server address is fixed when you build:

| Where the app runs | Build command | Server address the app uses |
| --- | --- | --- |
| iPhone simulator | `npm run build` | `http://localhost:3001` on your Mac |
| Android emulator | `npm run build` | `http://localhost:3001`, forwarded with `adb reverse` |
| A real phone | `SERVER_URL=https://your-server.example npm run build` | your HTTPS server |

Without `SERVER_URL`, the apps use the same address as the web client (`DEPLOY_MODE` in
[`client/src/config.js`](../client/src/config.js)). The server already accepts requests from both
apps (see [`server/lib/origins.js`](../server/lib/origins.js)).

## Run in the iPhone simulator

```bash
npm run ios
```

This asks which simulator to use, then builds and launches the app. You can also run
`npm run open:ios` and press Run in Xcode.

The simulator records from the Mac's microphone. The first time you start hands-free mode,
StepWrite asks for microphone access. If the app hears nothing after you allow it, check two
things. Simulator must be allowed under System Settings › Privacy & Security › Microphone. The
input device under Simulator's I/O › Audio Input menu must be the microphone you speak into.

## Run in the Android emulator

Start an emulator from Android Studio's Device Manager. A recent emulator image needs about
8 GB of free disk space to start. Then forward the server port and launch the app:

```bash
adb reverse tcp:3001 tcp:3001
```

```bash
npm run android
```

`adb reverse` lets the emulator reach the server on your computer at `localhost`. Debug builds
allow plain HTTP to `localhost` for this
([`network_security_config.xml`](android/app/src/debug/res/xml/network_security_config.xml)).
Release builds accept HTTPS only.

The emulator hears your computer's microphone when "Virtual microphone uses host audio input" is
on. Find it under Extended controls (the ⋯ button) › Microphone.

## Install on a real phone

A phone can't reach `localhost` on your computer, so give the app an HTTPS address for the
server. Use either of these:

- The ngrok setup in the [main README](../README.md#remote-access-with-ngrok). If `DEPLOY_MODE`
  is `'ngrok'`, a plain `npm run build` already uses that tunnel.
- A server you host behind HTTPS.

Then build with that address:

```bash
SERVER_URL=https://your-server.example npm run build
```

### iPhone

1. Run `npm run open:ios` to open the project in Xcode.
2. Select the **App** target, open **Signing & Capabilities**, and choose your team. Any Apple ID
   works: add it under Xcode › Settings › Accounts. If Xcode reports that the bundle identifier
   is taken, change **Bundle Identifier** to one of your own, such as `com.yourname.stepwrite`.
3. Connect the iPhone with a cable, choose it as the run destination, and press Run.
4. On first install, turn on Developer Mode on the iPhone (Settings › Privacy & Security ›
   Developer Mode) and restart it when asked. Then trust your developer certificate under
   Settings › General › VPN & Device Management.

With a free Apple ID, the installed app keeps working for 7 days. After that, press Run in Xcode
again to renew it. A paid Apple Developer Program membership signs the app for a year and lets
you share it through TestFlight.

### Android

1. On the phone, turn on Developer options (tap Settings › About phone › Build number seven
   times), then turn on USB debugging.
2. Connect the phone with a cable and accept the debugging prompt.
3. Run `npm run android` and choose the phone.

To install without a cable, build an APK and copy it to the phone:

```bash
cd android && ./gradlew assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Open it on the phone
and allow installs from that source when Android asks. You can also install it over USB with
`adb install -r app/build/outputs/apk/debug/app-debug.apk`.

For Google Play, create a signed release bundle in Android Studio: Build › Generate Signed App
Bundle or APK.

## Microphone

StepWrite asks for the microphone the first time hands-free mode starts listening.

- **iPhone:** [`BridgeViewController.swift`](ios/App/App/BridgeViewController.swift) passes the web
  view's microphone request to iOS, which shows the prompt. The text in the prompt comes from
  `NSMicrophoneUsageDescription` in [`Info.plist`](ios/App/App/Info.plist).
- **Android:** the app declares `RECORD_AUDIO` in
  [`AndroidManifest.xml`](android/app/src/main/AndroidManifest.xml), and Capacitor shows the
  prompt.

If microphone access is off, the hands-free screen says so and offers Try again. Turn access back
on under Settings › StepWrite (iPhone) or Settings › Apps › StepWrite › Permissions (Android).

## Layout

Phones get StepWrite's regular layout; the watch layout is only for watch-sized screens. Both
apps keep the web view clear of the notch, the Dynamic Island, and the system bars. On iPhone,
[`SafeAreaViewController.swift`](ios/App/App/SafeAreaViewController.swift) does this. On Android,
Capacitor's SystemBars plugin does it (configured in `capacitor.config.json`).

## Debugging

- **Web inspector:** debug builds can be inspected. For the simulator or a cabled iPhone, use
  Safari's Develop menu. For Android, use `chrome://inspect` in Chrome on your computer.
- **Live reload:** add the block below to `capacitor.config.json`, run `npx cap copy`, and start
  the client with `REACT_APP_SERVER_URL=http://localhost:3001 npm start` in `client/`. Rebuild
  the app once, and from then on it loads the client from the dev server. For the Android
  emulator, also run `adb reverse tcp:3000 tcp:3000`. Remove the block before committing.

  ```json
  "server": { "url": "http://localhost:3000", "cleartext": true }
  ```

## App versions

Each app has a version shown to users and a build number. The native projects hold the
defaults, and any build can override them, which is how CI stamps each build.

| App | Version shown to users | Build number | Defaults in |
| --- | --- | --- | --- |
| iPhone | `MARKETING_VERSION` | `CURRENT_PROJECT_VERSION` | [`ios/App/App.xcodeproj/project.pbxproj`](ios/App/App.xcodeproj/project.pbxproj) |
| Android | `versionName` | `versionCode` | [`android/app/build.gradle`](android/app/build.gradle) (1.0 and 1) |

To stamp a build, pass the numbers on the command line. For Android, run this in `android/`
(the environment variables `ORG_GRADLE_PROJECT_versionName` and `ORG_GRADLE_PROJECT_versionCode`
work too):

```bash
./gradlew assembleRelease -PversionName=1.0.260 -PversionCode=260
```

For iPhone, run this in `ios/App` (this example builds without signing):

```bash
xcodebuild build -project App.xcodeproj -scheme App -configuration Release -destination generic/platform=iOS CODE_SIGNING_ALLOWED=NO MARKETING_VERSION=1.0.260 CURRENT_PROJECT_VERSION=260
```

Keep the build number rising. Android refuses to install an APK over one with a higher
`versionCode`.

To read the defaults from the repository root:

```bash
grep -m1 MARKETING_VERSION mobile/ios/App/App.xcodeproj/project.pbxproj
```

```bash
grep -E 'versionName|versionCode' mobile/android/app/build.gradle
```

## Icons

The app icons and launch screens use the StepWrite logo from
[`client/public/web-app-manifest-512x512.png`](../client/public/web-app-manifest-512x512.png) on a
white background. iPhone icons are in `ios/App/App/Assets.xcassets`. Android icons are in the
`mipmap-*` and `drawable-*` folders under `android/app/src/main/res`.

## Folder layout

```
mobile/
├── capacitor.config.json   app ID, name, web folder and status bar style
├── scripts/build.mjs       builds the client into www/ and copies it into both apps
├── ios/                    Xcode project (Swift Package Manager, no CocoaPods)
└── android/                Gradle project
```
