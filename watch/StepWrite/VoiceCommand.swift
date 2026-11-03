import Foundation

/// Things the user can say instead of an answer. The phrases follow the web
/// app's hands-free commands (client/src/config.js). The whole utterance must
/// be the phrase, so an answer that merely mentions skipping is still an answer.
enum VoiceCommand {
    case skip
    case finish
    case repeatQuestion

    init?(transcription: String) {
        let spoken = Self.normalize(transcription)
        let match = Self.phrases.first { _, phrases in
            phrases.contains { Self.normalize($0) == spoken }
        }
        guard let command = match?.key else {
            return nil
        }
        self = command
    }

    private static let phrases: [VoiceCommand: [String]] = [
        .skip: [
            "skip", "skip question", "skip this question", "skip it",
            "next question", "skip to next question", "i want to skip this question",
        ],
        .finish: [
            "finish", "finish writing", "stop writing", "end writing", "finish here",
            "stop here", "end here", "i would like to stop here", "i'm done", "i am done",
        ],
        .repeatQuestion: [
            "repeat", "repeat question", "repeat the question", "say that again",
            "what was the question",
        ],
    ]

    /// Lower-cased words without punctuation (Whisper adds full stops and curly
    /// apostrophes) or articles, so "Skip the question." matches "skip question".
    private static func normalize(_ text: String) -> String {
        let kept = text.lowercased().unicodeScalars.filter {
            CharacterSet.alphanumerics.contains($0) || CharacterSet.whitespaces.contains($0)
        }
        return String(String.UnicodeScalarView(kept))
            .split(separator: " ")
            .filter { !["a", "an", "the"].contains($0) }
            .joined(separator: " ")
    }
}
