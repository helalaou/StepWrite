import SwiftUI

struct ContentView: View {
    @State private var model = ConversationModel()

    var body: some View {
        switch model.phase {
        case .welcome:
            WelcomeView(model: model)
        case .finished(let text):
            FinishedView(model: model, text: text)
        case .failed(let message):
            FailureView(model: model, message: message)
        default:
            QuestionView(model: model)
        }
    }
}

private struct WelcomeView: View {
    let model: ConversationModel

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Image("Logo")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 52)
                Text("StepWrite")
                    .font(.headline)
                Text("Answer a few questions out loud and get a finished text.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button("Start writing", action: model.start)
                    .tint(.red)
            }
        }
    }
}

private struct QuestionView: View {
    let model: ConversationModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text(model.currentQuestion)
                    .font(.headline)
                    .fixedSize(horizontal: false, vertical: true)

                StatusLabel(phase: model.phase)

                if let answer = model.heardAnswer {
                    Text("“\(answer)”")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if model.phase == .hearing {
                    Button("I'm done talking", action: model.finishAnswer)
                        .tint(.green)
                }

                HStack {
                    Button("Skip", action: model.skipQuestion)
                    if model.canFinish {
                        Button("Finish", action: model.finishNow)
                    }
                }
                .disabled(model.isBusy)

                Button("Repeat question", systemImage: "arrow.counterclockwise", action: model.repeatQuestion)
                    .font(.footnote)
                    .disabled(model.isBusy)
            }
        }
    }
}

private struct StatusLabel: View {
    let phase: ConversationModel.Phase

    var body: some View {
        HStack(spacing: 6) {
            switch phase {
            case .speaking:
                Image(systemName: "speaker.wave.2.fill")
                Text("Asking…")
            case .listening:
                Image(systemName: "mic.fill")
                Text("Listening…")
            case .hearing:
                Image(systemName: "waveform")
                    .symbolEffect(.variableColor.iterative)
                Text("Hearing you…")
            case .transcribing:
                ProgressView()
                    .frame(width: 20, height: 20)
                Text("Writing it down…")
            default:
                ProgressView()
                    .frame(width: 20, height: 20)
                Text("Thinking…")
            }
        }
        .font(.footnote)
        .foregroundStyle(phase == .hearing ? .green : .secondary)
    }
}

private struct FinishedView: View {
    let model: ConversationModel
    let text: String

    var body: some View {
        ScrollViewReader { scroller in
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Your text")
                        .font(.headline)
                        .id(Self.top)
                    Text(text)
                        .font(.footnote)
                    ShareLink(item: text)
                    Button(
                        model.isReadingAloud ? "Stop reading" : "Read aloud",
                        systemImage: model.isReadingAloud ? "stop.fill" : "speaker.wave.2.fill"
                    ) {
                        model.toggleReadingAloud(text)
                    }
                    Button("New text", systemImage: "square.and.pencil", action: model.start)
                }
            }
            // watchOS scrolls the first button into view for the Digital Crown,
            // which would open the text at its end.
            .onAppear {
                scroller.scrollTo(Self.top, anchor: .top)
            }
        }
    }

    private static let top = "top"
}

private struct FailureView: View {
    let model: ConversationModel
    let message: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Label("Something went wrong", systemImage: "exclamationmark.triangle.fill")
                    .font(.headline)
                    .foregroundStyle(.orange)
                Text(message)
                    .font(.footnote)
                Text("Server: \(ServerSettings.baseURL.absoluteString)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button("Try again", action: model.tryAgain)
                Button("Start over", action: model.startOver)
            }
        }
    }
}
