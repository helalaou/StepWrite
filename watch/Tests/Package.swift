// swift-tools-version: 6.0

// Unit tests for the watch app's code that doesn't need a watch. They run on
// the Mac with `swift test` (see README.md in this folder).
//
// Sources/StepWrite holds symbolic links to the app's files in
// ../StepWrite, so the tests always check the code the app is built from.

import PackageDescription

let package = Package(
    name: "StepWriteWatchTests",
    platforms: [.macOS(.v13)],
    targets: [
        .target(name: "StepWrite"),
        .testTarget(name: "VoiceCommandTests", dependencies: ["StepWrite"], path: "VoiceCommandTests"),
    ],
    // The app builds in Swift 5 mode (SWIFT_VERSION in the Xcode project).
    swiftLanguageModes: [.v5]
)
