# App builds

Every push to `main` and every pull request builds each StepWrite app with GitHub Actions
([`.github/workflows/builds.yml`](../.github/workflows/builds.yml)). The workflow also runs the
server and client tests. GitHub's runners, including the macOS ones, are free for public
repositories, so the builds cost nothing.

## Getting a build

**The newest build of `main`** is on the
[latest release](https://github.com/helalaou/StepWrite/releases/tag/latest). Each push to `main`
replaces its files, once every app has built. The file names stay the same, so these links always
download the newest build:

| App | Download |
| --- | --- |
| Web client | [StepWrite-web.zip](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-web.zip) |
| Android | [StepWrite-android.apk](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-android.apk) |
| iPhone | [StepWrite-iphone-unsigned.ipa](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-iphone-unsigned.ipa) |
| iPhone (simulator) | [StepWrite-iphone-simulator.zip](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-iphone-simulator.zip) |
| Apple Watch (simulator) | [StepWrite-watch-simulator.zip](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-watch-simulator.zip) |

**A pull request's builds** are listed in a comment that the workflow keeps up to date on the pull
request. It shows each app's version, whether the app built and a download link. The same table is
on the summary page of every workflow run. These downloads need a GitHub sign-in, and GitHub keeps
them for 90 days.

## Versions

[`VERSION`](../VERSION) holds the major and minor version, such as `1.0`. Each build appends the
number of commits as the patch number, which is also the build number. The build of the 260th
commit is version 1.0.260 (build 260) in every app. Each new commit raises the number, so two
builds never share a version. To start a new major or minor version, edit `VERSION`.

## Installing, for free

### Web client

Unzip `StepWrite-web.zip` and serve the folder with any static file server, for example
`npx serve -s StepWrite-web`. The build calls the server at `http://localhost:3001`, so start the
server on the same computer (see [Getting started](../README.md#getting-started)).

### Android

Open `StepWrite-android.apk` on the phone. The first time, Android asks you to allow installing
apps from your browser or file manager. If the repository has an
[Android signing key](#android-signing-key), each new build installs over the last one. If it
doesn't, uninstall the old build first.

### iPhone

- **On your iPhone:** install `StepWrite-iphone-unsigned.ipa` with [AltStore](https://altstore.io)
  or [SideStore](https://sidestore.io). Both are free and sign the app with your own Apple ID.
  Alternatively, build the app from source in Xcode (see
  [`mobile/README.md`](../mobile/README.md#iphone)). With a free Apple ID, either way, the app
  keeps working for 7 days, and then you refresh or reinstall it.
- **In the iOS simulator on a Mac:** unzip `StepWrite-iphone-simulator.zip`, boot an iPhone
  simulator and drag `App.app` onto its window. Alternatively, run
  `xcrun simctl install booted App.app`.

### Apple Watch

- **In the watchOS simulator on a Mac:** unzip `StepWrite-watch-simulator.zip`, boot an Apple
  Watch simulator and drag `StepWrite.app` onto its window. Alternatively, run
  `xcrun simctl install booted StepWrite.app`. The simulator uses the Mac's microphone and speakers
  and calls the server at `http://localhost:3001`.
- **On your watch:** build it from source in Xcode, signed with your own Apple ID. A free Apple ID
  works. The steps are in [`watch/README.md`](../watch/README.md#install-on-your-watch). Builds from
  GitHub aren't signed, because signing needs your Apple ID.

## Repository settings

The workflow runs without any setup. Two optional settings make the phone builds work on real
phones. Both are free and live under the repository's **Settings > Secrets and variables >
Actions**.

### Server address

A phone can't reach a server on `localhost`, and the Android app accepts only HTTPS. To have the
phone builds call your server, add a **variable** named `STEPWRITE_SERVER_URL` with the server's
HTTPS address, such as your ngrok address (see
[Remote access with ngrok](../README.md#remote-access-with-ngrok)). Without it, the phone builds
use the web client's address, which suits the simulator and emulator.

### Android signing key

Android installs a new build over an old one only if both are signed with the same key. Without a
key in the repository's secrets, every build gets a new one-off key. To use one key for every
build, create it once:

```bash
keytool -genkeypair -keystore stepwrite-release.jks -storetype PKCS12 \
  -alias stepwrite -keyalg RSA -keysize 2048 -validity 10000
```

Then add four **secrets**:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The output of `base64 -i stepwrite-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | The password you gave keytool |
| `ANDROID_KEY_ALIAS` | `stepwrite` |
| `ANDROID_KEY_PASSWORD` | The same password, since a PKCS12 keystore uses one for both |

Keep `stepwrite-release.jks` and its password safe, and never commit them. Without the key, later
builds can't install over earlier ones.
