import Foundation
import Observation

/// What the watch's Settings screen changes, kept on the watch. The defaults
/// are the web app's (client/src/config.js), except where noted.
@MainActor
@Observable
final class AppSettings {
    static let shared = AppSettings()

    /// The voices the server speaks in (server/lib/tts.js)
    static let voices = ["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"]
    static let readingSpeeds: [Double] = [0.75, 1, 1.25, 1.5]
    /// Seconds of silence that end an answer
    static let answerPauses: [Double] = [0.6, 1, 1.2, 1.5, 2, 3]
    /// Seconds of silence before an unanswered question is asked again; 0 is never
    static let repeatDelays: [Double] = [8, 12, 20, 30, 0]

    @ObservationIgnored private static let store = UserDefaults.standard

    var serverURL = AppSettings.store.url(forKey: "serverURL") ?? ServerSettings.baseURL {
        didSet { Self.store.set(serverURL, forKey: "serverURL") }
    }

    var voice = AppSettings.store.string(forKey: "voice").flatMap { AppSettings.voices.contains($0) ? $0 : nil } ?? "nova" {
        didSet { Self.store.set(voice, forKey: "voice") }
    }

    var readingSpeed = AppSettings.store.object(forKey: "readingSpeed") as? Double ?? 1 {
        didSet { Self.store.set(readingSpeed, forKey: "readingSpeed") }
    }

    /// 1.2 s rather than the web app's 1 s: the watch tells speech from
    /// silence by loudness alone, which needs a little more margin.
    var answerPause = AppSettings.store.object(forKey: "answerPause") as? Double ?? 1.2 {
        didSet { Self.store.set(answerPause, forKey: "answerPause") }
    }

    var repeatAfter = AppSettings.store.object(forKey: "repeatAfter") as? Double ?? 12 {
        didSet { Self.store.set(repeatAfter, forKey: "repeatAfter") }
    }

    /// Taps on the wrist (and their sounds) for listening, pausing, success and errors
    var haptics = AppSettings.store.object(forKey: "haptics") as? Bool ?? true {
        didSet { Self.store.set(haptics, forKey: "haptics") }
    }

    /// Writing starts as the app opens, so it can be used without touching it.
    var startsOnLaunch = AppSettings.store.object(forKey: "startsOnLaunch") as? Bool ?? true {
        didSet { Self.store.set(startsOnLaunch, forKey: "startsOnLaunch") }
    }

    func reset() {
        serverURL = ServerSettings.baseURL
        voice = "nova"
        readingSpeed = 1
        answerPause = 1.2
        repeatAfter = 12
        haptics = true
        startsOnLaunch = true
    }

    /// The address typed in Settings as a server URL, without trailing slashes,
    /// or nil when it isn't an http(s) address
    static func serverURL(from text: String) -> URL? {
        var trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        while trimmed.hasSuffix("/") { trimmed.removeLast() }
        guard let url = URL(string: trimmed),
              let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http",
              url.host?.isEmpty == false else {
            return nil
        }
        return url
    }
}
