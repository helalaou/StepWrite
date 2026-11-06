import AVFoundation
import SwiftUI

/// Setting up the keyboard, the writing in progress, a practice chat and Settings
struct HomeView: View {
    @Environment(WritingSession.self) private var session
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL
    @State private var setup = SetupStatus()

    var body: some View {
        @Bindable var session = session
        NavigationStack {
            List {
                Section {
                    header
                }
                .listRowBackground(Color.clear)

                if session.state.phase != .idle {
                    Section("Writing") {
                        SessionSummary(state: session.state)
                    }
                }

                Section {
                    SetupStep(number: 1, title: "Add the keyboard", isDone: setup.isKeyboardAdded,
                              detail: "Settings › General › Keyboard › Keyboards › Add New Keyboard › \(Brand.name)")
                    SetupStep(number: 2, title: "Allow Full Access", isDone: setup.hasFullAccess,
                              detail: "Tap \(Brand.name) in the same list. Full Access lets the keyboard pass your chat to this app, which listens and writes, and put the message in the text field.")
                    SetupStep(number: 3, title: "Allow the microphone", isDone: setup.isMicrophoneAllowed,
                              detail: "This app listens to your answers while you're in the chat.")
                    if setup.isMicrophoneUndecided {
                        Button("Allow the microphone") {
                            Task {
                                _ = await AVAudioApplication.requestRecordPermission()
                                setup.refresh()
                            }
                        }
                    } else if !setup.isComplete {
                        Button("Open Settings") {
                            if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                        }
                    }
                } header: {
                    Text("Set up")
                } footer: {
                    Text("Settings › \(Brand.name) › Keyboards also has both switches.")
                }

                Section {
                    NavigationLink {
                        PracticeChatView()
                    } label: {
                        Label("Practice in a chat", systemImage: "bubble.left.and.bubble.right")
                    }
                    Button {
                        session.startFromScreenshot()
                    } label: {
                        Label("Reply to my latest screenshot", systemImage: "camera.viewfinder")
                    }
                    .disabled(session.state.isActive)
                } header: {
                    Text("Try it")
                } footer: {
                    Text("The practice chat passes its messages to the keyboard the way iOS lets any app do, so the keyboard knows what you're replying to.")
                }

                Section {
                    NavigationLink {
                        SettingsView()
                    } label: {
                        Label("Settings", systemImage: "gear")
                    }
                    NavigationLink {
                        HowItWorksView()
                    } label: {
                        Label("How it works", systemImage: "questionmark.circle")
                    }
                }
            }
            .navigationTitle(Brand.name)
            .navigationBarTitleDisplayMode(.inline)
        }
        .fullScreenCover(isPresented: $session.openedByKeyboard) {
            BackToChatView()
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            guard phase == .active else { return }
            setup.refresh()
            // When the keyboard couldn't open the app and the user opened it
            // instead, its request is still waiting
            session.readRequest()
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            Image("Logo")
                .resizable()
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(Brand.name)
                    .font(.title2.bold())
                Text("Answer a few questions out loud, in any app. StepWrite writes the message.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

/// Whether each setup step is done, checked whenever the app comes to the front
@MainActor
@Observable
final class SetupStatus {
    private(set) var isKeyboardAdded = false
    private(set) var hasFullAccess = false
    private(set) var isMicrophoneAllowed = false
    private(set) var isMicrophoneUndecided = false

    var isComplete: Bool { isKeyboardAdded && hasFullAccess && isMicrophoneAllowed }

    func refresh() {
        let keyboardID = (Bundle.main.bundleIdentifier ?? "") + ".input"
        let keyboards = UserDefaults.standard.stringArray(forKey: "AppleKeyboards") ?? []
        isKeyboardAdded = keyboards.contains(keyboardID)
        // Only a keyboard with Full Access can write to the shared container
        hasFullAccess = isKeyboardAdded && SharedStore.read(KeyboardStatus.self, from: .keyboardStatus)?.hasFullAccess == true
        let permission = AVAudioApplication.shared.recordPermission
        isMicrophoneAllowed = permission == .granted
        isMicrophoneUndecided = permission == .undetermined
    }
}

private struct SetupStep: View {
    let number: Int
    let title: String
    let isDone: Bool
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(isDone ? Color.green : Brand.accent.opacity(0.15))
                if isDone {
                    Image(systemName: "checkmark")
                        .font(.footnote.bold())
                        .foregroundStyle(.white)
                } else {
                    Text("\(number)")
                        .font(.footnote.bold())
                        .foregroundStyle(Brand.accent)
                }
            }
            .frame(width: 26, height: 26)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.body.weight(.semibold))
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityValue(isDone ? "Done" : "Not done")
    }
}

/// The question, the answer heard and the finished message, as in the keyboard
private struct SessionSummary: View {
    @Environment(WritingSession.self) private var session
    let state: SessionState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(state.statusText, systemImage: state.statusSymbol)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(state.phase == .failed ? .red : Brand.accent)
            if let replyingTo = state.replyingTo {
                Text("Replying to: \(replyingTo.text)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            if state.phase == .finished, let text = state.text {
                Text(text)
            } else if state.phase == .failed, let error = state.error {
                Text(error)
            } else if let question = state.question {
                Text(question)
                    .font(.headline)
            }
            HStack {
                if state.isActive {
                    Button("Stop", role: .destructive) { session.stop() }
                } else if state.phase == .failed {
                    Button("Try again") { session.retry() }
                }
                Spacer()
                if session.isMicrophoneOn && !state.isActive {
                    Button("Turn off microphone") { session.closeMicrophone() }
                }
            }
            .buttonStyle(.borderless)
            .font(.subheadline)
        }
        .padding(.vertical, 4)
    }
}

