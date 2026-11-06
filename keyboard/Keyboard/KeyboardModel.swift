import Observation
import UIKit

/// What the keyboard knows: the conversation it can see, the app's writing
/// session, and whether it has Full Access.
@MainActor
@Observable
final class KeyboardModel {
    /// What the message replies to
    enum Choice: Equatable {
        case reply(ConversationSnapshot.Source)
        /// The newest screenshot in Photos, which the app reads
        case latestScreenshot
        case newMessage
    }

    enum Screen: Equatable {
        case fullAccess
        case start
        case connecting
        case writing
        case failed
        case done
    }

    private(set) var session: SessionState?
    /// What the message could reply to, best first
    private(set) var contexts: [ConversationSnapshot] = []
    private(set) var choice: Choice = .newMessage
    private(set) var hasFullAccess = false
    private(set) var needsInputModeSwitchKey = false
    private(set) var isConnecting = false
    /// A short problem to show, such as the app not opening
    private(set) var notice: String?
    /// The message this keyboard put in the text field, for Undo
    private(set) var insertedText: String?
    /// Whether the app answers pings. A session the app left behind when it
    /// was closed still says it is listening, so it is shown only while the
    /// app answers.
    private(set) var appIsRunning = true

    @ObservationIgnored private weak var controller: KeyboardViewController?
    @ObservationIgnored private var observers: [SignalObserver] = []
    @ObservationIgnored private var refreshTimer: Timer?
    /// The request waiting for the app to answer a ping
    @ObservationIgnored private var pendingRequest: UUID?
    @ObservationIgnored private var lastRequest: UUID?
    @ObservationIgnored private var connectingSince: Date?
    @ObservationIgnored private var appearedAt = Date()
    /// What was pasted with the Paste button
    @ObservationIgnored private var pasted: ConversationSnapshot?
    @ObservationIgnored private var appAnsweredAt: Date?
    @ObservationIgnored private var userChose = false
    @ObservationIgnored private var dismissedFailure: UUID?
    @ObservationIgnored private let defaults = UserDefaults.standard
    private static let insertedSessionKey = "insertedSessionID"

    init(controller: KeyboardViewController) {
        self.controller = controller
    }

    var screen: Screen {
        if !hasFullAccess { return .fullAccess }
        if let session, session.isActive, appIsRunning { return .writing }
        if isConnecting { return .connecting }
        if let session, session.phase == .failed, session.requestID == lastRequest,
           session.id != dismissedFailure {
            return .failed
        }
        if insertedText != nil { return .done }
        return .start
    }

    var selectedContext: ConversationSnapshot? {
        guard case .reply(let source) = choice else { return nil }
        return contexts.first { $0.source == source }
    }

    /// The microphone is on in the app, which shows the orange dot
    var isMicrophoneOn: Bool {
        guard let session, appIsRunning else { return false }
        return session.isActive || (session.microphoneOpenUntil ?? .distantPast) > Date()
    }

    var returnKeyLabel: String {
        switch controller?.textDocumentProxy.returnKeyType {
        case .send: return "send"
        case .go: return "go"
        case .search: return "search"
        case .done: return "done"
        case .next: return "next"
        default: return "return"
        }
    }

    // MARK: - Showing and hiding

