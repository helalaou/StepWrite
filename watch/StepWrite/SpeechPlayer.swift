import AVFoundation

/// Reads text aloud in the server's voice, the one the web app uses, or in the
/// watch's own voice when the server's speech can't be fetched or played.
@MainActor
final class SpeechPlayer {
    private var player: AVAudioPlayer?
    private let synthesizer = AVSpeechSynthesizer()

    /// Returns once `text` has been spoken. Cancelling the calling task stops it.
    func speak(_ text: String, using api: StepWriteAPI) async throws {
        defer { stop() }

        if let audio = try? await api.speech(for: text),
           let player = try? AVAudioPlayer(data: audio),
           player.play() {
            self.player = player
            while player.isPlaying {
                try await Task.sleep(for: .milliseconds(100))
            }
            return
        }

        try Task.checkCancellation()
        synthesizer.speak(AVSpeechUtterance(string: text))
        // isSpeaking only turns true once the voice has started
        try await Task.sleep(for: .milliseconds(300))
        while synthesizer.isSpeaking {
            try await Task.sleep(for: .milliseconds(100))
        }
    }

    func stop() {
        player?.stop()
        player = nil
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
    }
}
