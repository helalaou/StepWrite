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
| Apple Watch (simulator) | [StepWrite-watch-simulator.zip](https://github.com/helalaou/StepWrite/releases/latest/download/StepWrite-watch-simulator.zip) |

**A pull request's builds** are listed in a comment that the workflow keeps up to date on the pull
request. It shows each app's version, whether the app built and a download link. The same table is
on the summary page of every workflow run. These downloads need a GitHub sign-in, and GitHub keeps
them for 90 days.

## Versions

[`VERSION`](../VERSION) holds the major and minor version, such as `1.0`. Each build appends the
number of commits as the patch number, which is also the build number. The build of the 260th
commit is version 1.0.260 (build 260). Each new commit raises the number, so two builds never share
a version. To start a new major or minor version, edit `VERSION`.

## Installing, for free

### Web client

Unzip `StepWrite-web.zip` and serve the folder with any static file server, for example
`npx serve -s StepWrite-web`. The build calls the server at `http://localhost:3001`, so start the
server on the same computer (see [Getting started](../README.md#getting-started)).

### Apple Watch

- **In the watchOS simulator on a Mac:** unzip `StepWrite-watch-simulator.zip`, boot an Apple
  Watch simulator and drag `StepWrite.app` onto its window. Alternatively, run
  `xcrun simctl install booted StepWrite.app`. The simulator uses the Mac's microphone and speakers
  and calls the server at `http://localhost:3001`.
- **On your watch:** build it from source in Xcode, signed with your own Apple ID. A free Apple ID
  works. The steps are in [`watch/README.md`](../watch/README.md#install-on-your-watch). Builds from
  GitHub aren't signed, because signing needs your Apple ID.
