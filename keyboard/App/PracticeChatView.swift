import SwiftUI
import UIKit

/// A chat to try the keyboard in. Its text field hands the conversation to
/// keyboards through `conversationContext` (iOS 18.4), the way any messaging
/// app can. iOS gives that conversation only to Apple's own keyboard so far,
/// so the field also shares it with this app's keyboard through the App Group.
/// That shows what the keyboard does once it can see the conversation, which
/// is what the pitch asks Apple to allow.
struct PracticeChatView: View {
    @State private var messages = PracticeMessage.sample
    @State private var draft = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { scroller in
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(messages) { message in
                            Bubble(message: message)
                                .id(message.id)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 16)
                }
                .onChange(of: messages.count) {
                    withAnimation { scroller.scrollTo(messages.last?.id, anchor: .bottom) }
                }
            }

            HStack(alignment: .bottom, spacing: 8) {
                ComposeField(text: $draft, messages: messages)
                    .frame(minHeight: 36)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                Button {
                    send()
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityLabel("Send")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.bar)
        }
        .navigationTitle(PracticeMessage.friend)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        messages.append(PracticeMessage(text: text, isFromMe: true))
        draft = ""
    }
}

struct PracticeMessage: Identifiable, Equatable {
    static let friend = "Alex"

    let id = UUID()
    let text: String
    let isFromMe: Bool
    var sentAt = Date()

    static let sample = [
        PracticeMessage(text: "Hey! Are you still up for dinner on Friday?", isFromMe: false,
                        sentAt: Date().addingTimeInterval(-3_600)),
        PracticeMessage(text: "I think so! Where were you thinking?", isFromMe: true,
                        sentAt: Date().addingTimeInterval(-3_000)),
        PracticeMessage(text: "Luigi's at 7? Sam is coming too. Let me know if that works and whether I should book a table.",
                        isFromMe: false, sentAt: Date().addingTimeInterval(-600)),
    ]
}

private struct Bubble: View {
    let message: PracticeMessage

    var body: some View {
        HStack {
            if message.isFromMe { Spacer(minLength: 60) }
            Text(message.text)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .foregroundStyle(message.isFromMe ? .white : .primary)
                .background(message.isFromMe ? Brand.accent : Color(.secondarySystemBackground),
                            in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            if !message.isFromMe { Spacer(minLength: 60) }
        }
    }
}

/// A UITextView, since a SwiftUI text field can't give keyboards a conversation
private struct ComposeField: UIViewRepresentable {
    @Binding var text: String
    let messages: [PracticeMessage]

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.font = .preferredFont(forTextStyle: .body)
        view.adjustsFontForContentSizeCategory = true
        view.backgroundColor = .clear
        view.textContainerInset = UIEdgeInsets(top: 8, left: 0, bottom: 8, right: 0)
        view.delegate = context.coordinator
        view.textContentType = Brand.practiceChatField
        view.setContentHuggingPriority(.defaultLow, for: .horizontal)
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return view
    }

    /// One line to start with, growing with the text up to a few lines
    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        let width = proposal.width ?? 300
        let height = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude)).height
        return CGSize(width: width, height: min(height, 150))
    }

    func updateUIView(_ view: UITextView, context: Context) {
        if view.text != text {
            view.text = text
        }
        context.coordinator.textView = view
        if context.coordinator.sharedMessages != messages {
            context.coordinator.sharedMessages = messages
            if #available(iOS 18.4, *) {
                share(messages, from: view)
            }
            context.coordinator.shareWithKeyboard()
        }
    }

    /// Gives keyboards the conversation: who is in it, who the reply goes to,
    /// and the messages, each marked as sent by the user or not.
    @available(iOS 18.4, *)
    private func share(_ messages: [PracticeMessage], from view: UITextView) {
        let friendID = "alex"
        let selfID = "me"
        var friendName = PersonNameComponents()
        friendName.givenName = PracticeMessage.friend

        let conversation = UIMessageConversationContext()
        conversation.threadIdentifier = "practice-chat"
        conversation.selfIdentifiers = [selfID]
        conversation.responsePrimaryRecipientIdentifiers = [friendID]
        conversation.participantNameByIdentifier = [friendID: friendName]
        conversation.entries = messages.map { message in
            let entry = UIMessageConversationContext.MessageEntry()
            entry.entryIdentifier = message.id.uuidString
            entry.text = message.text
            entry.senderIdentifier = message.isFromMe ? selfID : friendID
            entry.primaryRecipientIdentifiers = [message.isFromMe ? friendID : selfID]
            entry.sentDate = message.sentAt
            entry.wasSentBySelf = message.isFromMe
            entry.dataKind = .text
            return entry
        }
        view.conversationContext = conversation
        // Tells a keyboard that is already showing
        view.inputDelegate?.conversationContext(conversation, didChange: view)
    }

    static func dismantleUIView(_ view: UITextView, coordinator: Coordinator) {
        coordinator.stopSharingWithKeyboard()
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        @Binding var text: String
        var sharedMessages: [PracticeMessage] = []
        weak var textView: UITextView?
        private var observers: [NSObjectProtocol] = []

        init(text: Binding<String>) {
            _text = text
            super.init()
            // Shared only while this app is in front, so the keyboard never
            // offers the practice chat in another app
            let center = NotificationCenter.default
            observers = [
                center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) {
                    [weak self] _ in MainActor.assumeIsolated { self?.stopSharingWithKeyboard() }
                },
                center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) {
                    [weak self] _ in MainActor.assumeIsolated { self?.shareWithKeyboard() }
                },
            ]
        }

        deinit {
            observers.forEach(NotificationCenter.default.removeObserver)
        }

        func textViewDidChange(_ textView: UITextView) {
            text = textView.text
        }

        func textViewDidBeginEditing(_ textView: UITextView) {
            shareWithKeyboard()
        }

        func textViewDidEndEditing(_ textView: UITextView) {
            stopSharingWithKeyboard()
        }

        /// Shares the chat with this app's keyboard while the field is being typed in
        func shareWithKeyboard() {
            guard let textView, textView.isFirstResponder else { return }
            let messages = sharedMessages.map { message in
                ConversationSnapshot.Message(sender: message.isFromMe ? "" : PracticeMessage.friend,
                                             text: message.text, isFromMe: message.isFromMe)
            }
            SharedStore.write(ConversationSnapshot(source: .conversation, messages: messages, title: PracticeMessage.friend),
                              to: .practiceChat)
            Signal.contextChanged.post()
        }

        func stopSharingWithKeyboard() {
            SharedStore.remove(.practiceChat)
            Signal.contextChanged.post()
        }
    }
}
