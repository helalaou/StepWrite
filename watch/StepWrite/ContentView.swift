import SwiftUI

struct ContentView: View {
    @State private var model = ConversationModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch model.screen {
            case .home:
                HomeScreen(model: model)
            case .questions:
                QuestionScreen(model: model)
            case .text:
                TextScreen(model: model)
            case .failed(let message):
                FailureScreen(model: model, message: message)
            }
        }
        // Audio started while the app is still launching can stall the
        // simulator's audio, so writing starts once the app is active.
        .onChange(of: scenePhase, initial: true) {
            if scenePhase == .active {
                model.startOnLaunch()
            }
        }
        .sheet(isPresented: Binding(
            get: { model.isShowingSettings },
            set: { isShowing in
                if !isShowing { model.closeSettings() }
            }
        )) {
            SettingsScreen()
        }
    }
}

private struct HomeScreen: View {
    let model: ConversationModel

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Image("Logo")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 48)
                Text("StepWrite")
                    .font(.title3.weight(.semibold))
                Text("Answer a few questions out loud and get a finished text.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button(action: model.start) {
                    Label("Start writing", systemImage: "mic.fill")
                        .font(.footnote.weight(.semibold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(Color.stepRed))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
                SettingsButton(model: model)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

/// watchOS keeps the time in the top-trailing corner and apps can't hide it.
/// The question screen runs up under it instead, with only the progress dots
/// in the clock's row (centered on the time), so the question gets the rest.
/// Settings is behind Pause, which stops the voice loop first.
private let clockRowTop: CGFloat = 20
private let clockRowHeight: CGFloat = 12

private struct QuestionScreen: View {
    let model: ConversationModel

    @ScaledMetric(relativeTo: .title3) private var questionSize: CGFloat = 22

    var body: some View {
        ScrollViewReader { scroller in
            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        ProgressDots(questions: model.questions, current: model.index)
                        if model.isDraftReady {
                            DraftBadge()
                        }
                        Spacer()
                    }
                    .frame(height: clockRowHeight)
                    .padding(.top, clockRowTop)
                    .padding(.leading, 8)
                    .id(Self.top)

                    Text(model.currentQuestion?.question ?? "")
                        .font(.system(size: questionSize, weight: .semibold))
                        .fixedSize(horizontal: false, vertical: true)
                        .contentTransition(.opacity)
                        .animation(.easeInOut(duration: 0.25), value: model.index)

                    AnswerCard(model: model)

                    QuestionControls(model: model)
                }
            }
            .ignoresSafeArea(edges: .top)
            // Each question opens at its first line, wherever the last one was scrolled to
            .onChange(of: model.index) {
                scroller.scrollTo(Self.top, anchor: .top)
            }
        }
        .overlay(alignment: .bottom) {
            ActivityRow(activity: model.activity, level: model.level)
        }
        .overlay(alignment: .bottom) {
            FeedbackToast(feedback: model.feedback)
        }
        .overlay {
            if model.isPaused {
                PausedOverlay(model: model)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: model.isPaused)
    }

    private static let top = "top"
}

/// The current question's answer, as the web app shows it under the question
private struct AnswerCard: View {
    let model: ConversationModel

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if model.isModifying {
                Label("Modifying", systemImage: "pencil")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Color.stepBlue)
            }
            switch model.currentAnswer {
            case nil:
                Text(model.isModifying ? "Speak your new answer…" : "Waiting for your answer…")
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
            case skippedAnswer:
                Text("Skipped")
                    .italic()
                    .foregroundStyle(.secondary)
                    .strikethrough(model.isModifying)
            case let answer?:
                Text(answer)
                    .foregroundStyle(model.isModifying ? .secondary : .primary)
                    .strikethrough(model.isModifying)
            }
        }
        .font(.callout)
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.white.opacity(0.08)))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.stepBlue, lineWidth: 1.5)
                .opacity(isHighlighted ? 1 : 0)
        }
        .animation(.easeInOut(duration: 0.25), value: isHighlighted)
    }

    /// Outlined while an answer is awaited in place of the old one, or is on its way to the server
    private var isHighlighted: Bool {
        model.isModifying || model.activity == .thinking
    }
}

private struct QuestionControls: View {
    let model: ConversationModel

