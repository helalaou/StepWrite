import Foundation
import Observation

/// Where this build's StepWrite server runs. Settings can name another.
enum ServerSettings {
#if targetEnvironment(simulator)
    /// The simulator shares the Mac's network, so it reaches the server started
    /// with `npm start` in server/.
    static let baseURL = URL(string: "http://localhost:3001")!
#else
    /// A real phone needs an HTTPS address it can reach: the server tunnel from
    /// client/src/config.js (NGROK.SERVER_URL), as in the watch app.
    static let baseURL = URL(string: "https://64908c6e5c4d.ngrok.app")!
#endif
}

/// The app's settings, with the watch app's defaults (watch/StepWrite/AppSettings.swift)
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
    /// Minutes the microphone stays on after writing, so the keyboard can start
    /// again without opening the app
    static let microphoneTimes: [Double] = [1, 5, 15, 30]

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

    var answerPause = AppSettings.store.object(forKey: "answerPause") as? Double ?? 1.2 {
        didSet { Self.store.set(answerPause, forKey: "answerPause") }
    }

    var repeatAfter = AppSettings.store.object(forKey: "repeatAfter") as? Double ?? 12 {
        didSet { Self.store.set(repeatAfter, forKey: "repeatAfter") }
    }

    var microphoneMinutes = AppSettings.store.object(forKey: "microphoneMinutes") as? Double ?? 5 {
        didSet { Self.store.set(microphoneMinutes, forKey: "microphoneMinutes") }
    }

    func reset() {
        serverURL = ServerSettings.baseURL
        voice = "nova"
        readingSpeed = 1
        answerPause = 1.2
        repeatAfter = 12
        microphoneMinutes = 5
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
