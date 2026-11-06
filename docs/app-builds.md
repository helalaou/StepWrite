# App builds

GitHub Actions builds the StepWrite server and every app straight from the code, so nothing is
built by hand. GitHub's runners, including the macOS ones, are free for public repositories, and
so are code scanning and Dependabot, so all of this costs nothing.

| Workflow | Runs on | What it does |
| --- | --- | --- |
| [Builds](../.github/workflows/builds.yml) | Every push to `main`, every version tag, every pull request | Runs the tests, then builds and packages the server and every app. Publishes them as releases. |
| [Lint workflows](../.github/workflows/lint.yml) | Changes to `.github/workflows` | Checks the workflows with [actionlint](https://github.com/rhysd/actionlint) |
| [CodeQL](../.github/workflows/codeql.yml) | Every push to `main`, every pull request, weekly | Scans the code for security problems ([Code scanning](#code-scanning)) |
| [Dependabot](../.github/dependabot.yml) | Weekly | Opens pull requests that update dependencies ([Dependency updates](#dependency-updates)) |

## Getting a build

Every file is on a release, under the same name in every release:

- **The newest version** is on the
  [latest release](https://github.com/helalaou/StepWrite/releases/latest), made from the newest
  [version tag](#releasing-a-version). These links work once the first version is released.
- **The newest build of `main`** is on the
  [`latest` prerelease](https://github.com/helalaou/StepWrite/releases/tag/latest). Each push to
  `main` replaces its files, once everything has built.

| App | Newest version | Newest build of `main` |
| --- | --- | --- |
| Server | [StepWrite-server.zip](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-server.zip) | [StepWrite-server.zip](https://github.com/helalaou/StepWrite/releases/download/latest/StepWrite-server.zip) |
| Web client | [StepWrite-web.zip](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-web.zip) | [StepWrite-web.zip](https://github.com/helalaou/StepWrite/releases/download/latest/StepWrite-web.zip) |
| Android | [StepWrite-android.apk](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-android.apk) | [StepWrite-android.apk](https://github.com/helalaou/StepWrite/releases/download/latest/StepWrite-android.apk) |
| iPhone | [StepWrite-iphone-unsigned.ipa](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-iphone-unsigned.ipa) | [StepWrite-iphone-unsigned.ipa](https://github.com/helalaou/StepWrite/releases/download/latest/StepWrite-iphone-unsigned.ipa) |
| iPhone (simulator) | [StepWrite-iphone-simulator.zip](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-iphone-simulator.zip) | [StepWrite-iphone-simulator.zip](https://github.com/helalaou/StepWrite/releases/download/latest/StepWrite-iphone-simulator.zip) |
| Apple Watch (simulator) | [StepWrite-watch-simulator.zip](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-watch-simulator.zip) | [StepWrite-watch-simulator.zip](https://github.com/helalaou/StepWrite/releases/download/latest/StepWrite-watch-simulator.zip) |

The two kinds of link differ only in word order: `releases/latest/download/` is the newest version,
and `releases/download/latest/` is the newest build of `main`.

**A pull request's builds** are listed in a comment that the workflow keeps up to date on the pull
request. It shows each build's version, whether it built and a download link. The same table is on
the summary page of every workflow run. These downloads need a GitHub sign-in, and GitHub keeps
them for 90 days.

## Tests

Before it builds, the Builds workflow runs:

- the server's tests (`npm test` in `server/`)
- the web client's tests (`npm test` in `client/`), where lint warnings also fail the build
- the watch app's tests of its voice commands (`swift test --package-path watch/Tests`; see
  [`watch/Tests`](../watch/Tests/README.md))
- a start-up check of the packaged server: it unzips `StepWrite-server.zip`, starts it with a
  placeholder OpenAI key and checks that it answers. Nothing reaches OpenAI.

A failed test fails that build, and nothing is released.

## Versions

[`VERSION`](../VERSION) holds the major and minor version, such as `1.0`. Each build of `main` or
of a pull request appends the number of commits as the patch number, which is also the build
number. The build of the 260th commit is version 1.0.260 (build 260) in every app. Each new commit
raises the number, so two builds never share a version.

### Releasing a version

To release a version, tag a commit on `main` with `v` and the version, and push the tag:

```bash
git tag v1.1.0
```

```bash
git push origin v1.1.0
```

Creating a release with a new tag on GitHub's **Releases** page does the same. The workflow builds
every app as version 1.1.0, still with the commit count as the build number, so Android installs it
over earlier builds. It then publishes the release "StepWrite 1.1.0" with every file and a list of
the changes since the previous version, and GitHub marks it as the latest release. If the release
already exists because you made it on GitHub, it keeps your title and notes and gets the files.

Tags must look like `v1.1.0`, with three numbers. After releasing a new major or minor version,
set `VERSION` to it (here `1.1`), so the builds of `main` that follow are numbered after it. The
workflow warns when `VERSION` is behind the tag.

## Installing, for free

### Server

The other apps need a running server. It needs [Node.js](https://nodejs.org) 22 or later.
Unzip `StepWrite-server.zip`, which already includes the server's dependencies.
Then, in the `StepWrite-server` folder:

1. Copy `.env.template` to `.env` and put your OpenAI API key in it.
2. Run `npm start`.

The server runs at `http://localhost:3001`. The zip leaves out the server's tests and the
developer's `data/user_memories.json`. To use the memory feature, which is off by default, add your
own file there in the same format.

### Web client

Unzip `StepWrite-web.zip` and serve the folder with any static file server, for example
`npx serve -s StepWrite-web`. The build calls the server at `http://localhost:3001`, so start the
[server](#server) on the same computer.

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

## Checks

### Workflow lint

The Lint workflows workflow runs actionlint, with shellcheck for the `run:` scripts, on every change
to the workflows. To run the same check before you push, install actionlint (for example
`brew install actionlint`) and run `actionlint` in the repository.

### Code scanning

The CodeQL workflow scans the JavaScript (server, web client and `mobile/scripts`), the Android
app's Java code and the workflows. It doesn't scan the Swift code, because CodeQL can read Swift
only by building it on macOS. Findings appear under the repository's **Security > Code scanning**
and on the lines a pull request changes.

This workflow replaces CodeQL's "default setup", and GitHub doesn't accept results from both. Leave
default setup off under **Settings > Advanced Security > Code scanning**.

### Dependency updates

Each week, Dependabot opens pull requests that update the GitHub Actions in the workflows, the npm
packages in the repository root, `server/`, `client/` and `mobile/`, and the Android project's
Gradle dependencies. Minor and patch updates in a folder come together in one pull request, and
major updates one at a time. Major versions of Capacitor, and of the Android dependencies that
Capacitor's template sets, are left out: upgrade those with Capacitor's `npx cap migrate`.

Each update pull request is built and tested like any other, so check its build comment before you
merge it. For alerts about known vulnerabilities and pull requests that fix them, also turn on
**Dependabot alerts** and **Dependabot security updates** under
**Settings > Advanced Security**. Both are free.

## Repository settings

The workflows run without any setup. A few optional settings, all free, make the builds more
useful. Secrets and variables live under the repository's **Settings > Secrets and variables >
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

Dependabot's pull requests can't read these secrets, so their APKs use a one-off key. To sign
those with your key too, add the same four secrets under **Settings > Secrets and variables >
Dependabot**.

### Releases

The newest build of `main` replaces the files of the same `latest` prerelease on every push. That
needs release immutability off (**Settings > General > Releases**), as it is by default. With it
on, GitHub refuses to change a published release.
