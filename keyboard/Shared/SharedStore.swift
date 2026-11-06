import Foundation

/// Files the app and its extensions share in the App Group container. Each is
/// small JSON, written whole and atomically, so a reader never sees half of
/// one. The keyboard reaches the container only with Full Access.
enum SharedStore {
    enum File: String {
        /// SessionState, written by the app
        case session = "session.json"
        /// KeyboardRequest, written by the keyboard
        case request = "request.json"
        /// ConversationSnapshot from the Share extension or a screenshot
        case sharedContext = "shared-context.json"
        /// KeyboardStatus, written by the keyboard
        case keyboardStatus = "keyboard-status.json"
        /// ConversationSnapshot of the app's practice chat, while its text
        /// field is being typed in
        case practiceChat = "practice-chat.json"
    }

    static var container: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Brand.appGroup)
    }

    static func read<Value: Decodable>(_ type: Value.Type, from file: File) -> Value? {
        guard let url = container?.appendingPathComponent(file.rawValue),
              let data = try? Data(contentsOf: url) else {
            return nil
        }
        return try? JSONDecoder().decode(type, from: data)
    }

    /// Returns false when the container can't be written, as for a keyboard
    /// without Full Access.
    @discardableResult
    static func write<Value: Encodable>(_ value: Value, to file: File) -> Bool {
        guard let url = container?.appendingPathComponent(file.rawValue),
              let data = try? JSONEncoder().encode(value) else {
            return false
        }
        return (try? data.write(to: url, options: .atomic)) != nil
    }

    static func remove(_ file: File) {
        guard let url = container?.appendingPathComponent(file.rawValue) else { return }
        try? FileManager.default.removeItem(at: url)
    }
}

/// Darwin notifications between the app and the keyboard. They carry no data:
/// the receiver reads the shared file that changed.
enum Signal: String {
    /// The app wrote a new SessionState
    case sessionChanged
    /// The keyboard wrote a new KeyboardRequest
    case request
    /// The keyboard asks whether the app is running with the microphone on
    case ping
    /// The app's answer to `ping`
    case pong
    /// The app or the Share extension wrote something to reply to
    case contextChanged

    fileprivate var name: CFNotificationName {
        CFNotificationName("\(Brand.appGroup).\(rawValue)" as CFString)
    }

    func post() {
        CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(), name, nil, nil, true)
    }
}

/// Calls `handler` on the main actor each time `signal` is posted, for as long
/// as the observer is kept.
final class SignalObserver {
    private let name: CFNotificationName
    private let handler: @MainActor () -> Void

    init(_ signal: Signal, handler: @escaping @MainActor () -> Void) {
        name = signal.name
        self.handler = handler
        CFNotificationCenterAddObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            Unmanaged.passUnretained(self).toOpaque(),
            { _, observer, _, _, _ in
                guard let observer else { return }
                let receiver = Unmanaged<SignalObserver>.fromOpaque(observer).takeUnretainedValue()
                let handler = receiver.handler
                Task { @MainActor in handler() }
            },
            name.rawValue,
            nil,
            .deliverImmediately
        )
    }

    deinit {
        CFNotificationCenterRemoveObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            Unmanaged.passUnretained(self).toOpaque(),
            name,
            nil
        )
    }
}
