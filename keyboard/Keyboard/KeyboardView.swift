import SwiftUI

/// The keyboard: what the message replies to and a Start button, then the
/// question being asked, then the finished message. A row of keys at the
/// bottom switches keyboards and edits the text.
struct KeyboardView: View {
    let model: KeyboardModel

    var body: some View {
        VStack(spacing: 8) {
            header
            Group {
                switch model.screen {
                case .fullAccess:
                    FullAccessPanel(model: model)
                case .start:
                    StartPanel(model: model)
                case .connecting:
                    ConnectingPanel()
                case .writing:
                    if let session = model.session {
                        WritingPanel(model: model, session: session)
                    }
                case .failed:
                    FailedPanel(model: model)
                case .done:
                    DonePanel(model: model)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .animation(.snappy(duration: 0.25), value: model.screen)
            KeyRow(model: model)
        }
        .padding(.horizontal, 6)
        .padding(.top, 8)
        .padding(.bottom, 4)
        .tint(Brand.accent)
    }

    private var header: some View {
        HStack(spacing: 6) {
            Image(systemName: "waveform")
                .foregroundStyle(Brand.accent)
            Text(Brand.name)
                .foregroundStyle(.secondary)
            Spacer()
            if let notice = model.notice {
                Text(notice)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            } else if model.isMicrophoneOn {
                Button {
                    model.send(.closeMicrophone)
                } label: {
                    HStack(spacing: 4) {
                        Circle().fill(.orange).frame(width: 7, height: 7)
                        Text("Mic on")
                        Image(systemName: "xmark")
                            .font(.caption2.weight(.bold))
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(KeyStyle.fill, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Microphone on. Turn off")
            }
        }
        .font(.footnote.weight(.semibold))
        .padding(.horizontal, 4)
    }
}

// MARK: - Panels

private struct StartPanel: View {
    let model: KeyboardModel

    var body: some View {
        VStack(spacing: 8) {
            ContextCard(model: model)
            SourceChips(model: model)
            Button {
                model.start()
            } label: {
                Label(model.choice == .newMessage ? "Write by voice" : "Reply by voice", systemImage: "mic.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(ProminentKeyStyle())
        }
    }
}

/// What the message replies to
private struct ContextCard: View {
    let model: KeyboardModel

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(Brand.accent)
                .frame(width: 26)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: .infinity, minHeight: 66, alignment: .topLeading)
        .background(KeyStyle.fill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var symbol: String {
        switch model.choice {
        case .reply(let source): return source.symbol
        case .latestScreenshot: return "camera.viewfinder"
        case .newMessage: return "square.and.pencil"
        }
    }

    private var title: String {
        switch model.choice {
        case .reply:
            guard let context = model.selectedContext else { return "Replying" }
            let message = context.lastIncoming
            let who = message.map { $0.isFromMe ? "" : $0.sender } ?? ""
            let name = who.isEmpty ? (context.title ?? "") : who
            return name.isEmpty ? "Replying to \(context.source.unnamed)" : "Replying to \(name) · \(context.source.from)"
        case .latestScreenshot:
            return "Replying to your latest screenshot"
        case .newMessage:
            return "New message"
        }
    }

    private var detail: String {
        switch model.choice {
        case .reply:
            return model.selectedContext?.lastIncoming?.text ?? ""
        case .latestScreenshot:
            return "Take a screenshot of the chat first. \(Brand.name) reads the messages when you start."
        case .newMessage:
            return "\(Brand.name) asks what you'd like to write, then a few short questions."
        }
    }
}

/// The places the keyboard found a conversation, plus a screenshot and a new message
private struct SourceChips: View {
    let model: KeyboardModel

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(model.contexts, id: \.source) { context in
                    chip(context.source.label, symbol: context.source.symbol, choice: .reply(context.source))
                }
                if !model.contexts.contains(where: { $0.source == .clipboard }) {
                    // The system's button: the only way iOS lets a keyboard
                    // read what was copied. iOS draws a light tint in gray,
                    // as if it were off, so it gets a dark one.
                    PasteButton(payloadType: String.self) { strings in
                        Task { @MainActor in model.paste(strings.joined(separator: "\n")) }
                    }
                    .labelStyle(.titleAndIcon)
                    .buttonBorderShape(.capsule)
                    .controlSize(.mini)
                    .tint(Color(.darkGray))
                }
                if !model.contexts.contains(where: { $0.source == .screenshot }) {
                    chip("Screenshot", symbol: "camera.viewfinder", choice: .latestScreenshot)
                }
                chip("New message", symbol: "square.and.pencil", choice: .newMessage)
            }
            .padding(.horizontal, 1)
        }
        .scrollClipDisabled()
    }

    private func chip(_ label: String, symbol: String, choice: KeyboardModel.Choice) -> some View {
        let isSelected = model.choice == choice
        return Button {
            model.choose(choice)
        } label: {
            Label(label, systemImage: symbol)
                .font(.footnote.weight(.medium))
                .padding(.horizontal, 10)
                .frame(height: 30)
                .foregroundStyle(isSelected ? AnyShapeStyle(.white) : AnyShapeStyle(.primary))
                .background(isSelected ? AnyShapeStyle(Brand.accent) : AnyShapeStyle(KeyStyle.fill), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

private struct ConnectingPanel: View {
    var body: some View {
        VStack(spacing: 10) {
            ProgressView()
                .controlSize(.large)
            Text("Opening \(Brand.name)…")
                .font(.headline)
            Text("It turns the microphone on. Then come back to this chat; it keeps listening.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// The question, what was heard, and buttons that do what the voice commands do
private struct WritingPanel: View {
    let model: KeyboardModel
    let session: SessionState

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                PhaseDot(phase: session.phase)
                Text(session.statusText)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Brand.accent)
                Spacer()
                if session.questionNumber > 0 {
                    Text("Question \(session.questionNumber)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            Text(session.question ?? (session.isReply ? "Reading the conversation…" : "Getting ready…"))
                .font(.title3.weight(.semibold))
                .lineLimit(3)
                .minimumScaleFactor(0.75)
                .frame(maxWidth: .infinity, alignment: .leading)
                .animation(nil, value: session.question)
            if let line = session.feedback ?? session.heard.map({ "“\($0)”" }) {
                Text(line)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                control("Repeat", symbol: "arrow.counterclockwise", action: .repeatQuestion)
                control("Skip", symbol: "forward", action: .skip)
                control("Stop", symbol: "xmark", action: .stop)
                Button {
                    model.send(.finish)
                } label: {
                    Label("Finish", systemImage: "checkmark")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 42)
                }
                .buttonStyle(ProminentKeyStyle())
            }
        }
        .padding(.horizontal, 4)
    }

    private func control(_ title: String, symbol: String, action: KeyboardRequest.Action) -> some View {
        Button {
            model.send(action)
        } label: {
            Label(title, systemImage: symbol)
                .font(.subheadline.weight(.medium))
                .frame(maxWidth: .infinity, minHeight: 42)
        }
        .buttonStyle(KeyButtonStyle())
    }
}

private struct FailedPanel: View {
    let model: KeyboardModel

    var body: some View {
        VStack(spacing: 10) {
            Label("Something went wrong", systemImage: "exclamationmark.triangle.fill")
                .font(.headline)
                .foregroundStyle(.orange)
            Text(model.session?.error ?? "")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .lineLimit(3)
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                Button("Cancel") { model.dismissFailure() }
                    .buttonStyle(KeyButtonStyle())
                Button("Try again") { model.send(.retry) }
                    .buttonStyle(ProminentKeyStyle())
            }
            .font(.headline)
        }
        .padding(.horizontal, 4)
    }
}

private struct DonePanel: View {
    let model: KeyboardModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Your message is in the text field", systemImage: "checkmark.circle.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.green)
            Text(model.insertedText ?? "")
                .font(.subheadline)
                .lineLimit(4)
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(10)
                .background(KeyStyle.fill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                Button {
                    model.undoInsert()
                } label: {
                    Label("Undo", systemImage: "arrow.uturn.backward")
                        .frame(maxWidth: .infinity, minHeight: 42)
                }
                .buttonStyle(KeyButtonStyle())
                Button {
                    model.newMessage()
                } label: {
                    Label("New message", systemImage: "mic.fill")
                        .frame(maxWidth: .infinity, minHeight: 42)
                }
                .buttonStyle(ProminentKeyStyle())
            }
            .font(.subheadline.weight(.semibold))
        }
        .padding(.horizontal, 4)
    }
}

private struct FullAccessPanel: View {
    let model: KeyboardModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Allow Full Access to start", systemImage: "lock.open.fill")
                .font(.headline)
                .foregroundStyle(Brand.accent)
            Text("Settings › General › Keyboard › Keyboards › \(Brand.name) › Allow Full Access.")
                .font(.subheadline.weight(.medium))
            Text("iOS doesn't give keyboards the microphone, so the \(Brand.name) app listens for you. Full Access lets the keyboard pass it your chat and get the message back. The keyboard has no letter keys and keeps nothing you type.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4)
    }
}

// MARK: - Keys

private struct KeyRow: View {
    let model: KeyboardModel

    var body: some View {
        HStack(spacing: 6) {
            if model.needsInputModeSwitchKey {
                Button(action: model.nextKeyboard) {
                    Image(systemName: "globe")
                        .frame(width: 44, height: 40)
                }
                .buttonStyle(KeyButtonStyle(isSpecial: true))
                .accessibilityLabel("Next keyboard")
            }
            Button {
                model.insert(" ")
            } label: {
                Text("space")
                    .frame(maxWidth: .infinity, minHeight: 40)
            }
            .buttonStyle(KeyButtonStyle())
            Button(action: model.deleteBackward) {
                Image(systemName: "delete.left")
                    .frame(width: 52, height: 40)
            }
            .buttonStyle(KeyButtonStyle(isSpecial: true))
            .accessibilityLabel("Delete")
            Button {
                model.insert("\n")
            } label: {
                Text(model.returnKeyLabel)
                    .frame(width: 88, height: 40)
            }
            .buttonStyle(KeyButtonStyle(isSpecial: true))
        }
        .font(.body)
    }
}

/// The system keyboard's key colours, so the keyboard looks at home
enum KeyStyle {
    static let fill = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(white: 0.42, alpha: 1) : .white
    })
    static let specialFill = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(white: 0.27, alpha: 1)
            : UIColor(red: 0.68, green: 0.70, blue: 0.74, alpha: 1)
    })
}

private struct KeyButtonStyle: ButtonStyle {
    var isSpecial = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(.primary)
            .background(
                (configuration.isPressed ? (isSpecial ? KeyStyle.fill : KeyStyle.specialFill)
                                         : (isSpecial ? KeyStyle.specialFill : KeyStyle.fill)),
                in: RoundedRectangle(cornerRadius: 8, style: .continuous)
            )
            .shadow(color: .black.opacity(0.25), radius: 0, x: 0, y: 1)
            .contentShape(Rectangle())
    }
}

private struct ProminentKeyStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(.white)
            .background(Brand.accent.opacity(configuration.isPressed ? 0.75 : 1),
                        in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .shadow(color: .black.opacity(0.25), radius: 0, x: 0, y: 1)
            .contentShape(Rectangle())
    }
}

