import AVFoundation

/// Reads text aloud in the server's voice, the one the web app uses, or in the
/// watch's own voice when the server's speech can't be fetched or played.
@MainActor
final class SpeechPlayer {
    private var player: AVAudioPlayer?
    private let synthesizer = AVSpeechSynthesizer()

    /// Returns once `text` has been spoken. `api` nil speaks in the watch's own
    /// voice, which works without the server. `cacheName` keeps the server's
    /// audio under that file name (see `StepWriteAPI.speech`). `onLevel` gets
    /// the output level, from 0 to 1, while the server's voice plays. `rate`
    /// is the reading speed, 1 being the voice's own. Cancelling the calling
    /// task stops the speech.
    func speak(
        _ text: String,
        using api: StepWriteAPI?,
        cacheName: String? = nil,
        rate: Float = 1,
        onLevel: (Float) -> Void = { _ in }
    ) async throws {
        defer {
            stop()
            onLevel(0)
        }

        if let api,
           let audio = try? await api.speech(for: text, cacheName: cacheName),
           let player = try? AVAudioPlayer(data: audio) {
            player.isMeteringEnabled = true
            // Faster or slower, in the same pitch
            player.enableRate = true
            player.rate = rate
            if player.play() {
                self.player = player
                while player.isPlaying {
                    try await Task.sleep(for: .milliseconds(50))
                    player.updateMeters()
                    onLevel(SpeechRecorder.normalized(player.averagePower(forChannel: 0)))
                }
                return
            }
        }

        try Task.checkCancellation()
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = min(max(AVSpeechUtteranceDefaultSpeechRate * rate, AVSpeechUtteranceMinimumSpeechRate),
                             AVSpeechUtteranceMaximumSpeechRate)
        synthesizer.speak(utterance)
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