    var body: some View {
        let isAnswered = model.currentAnswer != nil
        HStack(spacing: 6) {
            RoundButton(systemImage: "chevron.backward", label: "Previous question") {
                model.send(.previous)
            }
            .disabled(model.index == 0)

            RoundButton(systemImage: "pause.fill", label: "Pause") {
                model.send(.pause)
            }

            RoundButton(
                systemImage: isAnswered ? "chevron.forward" : "forward.end.fill",
                label: isAnswered ? "Next question" : "Skip question"
            ) {
                model.send(isAnswered ? .next : .skip)
            }

            RoundButton(systemImage: "checkmark", label: "Finish writing", tint: .stepGreen) {
                model.send(.finish)
            }
            .disabled(!model.canFinish)
        }
        .disabled(model.isBusy)
        .frame(maxWidth: .infinity)
        .padding(.top, 2)
    }
}

private struct PausedOverlay: View {
    let model: ConversationModel

    var body: some View {
        ZStack {
            // Opaque, so the toast saying the same thing doesn't show through
            Color.black
                .ignoresSafeArea()
            VStack(spacing: 8) {
                Image(systemName: "mic.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(model.activity == .hearing ? Color.stepGreen : Color.stepBlue)
                    .symbolEffect(.pulse, options: .repeating)
                Text("Writing paused")
                    .font(.headline)
                Text("Say “continue writing” to resume.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                HStack(spacing: 6) {
                    RoundButton(systemImage: "play.fill", label: "Resume", tint: .stepBlue) {
                        model.send(.resume)
                    }
                    RoundButton(systemImage: "gearshape.fill", label: "Settings", action: model.openSettings)
                }
                .disabled(model.isBusy)
            }
            .padding(.horizontal, 8)
        }
    }
}

private struct TextScreen: View {
    let model: ConversationModel

    var body: some View {
        ScrollViewReader { scroller in
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    // In the clock's row, like the question screen's progress dots
                    HStack(spacing: 6) {
                        SettingsGear(model: model)
                        Text(model.isDraft ? "Draft" : "Your text")
                            .font(.headline)
                            .foregroundStyle(Color.stepBlue)
                        if model.activity == .speaking {
                            Image(systemName: "speaker.wave.2.fill")
                                .font(.footnote)
                                .foregroundStyle(Color.stepBlue)
                                .symbolEffect(.variableColor.iterative, options: .repeating)
                        }
                        Spacer()
                    }
                    .frame(height: 22)
                    .padding(.top, clockRowTop + clockRowHeight / 2 - 11)
                    .padding(.leading, 8)
                    .id(Self.top)

                    Text(model.text)
                        .font(.body)

                    Text("Say “read it again” or “go back to questions”.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    HStack(spacing: 6) {
                        if model.activity == .speaking {
                            RoundButton(systemImage: "stop.fill", label: "Stop reading", tint: .stepBlue) {
                                model.send(.stopReading)
                            }
                        } else {
                            RoundButton(systemImage: "speaker.wave.2.fill", label: "Read aloud", tint: .stepBlue) {
                                model.send(.readAgain)
                            }
                        }
                        RoundButton(systemImage: "arrow.uturn.backward", label: "Back to questions") {
                            model.send(.backToQuestions)
                        }
                        ShareLink(item: model.text) {
                            RoundIcon(systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Share")
                        RoundButton(systemImage: "square.and.pencil", label: "New text", action: model.start)
                    }
                    .disabled(model.isBusy)
                    .frame(maxWidth: .infinity)
                }
            }
            .ignoresSafeArea(edges: .top)
            // watchOS scrolls the first button into view for the Digital Crown,
            // which would open the text at its end.
            .onAppear {
                scroller.scrollTo(Self.top, anchor: .top)
            }
        }
        .overlay(alignment: .bottom) {
            ActivityRow(activity: model.activity, level: model.level)
        }
        .overlay(alignment: .bottom) {
            FeedbackToast(feedback: model.feedback)
        }
    }

    private static let top = "top"
}

private struct FailureScreen: View {
    let model: ConversationModel
    let message: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Label("Something went wrong", systemImage: "exclamationmark.triangle.fill")
                    .font(.headline)
                    .foregroundStyle(.orange)
                Text(message)
                    .font(.footnote)
                Text("Server: \(AppSettings.shared.serverURL.absoluteString)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                HStack(spacing: 6) {
                    RoundButton(systemImage: "arrow.clockwise", label: "Try again", tint: .stepBlue, action: model.tryAgain)
                    RoundButton(systemImage: "house.fill", label: "Home", action: model.goHome)
                    RoundButton(systemImage: "gearshape.fill", label: "Settings", action: model.openSettings)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}
