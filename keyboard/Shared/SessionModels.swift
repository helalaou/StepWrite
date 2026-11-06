import Foundation

/// The conversation a message replies to, as the keyboard, the Share extension
/// or a screenshot found it.
struct ConversationSnapshot: Codable, Equatable {
    enum Source: String, Codable, CaseIterable {
        /// The conversation the app gives keyboards (UITextInputTraits.conversationContext, iOS 18.4),
        /// or the practice chat
        case conversation
        /// A chat screenshot, read with Vision
        case screenshot
        /// Text shared to the keyboard's app from another app
        case shared
        /// Copied text, from the keyboard's Paste button
        case clipboard
        /// The text around the cursor
        case field
    }

    struct Message: Codable, Equatable {
        /// Who sent it; empty when unknown
        var sender: String
        var text: String
        var isFromMe: Bool
    }

    var source: Source
    /// Oldest first
    var messages: [Message]
    /// The chat's name, such as the other person's, when known
    var title: String?
    var capturedAt = Date()

    /// The most recent messages are what a reply needs.
    static let messagesSent = 10
    private static let charactersSent = 3_000

    /// The last message from someone else, which the reply answers
    var lastIncoming: Message? {
        messages.last { !$0.isFromMe } ?? messages.last
    }

    /// The server's `originalText`: the last messages, each after its sender's
    /// name, so the questions and the reply can refer to who said what.
    var replyText: String {
        let recent = messages.suffix(Self.messagesSent)
        let text: String
        if recent.count == 1, let only = recent.first, only.sender.isEmpty {
            text = only.text
        } else {
            text = recent.map { message in
                let sender = message.isFromMe ? "Me" : (message.sender.isEmpty ? "Them" : message.sender)
                return "\(sender): \(message.text)"
            }.joined(separator: "\n")
        }
        return String(text.suffix(Self.charactersSent))
    }

    /// Splits pasted or shared text into messages. Lines such as "Alex: See you
    /// at 7" keep their sender; other text is one message from the other person.
    static func messages(fromText text: String) -> [Message] {
        let lines = text.split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        let labelled = lines.compactMap { line -> Message? in
            guard let colon = line.firstIndex(of: ":") else { return nil }
            let sender = line[..<colon].trimmingCharacters(in: .whitespaces)
            let body = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            // A name is a few words, not a sentence or a time such as 7:30
            guard !sender.isEmpty, sender.split(separator: " ").count <= 3,
                  sender.first?.isLetter == true, !body.isEmpty else { return nil }
            let isMe = ["me", "i", "you"].contains(sender.lowercased())
            return Message(sender: isMe ? "" : sender, text: body, isFromMe: isMe)
        }
        if lines.count > 1, labelled.count == lines.count {
            return labelled
        }
        let whole = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return whole.isEmpty ? [] : [Message(sender: "", text: whole, isFromMe: false)]
    }
}

/// What the app's writing session is doing, which the keyboard shows. The app
/// writes it to the shared container on every change.
struct SessionState: Codable, Equatable {
    enum Phase: String, Codable {
        case idle
        /// Opening the microphone and getting the first question
        case starting
        /// Reading the question aloud
        case speaking
        /// Waiting for an answer
        case listening
        /// Hearing an answer
        case hearing
        case transcribing
        /// Waiting for the server's next question or the message
        case thinking
        case paused
        case finished
        case failed
    }

    /// One writing session; the keyboard inserts each session's message once
    var id = UUID()
    var phase: Phase = .idle
    /// The keyboard request that started it
    var requestID: UUID?
    var isReply = false
    /// The message being replied to, for showing
    var replyingTo: ConversationSnapshot.Message?
    var question: String?
    /// 1 for the first question
    var questionNumber = 0
    /// The last answer or command heard
    var heard: String?
    /// What the app last said about a command, such as "Skipping this question..."
    var feedback: String?
    /// The finished message
    var text: String?
    var error: String?
    /// The microphone stays on until then, so the keyboard can start writing
    /// without opening the app
    var microphoneOpenUntil: Date?
    var updatedAt = Date()

    var isActive: Bool {
        ![.idle, .finished, .failed].contains(phase)
    }
}

/// What the keyboard asks the app to do. The keyboard writes it to the shared
/// container, then posts `Signal.request` or opens the app with its link.
struct KeyboardRequest: Codable, Equatable {
    enum Action: String, Codable {
        /// Write a message, replying to `context` when there is one
        case start
        /// Reply to the conversation in the latest screenshot in Photos
        case startFromScreenshot
        case skip
        case finish
        case repeatQuestion
        case stop
        case retry
        case closeMicrophone
    }

    var id = UUID()
    var action: Action
    var context: ConversationSnapshot?
    var sentAt = Date()
}

/// What the keyboard last saw, so the app can tell the user whether setup is done
struct KeyboardStatus: Codable {
    var hasFullAccess: Bool
    var seenAt = Date()
}

/// How the app and the keyboard describe each phase
extension SessionState {
    var statusText: String {
        switch phase {
        case .idle: return "Ready"
        case .starting: return "Getting ready"
        case .speaking: return "Asking"
        case .listening: return "Listening"
        case .hearing: return "Hearing you"
        case .transcribing: return "Got it"
        case .thinking: return "Thinking"
        case .paused: return "Paused"
        case .finished: return "Message written"
        case .failed: return "Something went wrong"
        }
    }

    var statusSymbol: String {
        switch phase {
        case .idle: return "mic"
        case .starting, .thinking, .transcribing: return "ellipsis.circle"
        case .speaking: return "speaker.wave.2.fill"
        case .listening, .hearing: return "mic.fill"
        case .paused: return "pause.circle"
        case .finished: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }
}
