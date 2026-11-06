# Watch app tests

Unit tests for the parts of the watch app that are plain Swift and need no watch, such as how
[`VoiceCommand`](../StepWrite/VoiceCommand.swift) tells a spoken command from an answer. They run
on the Mac, in a few seconds:

```bash
swift test --package-path watch/Tests
```

This needs Xcode 16 or later, or a Swift 6 toolchain. GitHub runs the tests before every watch
build (see [App builds](../../docs/app-builds.md#tests)).

`Sources/StepWrite` holds symbolic links to the app's own files, so the tests check the same code
that the app is built from. To test another file, link it there too, from the repository root:

```bash
ln -s ../../../StepWrite/ServerSettings.swift watch/Tests/Sources/StepWrite/
```

Only files that build without watchOS-only frameworks such as WatchKit can be linked,
since the tests build for macOS.