/// Shown when the keyboard opened the app: the app is listening, and the user
/// goes back to the chat to see the questions and the message.
struct BackToChatView: View {
    @Environment(WritingSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let state = session.state
        VStack(spacing: 28) {
            Spacer()
            ListeningOrb(phase: state.phase)
            VStack(spacing: 10) {
                Text(state.statusText)
                    .font(.title2.bold())
                if state.phase == .failed, let error = state.error {
                    Text(error)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                } else if let question = state.question {
                    Text(question)
                        .font(.title3)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 28)
            Spacer()

            VStack(alignment: .leading, spacing: 10) {
                Label("Go back to your chat", systemImage: "arrow.uturn.backward.circle.fill")
                    .font(.headline)
                    .foregroundStyle(Brand.accent)
                Text("Tap the ◀︎ back button in the top-left corner, or swipe right along the bottom edge of the screen. \(Brand.name) keeps listening, and your message appears in the text field.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .padding(.horizontal, 20)

            HStack(spacing: 12) {
                if state.isActive {
                    Button("Stop writing", role: .destructive) {
                        session.stop()
                        dismiss()
                    }
                    .buttonStyle(.bordered)
                } else if state.phase == .failed {
                    Button("Try again") { session.retry() }
                        .buttonStyle(.borderedProminent)
                }
                Button("Stay here") { dismiss() }
                    .buttonStyle(.bordered)
            }
            .padding(.bottom, 12)
        }
    }
}

/// A pulsing circle: still while speaking or thinking, bigger while hearing
struct ListeningOrb: View {
    let phase: SessionState.Phase
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle()
                .fill(Brand.accent.opacity(0.12))
                .frame(width: 168, height: 168)
                .scaleEffect(pulse && isListening ? 1.12 : 1)
            Circle()
                .fill(Brand.accent.opacity(0.22))
                .frame(width: 124, height: 124)
                .scaleEffect(phase == .hearing ? 1.1 : 1)
            Circle()
                .fill(Brand.accent)
                .frame(width: 88, height: 88)
            Image(systemName: phase == .speaking ? "speaker.wave.2.fill" : "mic.fill")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(.white)
        }
        .animation(.easeInOut(duration: 1).repeatForever(autoreverses: true), value: pulse)
        .animation(.spring(duration: 0.3), value: phase)
        .onAppear { pulse = true }
        .accessibilityHidden(true)
    }

    private var isListening: Bool {
        phase == .listening || phase == .hearing
    }
}
