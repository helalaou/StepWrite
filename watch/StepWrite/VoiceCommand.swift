import Foundation

/// Things the user can say instead of an answer. The phrases are the web app's
/// hands-free commands (`handsFree.commands` in client/src/config.js), plus a
/// few short ones that are natural on a watch, such as "skip" and "go back".
enum VoiceCommand: CaseIterable {
    // While answering questions
    case pause
    /// Only listened for while paused
    case resume
    case finish
    case modify
    case next
    case previous
    case skip
    /// Opens the finished text, or the draft written so far
    case showText
    case home
    case repeatQuestion

    // While the text is shown
    case readAgain
    case stopReading
    case backToQuestions
    case endWriting

    /// The commands that work on the question screen
    static let questionCommands: [VoiceCommand] = [
        .pause, .finish, .modify, .next, .previous, .skip, .showText, .home, .repeatQuestion,
    ]
    static let textCommands: [VoiceCommand] = [.readAgain, .stopReading, .backToQuestions, .endWriting]

    /// The command among `candidates` that the transcription asks for, or nil
    /// if it is an answer.
    ///
    /// Like the web app's FUZZY mode, a phrase matches when at least 85% of its
    /// words were spoken, so "skip this question, please" still skips. Two
    /// rules keep answers from being taken for commands: the utterance may be
    /// only a little longer than the phrase (not at all for one-word phrases,
    /// so "Next Tuesday" is an answer), and when several commands match, the
    /// one with the longest matching phrase wins ("skip to next question" is a
    /// skip, not "next question").
    static func match(_ transcription: String, among candidates: [VoiceCommand]) -> VoiceCommand? {
        let spoken = words(of: transcription)
        guard !spoken.isEmpty else { return nil }
        let spokenSet = Set(spoken)

        var best: (command: VoiceCommand, length: Int)?
        for command in candidates {
            for phrase in command.phrases {
                let phraseWords = words(of: phrase)
                let extraWordsAllowed = min(phraseWords.count - 1, 2)
                guard !phraseWords.isEmpty, spoken.count <= phraseWords.count + extraWordsAllowed else { continue }
                let heard = phraseWords.filter(spokenSet.contains).count
                if Double(heard) / Double(phraseWords.count) >= 0.85,
                   phraseWords.count > (best?.length ?? 0) {
                    best = (command, phraseWords.count)
                }
            }
        }
        return best?.command
    }

    /// Lower-cased words without punctuation (Whisper adds full stops and curly
    /// apostrophes) or articles, as the web app compares them.
    private static func words(of text: String) -> [String] {
        let kept = text.lowercased().unicodeScalars.filter {
            CharacterSet.alphanumerics.contains($0) || CharacterSet.whitespacesAndNewlines.contains($0)
        }
        return String(String.UnicodeScalarView(kept))
            .split(whereSeparator: \.isWhitespace)
            .map(String.init)
            .filter { !["a", "an", "the"].contains($0) }
    }

    private var phrases: [String] {
        switch self {
        case .pause:
            return [
                "pause", "pause flow", "pause writing", "pause the writing", "pause test", "pause the test",
                "pause the flow", "stop listening", "stop the listening", "take a break", "take a short break",
                "take a quick break", "pause for a moment", "pause for a minute", "pause for a second",
                "pause for a while", "pause for now", "pause for the moment",
            ]
        case .resume:
            return [
                "continue", "resume", "continue writing", "continue the writing", "resume writing",
                "resume the writing", "resume test", "resume the test", "resume flow", "resume the flow",
                "start the listening", "continue please", "resume please", "continue now", "resume now",
                "continue the test", "continue the flow",
            ]
        case .finish:
            return [
                "finish", "stop writing", "finish writing", "i would like to stop here", "stop here",
                "finish here", "end writing", "end here", "lets stop here", "let us stop here",
                "i want to stop here", "i want to finish here", "i want to end here", "stop the writing",
                "finish the writing", "end the writing",
            ]
        case .modify:
            return [
                "change my answer", "change my response", "i want to change my answer",
                "i want to change my response", "i want to modify my answer", "i want to modify my response",
                "i want to edit my answer", "i want to edit my response", "modify answer", "modify response",
                "modify question", "modify this question", "modify this response", "modify this answer",
                "i want to modify this question", "i want to modify this response", "i want to modify this answer",
                "change this question", "change this response", "change this answer",
                "i want to change this question", "i want to change this response", "i want to change this answer",
                "edit this question", "edit this response", "edit this answer", "i want to edit this question",
                "i want to edit this response", "i want to edit this answer",
            ]
        case .next:
            return [
                "next", "next question", "go to next question", "move to next question",
                "proceed to next question", "continue to next question", "go to the next question",
                "move to the next question", "proceed to the next question", "continue to the next question",
                "next question please", "go to next question please", "move to next question please",
                "proceed to next question please", "continue to next question please",
            ]
        case .previous:
            return [
                "go back", "previous question", "go to previous question", "move to previous question",
                "go back to previous question", "return to previous question", "go to the previous question",
                "move to the previous question", "go back to the previous question",
                "return to the previous question", "previous question please", "go to previous question please",
                "move to previous question please", "go back to previous question please",
                "return to previous question please",
            ]
        case .skip:
            return [
                "skip", "skip it", "skip question", "skip this question", "i want to skip this question",
                "skip to next question", "skip to the next question", "i want to skip to next question",
                "skip this and continue", "skip this question and continue", "skip this and move on",
                "skip this question and move on",
            ]
        case .showText:
            return [
                "show draft", "show me the draft", "display draft", "i want to see the draft",
                "i want to see the background draft", "go to editor", "open editor", "move to editor",
                "switch to editor", "back to editor", "return to editor", "go to editor please",
                "open editor please", "move to editor please", "switch to editor please",
                "back to editor please", "return to editor please",
            ]
        case .home:
            return [
                "go to home", "go to home page", "go to homepage", "return to home", "return to home page",
                "return to homepage", "back to home", "back to home page", "back to homepage",
                "go to landing page", "return to landing page", "back to landing page",
            ]
        case .repeatQuestion:
            return [
                "repeat", "repeat question", "repeat the question", "say that again", "what was the question",
            ]
        case .readAgain:
            return [
                "play that again", "play it again", "play the audio again", "play the recording again",
                "play the speech again", "play the text again", "play that again please", "play it again please",
                "play the audio again please", "play the recording again please", "play the speech again please",
                "play the text again please", "read that again", "read it again", "read the text again",
                "read that again please", "read it again please", "read the text again please",
                "speak that again", "speak it again", "speak the text again", "speak that again please",
                "speak it again please", "speak the text again please",
            ]
        case .stopReading:
            return [
                "stop speaking", "stop talking", "stop the speaking", "stop reading", "stop the reading",
                "stop the talking", "stop audio", "stop the audio", "stop playback", "stop the playback",
                "stop speaking please", "stop the speaking please", "stop reading please",
                "stop the reading please", "stop talking please", "stop the talking please", "stop audio please",
                "stop the audio please", "stop playback please", "stop the playback please", "be quiet",
                "be quiet please", "silence", "silence please",
            ]
        case .backToQuestions:
            return [
                "go back to questions", "return to questions", "go back to questions view",
                "return to questions view", "go back to questions please", "return to questions please",
                "go back to questions view please", "return to questions view please",
            ]
        case .endWriting:
            return [
                "end writing", "finish writing", "end the writing", "finish the writing", "save writing",
                "save and finish", "save and exit", "finish and save",
            ]
        }
    }
}
