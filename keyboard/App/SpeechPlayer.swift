import AVFoundation

/// Reads text aloud in the server's voice, the one the web app uses, or in the
/// phone's own voice when the server's speech can't be fetched or played
/// (watch/StepWrite/SpeechPlayer.swift).
@MainActor
final class SpeechPlayer {
    private var player: AVAudioPlayer?
    private let synthesizer = AVSpeechSynthesizer()

    /// Returns once `text` has been spoken. `api` nil speaks in the phone's own
    /// voice, which works without the server. `cacheName` keeps the server's
    /// audio under that file name (see `StepWriteAPI.speech`). `rate` is the
    /// reading speed, 1 being the voice's own. Cancelling the calling task
    /// stops the speech.
    func speak(_ text: String, using api: StepWriteAPI?, cacheName: String? = nil, rate: Float = 1) async throws {
        defer { stop() }

        if let api,
           let audio = try? await api.speech(for: text, cacheName: cacheName),
           let player = try? AVAudioPlayer(data: audio) {
            // Faster or slower, in the same pitch
            player.enableRate = true
            player.rate = rate
            if player.play() {
                self.player = player
                while player.isPlaying {
                    try await Task.sleep(for: .milliseconds(50))
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

/// Sounds that tell the user what is happening without looking at the phone,
/// which is in their hand showing a chat, not this app.
@MainActor
enum Cues {
    private static var player: AVAudioPlayer?

    /// The web app's click (client/public/click.mp3), played when a command is
    /// recognized and when the next question comes up
    static func click() async {
        guard let url = Bundle.main.url(forResource: "click", withExtension: "mp3") else { return }
        await play(try? AVAudioPlayer(contentsOf: url))
    }

    /// Two rising notes: the microphone is listening for the answer. Returns
    /// once they are over, so the microphone doesn't hear them.
    static func listening() async {
        await play(try? AVAudioPlayer(data: tones([880, 1_320])))
    }

    /// The message is written
    static func success() async {
        await play(try? AVAudioPlayer(data: tones([660, 880, 1_320])))
    }

    /// Two falling notes
    static func failure() async {
        await play(try? AVAudioPlayer(data: tones([440, 330])))
    }

    private static func play(_ newPlayer: AVAudioPlayer?) async {
        guard let newPlayer, newPlayer.play() else { return }
        player = newPlayer
        while newPlayer.isPlaying {
            do {
                try await Task.sleep(for: .milliseconds(30))
            } catch {
                newPlayer.stop()
                return
            }
        }
    }

    /// Short soft sine notes, one after another, as WAV data
    private static func tones(_ frequencies: [Double], noteLength: Double = 0.09) -> Data {
        let rate = 22_050.0
        let count = Int(rate * noteLength)
        var samples: [Float] = []
        for frequency in frequencies {
            for index in 0..<count {
                let time = Double(index) / rate
                // Fade in and out so the notes don't click
                let envelope = sin(Double.pi * Double(index) / Double(count))
                samples.append(Float(sin(2 * Double.pi * frequency * time) * envelope * 0.25))
            }
        }
        return WAV.data(samples: samples, sampleRate: rate)
    }
}