/// A dot that pulses while the app listens
private struct PhaseDot: View {
    let phase: SessionState.Phase
    @State private var pulse = false

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 10, height: 10)
            .scaleEffect(isListening && pulse ? 1.5 : 1)
            .opacity(isListening && pulse ? 0.6 : 1)
            .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulse)
            .onAppear { pulse = true }
            .accessibilityHidden(true)
    }

    private var isListening: Bool {
        phase == .listening || phase == .hearing
    }

    private var color: Color {
        switch phase {
        case .listening, .hearing: return .green
        case .speaking: return .blue
        case .paused: return .orange
        default: return .secondary
        }
    }
}

private extension ConversationSnapshot.Source {
    var label: String {
        switch self {
        case .conversation: return "This chat"
        case .screenshot: return "Screenshot"
        case .shared: return "Shared"
        case .clipboard: return "Pasted"
        case .field: return "This text"
        }
    }

    /// What is replied to when the sender's name isn't known, after "Replying to"
    var unnamed: String {
        switch self {
        case .conversation: return "this chat"
        case .screenshot: return "your screenshot"
        case .shared: return "what you shared"
        case .clipboard: return "a pasted message"
        case .field: return "the text here"
        }
    }

    /// Where the message was found, after "Replying to Alex ·"
    var from: String {
        switch self {
        case .conversation: return "from this chat"
        case .screenshot: return "from a screenshot"
        case .shared: return "shared"
        case .clipboard: return "pasted"
        case .field: return "in this text"
        }
    }

    var symbol: String {
        switch self {
        case .conversation: return "bubble.left.and.bubble.right.fill"
        case .screenshot: return "camera.viewfinder"
        case .shared: return "square.and.arrow.down"
        case .clipboard: return "doc.on.clipboard"
        case .field: return "text.quote"
        }
    }
}
