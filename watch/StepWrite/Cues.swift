import AVFoundation
import WatchKit

/// Sounds and taps on the wrist that tell the user what is happening without
/// looking at the watch. Settings can turn the taps off; the click stays.
@MainActor
enum Cues {
    private static var device: WKInterfaceDevice? {
        AppSettings.shared.haptics ? .current() : nil
    }

    /// The web app's click (client/public/click.mp3), played when a command is
    /// recognized and when the next question comes up
    static func click() async {
        device?.play(.click)
        guard let url = Bundle.main.url(forResource: "click", withExtension: "mp3"),
              let player = try? AVAudioPlayer(contentsOf: url),
              player.play() else {
            return
        }
        while player.isPlaying {
            do {
                try await Task.sleep(for: .milliseconds(50))
            } catch {
                player.stop()
                return
            }
        }
    }

    /// The microphone is about to open for an answer. Returns once the tap's
    /// sound is over, or the microphone would hear it and send it as the answer.
    static func listening() async {
        guard let device else { return }
        device.play(.start)
        try? await Task.sleep(for: .milliseconds(600))
    }

    static func paused() {
        device?.play(.stop)
    }

    static func success() {
        device?.play(.success)
    }

    static func failure() {
        device?.play(.failure)
    }
}