    func appear() {
        guard let controller else { return }
        hasFullAccess = controller.hasFullAccess
        needsInputModeSwitchKey = controller.needsInputModeSwitchKey
        notice = nil
        appearedAt = Date()
        if hasFullAccess {
            // Tells the app's setup screen that Full Access is on
            SharedStore.write(KeyboardStatus(hasFullAccess: true), to: .keyboardStatus)
        }
        observers = [
            SignalObserver(.sessionChanged) { [weak self] in self?.reloadSession() },
            SignalObserver(.pong) { [weak self] in self?.appAnswered() },
            SignalObserver(.contextChanged) { [weak self] in self?.refreshContext() },
        ]
        // In case a notification was missed while the keyboard was hidden
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.reloadSession() }
        }
        reloadSession()
        refreshContext()
    }

    func disappear() {
        observers = []
        refreshTimer?.invalidate()
        refreshTimer = nil
    }

    // MARK: - Context

    /// Collects what the message could reply to, best first: the chat the app
    /// shares, something shared or a screenshot read for the keyboard, pasted
    /// text, then the text around the cursor.
    ///
    /// iOS doesn't pass `conversationContext` on to other companies' keyboards
    /// yet (tried on iOS 27.2: the proxy has none and no change is delivered),
    /// so it is read in case that changes, and the practice chat in the app
    /// also shares its messages through the App Group.
    func refreshContext() {
        guard let proxy = controller?.textDocumentProxy else { return }
        var found: [ConversationSnapshot] = []

        if #available(iOS 18.4, *), let conversation = proxy.conversationContext ?? nil,
           let snapshot = ConversationSnapshot(conversation) {
            found.append(snapshot)
        } else if hasFullAccess, proxy.textContentType == Brand.practiceChatField,
                  let practice = SharedStore.read(ConversationSnapshot.self, from: .practiceChat) {
            found.append(practice)
        }
        if hasFullAccess, let shared = SharedStore.read(ConversationSnapshot.self, from: .sharedContext),
           Date().timeIntervalSince(shared.capturedAt) < 30 * 60 {
            found.append(shared)
        }
        if let pasted, let text = pasted.messages.last?.text, !isOwnMessage(text) {
            found.append(pasted)
        }
        let field = [proxy.documentContextBeforeInput, proxy.selectedText, proxy.documentContextAfterInput]
            .compactMap { $0 }
            .joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !field.isEmpty, !isOwnMessage(field) {
            found.append(ConversationSnapshot(source: .field, messages: ConversationSnapshot.messages(fromText: field)))
        }

        contexts = found
        let stillThere: Bool
        switch choice {
        case .reply(let source): stillThere = found.contains { $0.source == source }
        case .latestScreenshot, .newMessage: stillThere = true
        }
        if !userChose || !stillThere {
            choice = found.first.map { .reply($0.source) } ?? .newMessage
            userChose = false
        }
    }

    func choose(_ newChoice: Choice) {
        choice = newChoice
        userChose = true
    }

    /// Text from the Paste button. iOS refuses a keyboard's own clipboard
    /// reads, even with Full Access ("Operation not authorized"), but the
    /// system Paste button hands the text over when it is tapped.
    func paste(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        pasted = ConversationSnapshot(source: .clipboard, messages: ConversationSnapshot.messages(fromText: trimmed))
        refreshContext()
        choose(.reply(.clipboard))
    }

    /// Whether `text` is, or holds, the message StepWrite just wrote, which is
    /// nothing to reply to
    private func isOwnMessage(_ text: String) -> Bool {
        guard let written = insertedText ?? session?.text else { return false }
        let start = String(written.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40))
        return !start.isEmpty && text.contains(start)
    }

    // MARK: - Requests to the app

    func start() {
        notice = nil
        insertedText = nil
        switch choice {
        case .reply:
            send(KeyboardRequest(action: .start, context: selectedContext))
        case .latestScreenshot:
            send(KeyboardRequest(action: .startFromScreenshot))
        case .newMessage:
            send(KeyboardRequest(action: .start))
        }
    }

    func send(_ action: KeyboardRequest.Action) {
        send(KeyboardRequest(action: action))
    }

    func dismissFailure() {
        dismissedFailure = session?.id
    }

    func newMessage() {
        insertedText = nil
        refreshContext()
    }

    /// Writes the request, then asks whether the app is listening. If it
    /// answers, it reads the request at once; otherwise the keyboard opens it.
    private func send(_ request: KeyboardRequest) {
        guard SharedStore.write(request, to: .request) else {
            notice = "The keyboard can't reach \(Brand.name). Check that Full Access is on."
            return
        }
        lastRequest = request.id
        pendingRequest = request.id
        if [.start, .startFromScreenshot, .retry].contains(request.action) {
            isConnecting = true
            connectingSince = Date()
        }
        Signal.ping.post()
        Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard pendingRequest == request.id else { return }
            pendingRequest = nil
            openApp()
        }
    }

    private func appAnswered() {
        appAnsweredAt = Date()
        if !appIsRunning {
            appIsRunning = true
        }
        guard pendingRequest != nil else { return }
        pendingRequest = nil
        Signal.request.post()
    }

    private func openApp() {
        guard let url = URL(string: "\(Brand.urlScheme)://request"),
              controller?.openContainingApp(url) == true else {
            isConnecting = false
            notice = "Open the \(Brand.name) app to start."
            return
        }
    }

    /// Opens the app to finish setting up
    func openSetup() {
        if let url = URL(string: "\(Brand.urlScheme)://setup") {
            _ = controller?.openContainingApp(url)
        }
    }

    // MARK: - The app's session

    private func reloadSession() {
        guard hasFullAccess else { return }
        let latest = SharedStore.read(SessionState.self, from: .session)
        if latest != session {
            session = latest
        }
        checkAppIsRunning()
        if isConnecting {
            if let latest, latest.requestID == lastRequest, latest.phase != .idle {
                isConnecting = false
            } else if let connectingSince, Date().timeIntervalSince(connectingSince) > 20 {
                isConnecting = false
                notice = "\(Brand.name) didn't start. Open the app and try again."
            }
        }
        insertIfFinished()
    }

    /// Asks the app to answer while the session says it is writing or has the
    /// microphone on, allowing a moment for the first answer
    private func checkAppIsRunning() {
        guard let session, session.isActive || (session.microphoneOpenUntil ?? .distantPast) > Date() else {
            return
        }
        Signal.ping.post()
        let lastHeard = max(appAnsweredAt ?? .distantPast, appearedAt)
        let running = Date().timeIntervalSince(lastHeard) < 3
        if running != appIsRunning {
            appIsRunning = running
        }
    }

    /// Puts each finished message in the text field once
    private func insertIfFinished() {
        guard let session, session.phase == .finished,
              let text = session.text, !text.isEmpty,
              defaults.string(forKey: Self.insertedSessionKey) != session.id.uuidString,
              Date().timeIntervalSince(session.updatedAt) < 10 * 60,
              let proxy = controller?.textDocumentProxy else {
            return
        }
        defaults.set(session.id.uuidString, forKey: Self.insertedSessionKey)
        proxy.insertText(text)
        insertedText = text
    }

    /// Takes the inserted message out again, if it is still just before the cursor
    func undoInsert() {
        guard let insertedText, let proxy = controller?.textDocumentProxy else { return }
        let before = proxy.documentContextBeforeInput ?? ""
        guard before.hasSuffix(String(insertedText.suffix(30))) else {
            notice = "The message has changed, so it stays."
            return
        }
        for _ in 0..<insertedText.count {
            proxy.deleteBackward()
        }
        self.insertedText = nil
        refreshContext()
    }

    // MARK: - Keys

    func insert(_ text: String) {
        controller?.textDocumentProxy.insertText(text)
    }

    func deleteBackward() {
        controller?.textDocumentProxy.deleteBackward()
    }

    func nextKeyboard() {
        controller?.advanceToNextInputMode()
    }
}

extension ConversationSnapshot {
    /// The conversation a messaging or mail app gives keyboards (iOS 18.4)
    @available(iOS 18.4, *)
    init?(_ conversation: UIConversationContext) {
        let names = conversation.participantNameByIdentifier
        let messages = conversation.entries.suffix(Self.messagesSent).compactMap { entry -> Message? in
            let text = entry.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return nil }
            let isFromMe = (entry as? UIMessageConversationContext.MessageEntry)?.wasSentBySelf
                ?? conversation.selfIdentifiers.contains(entry.senderIdentifier)
            let sender = names[entry.senderIdentifier]
                .map { PersonNameComponentsFormatter.localizedString(from: $0, style: .short) } ?? ""
            return Message(sender: isFromMe ? "" : sender, text: text, isFromMe: isFromMe)
        }
        guard !messages.isEmpty else { return nil }
        let recipients = conversation.responsePrimaryRecipientIdentifiers.compactMap { names[$0] }
            .map { PersonNameComponentsFormatter.localizedString(from: $0, style: .short) }
        self.init(source: .conversation, messages: messages,
                  title: recipients.isEmpty ? nil : recipients.sorted().joined(separator: ", "))
    }
}
