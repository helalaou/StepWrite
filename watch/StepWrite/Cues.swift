import AVFoundation
import WatchKit

/// Sounds and taps on the wrist that tell the user what is happening without
/// looking at the watch.
@MainActor
enum Cues {
    /// The web app's click (client/public/click.mp3), played when a command is
    /// recognized and when the next question comes up
    static func click() async {
        WKInterfaceDevice.current().play(.click)
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
        WKInterfaceDevice.current().play(.start)
        try? await Task.sleep(for: .milliseconds(600))
    }

    static func paused() {
        WKInterfaceDevice.current().play(.stop)
    }

    static func success() {
        WKInterfaceDevice.current().play(.success)
    }

    static func failure() {
        WKInterfaceDevice.current().play(.failure)
    }
}
