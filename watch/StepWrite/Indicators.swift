import SwiftUI

extension Color {
    // The web app's Material colors, in their lighter shades for the black watch screen
    static let stepBlue = Color(red: 0.26, green: 0.65, blue: 0.96)
    static let stepGreen = Color(red: 0.40, green: 0.73, blue: 0.42)
    static let stepRed = Color(red: 0.94, green: 0.33, blue: 0.31)
}

/// Bars that move with the voice: the watch's own while it speaks (blue),
/// the user's while they speak (green). Like the web app's AudioVisualizer.
struct LevelBars: View {
    let activity: ConversationModel.Activity
    let level: Float
    var barCount = 15

    private let minimumHeight: CGFloat = 3
    private let maximumHeight: CGFloat = 18

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            HStack(spacing: 3) {
                ForEach(0..<barCount, id: \.self) { bar in
                    Capsule()
                        .fill(color)
                        .frame(width: 4, height: height(of: bar, at: time))
                }
            }
            .frame(height: maximumHeight)
        }
        .accessibilityHidden(true)
    }

    private var color: Color {
        switch activity {
        case .speaking, .processing, .thinking: .stepBlue
        case .hearing: .stepGreen
        case .listening, .idle: .white.opacity(0.4)
        }
    }

    private func height(of bar: Int, at time: TimeInterval) -> CGFloat {
        let position = Double(bar)
        let middle = Double(barCount - 1) / 2
        // Taller in the middle, like a voice print
        let envelope = 1 - abs(position - middle) / (middle + 1) * 0.6
        let wobble = 0.65 + 0.35 * sin(time * 9 + position * 0.9)

        let amount: Double
        switch activity {
        case .speaking:
            // The watch's own voice reports no level, so animate it instead
            let voice = level > 0 ? Double(level) : 0.5
            amount = voice * envelope * wobble
        case .hearing:
            amount = Double(level) * envelope * wobble
        case .listening:
            // A slow breath, plus whatever the microphone hears
            amount = max(0.12 + 0.06 * sin(time * 2 + position * 0.5), Double(level) * envelope * 0.6)
        case .processing, .thinking:
            // A wave travelling across while the server works
            amount = 0.12 + 0.5 * max(0, sin(time * 6 - position * 0.6))
        case .idle:
            amount = 0.1
        }
        return minimumHeight + (maximumHeight - minimumHeight) * min(max(amount, 0), 1)
    }
}

/// What the voice loop is doing, as an icon and a word under the bars
struct StatusLabel: View {
    let activity: ConversationModel.Activity

    var body: some View {
        if let status {
            Label(status.text, systemImage: status.icon)
                .font(.caption2.weight(.medium))
                .foregroundStyle(status.color)
                .lineLimit(1)
                .contentTransition(.opacity)
        }
    }

    private var status: (text: String, icon: String, color: Color)? {
        switch activity {
        case .idle: nil
        case .speaking: ("Speaking", "speaker.wave.2.fill", .stepBlue)
        case .listening: ("Listening", "mic.fill", .secondary)
        case .hearing: ("Recording", "mic.fill", .stepGreen)
        case .processing: ("Processing", "waveform", .stepBlue)
        case .thinking: ("Thinking", "ellipsis", .stepBlue)
        }
    }
}

/// The bars and the status side by side, pinned to the bottom of the screen
/// so a glance shows whether the watch is speaking, listening or working,
/// however far the text above has scrolled
struct ActivityRow: View {
    let activity: ConversationModel.Activity
    let level: Float

    var body: some View {
        HStack(spacing: 6) {
            LevelBars(activity: activity, level: level, barCount: 9)
            StatusLabel(activity: activity)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 10)
        .padding(.bottom, 6)
        // Text scrolling under the row fades out instead of colliding with it
        .background {
            LinearGradient(colors: [.black.opacity(0), .black], startPoint: .top, endPoint: .center)
        }
        // Down in the strip between the screen's rounded corners, which
        // scrolling content only passes through
        .ignoresSafeArea(edges: .bottom)
    }
}

/// One dot per question: the current one long and blue, answered ones bright,
/// skipped ones dim
struct ProgressDots: View {
    let questions: [PlannedQuestion]
    let current: Int

    var body: some View {
        Group {
            // More dots, with the draft badge beside them, would run into the clock
            if questions.count > 8 {
                Text("\(current + 1) of \(questions.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
            } else {
                HStack(spacing: 4) {
                    ForEach(questions.indices, id: \.self) { index in
                        Capsule()
                            .fill(color(of: index))
                            .frame(width: index == current ? 14 : 6, height: 6)
                    }
                }
                .animation(.spring(duration: 0.3), value: current)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Question \(current + 1) of \(questions.count)")
    }

    private func color(of index: Int) -> Color {
        if index == current { return .stepBlue }
        switch questions[index].response {
        case nil, "": return .white.opacity(0.2)
        case skippedAnswer: return .white.opacity(0.35)
        default: return .white.opacity(0.75)
        }
    }
}

/// Shown once the server has written a draft, like the web app's "Draft Ready" chip
struct DraftBadge: View {
    var body: some View {
        Text("Draft")
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Capsule().fill(Color.stepGreen))
            .foregroundStyle(.black)
            .accessibilityLabel("Draft ready")
    }
}

/// The last command or message, floating at the bottom for three seconds
struct FeedbackToast: View {
    let feedback: ConversationModel.Feedback?

    var body: some View {
        ZStack {
            if let feedback {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Image(systemName: icon(for: feedback.kind))
                        .foregroundStyle(color(for: feedback.kind))
                    Text(feedback.message)
                        .font(.caption2.weight(.medium))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .frame(maxWidth: .infinity, alignment: .leading)
                // Opaque, so the question underneath doesn't show through the words
                .background(Color(white: 0.13), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(color(for: feedback.kind).opacity(0.6), lineWidth: 1)
                }
                .padding(.horizontal, 4)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .id(feedback.id)
            }
        }
        .animation(.spring(duration: 0.35), value: feedback?.id)
    }

    private func icon(for kind: ConversationModel.Feedback.Kind) -> String {
        switch kind {
        case .command: "bolt.fill"
        case .success: "checkmark.circle.fill"
        case .error: "exclamationmark.triangle.fill"
        }
    }

    private func color(for kind: ConversationModel.Feedback.Kind) -> Color {
        switch kind {
        case .command: .stepBlue
        case .success: .stepGreen
        case .error: .orange
        }
    }
}

/// A small round icon button. The voice is the main way in, so the buttons
/// stay out of the way.
struct RoundButton: View {
    let systemImage: String
    let label: String
    var tint: Color = .white
    let action: () -> Void

    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            RoundIcon(systemImage: systemImage, tint: tint)
        }
        .buttonStyle(.plain)
        .opacity(isEnabled ? 1 : 0.3)
        .accessibilityLabel(label)
    }
}

struct RoundIcon: View {
    let systemImage: String
    var tint: Color = .white

    var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: 38, height: 38)
            .background(Circle().fill(tint.opacity(0.18)))
            .contentShape(Circle())
    }
}
