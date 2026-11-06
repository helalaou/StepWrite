import SwiftUI

/// The server, the voice and the timings, as in the watch app's Settings
struct SettingsView: View {
    @State private var settings = AppSettings.shared
    @State private var address = AppSettings.shared.serverURL.absoluteString
    @State private var check: ServerCheck = .unchecked

    private enum ServerCheck: Equatable {
        case unchecked, checking, works, fails, invalid
    }

    var body: some View {
        Form {
            Section {
                TextField("https://example.ngrok.app", text: $address)
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onSubmit(save)
                Button(check == .checking ? "Checking…" : "Save and check", action: save)
                    .disabled(check == .checking)
                switch check {
                case .works:
                    Label("A StepWrite server answers there.", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                case .fails:
                    Label("No StepWrite server answers there.", systemImage: "xmark.octagon.fill")
                        .foregroundStyle(.red)
                case .invalid:
                    Label("That isn't an http or https address.", systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                case .unchecked, .checking:
                    EmptyView()
                }
            } header: {
                Text("Server")
            } footer: {
                Text("The simulator reaches the server on your Mac at http://localhost:3001. A phone needs an address it can reach, such as the ngrok tunnel's.")
            }

            Section("Voice") {
                Picker("Voice", selection: $settings.voice) {
                    ForEach(AppSettings.voices, id: \.self) { Text($0.capitalized) }
                }
                Picker("Speed", selection: $settings.readingSpeed) {
                    ForEach(AppSettings.readingSpeeds, id: \.self) { Text("\($0.formatted())×") }
                }
            }

            Section {
                Picker("Send answer after", selection: $settings.answerPause) {
                    ForEach(AppSettings.answerPauses, id: \.self) { Text("\($0.formatted()) s pause") }
                }
                Picker("Ask again after", selection: $settings.repeatAfter) {
                    ForEach(AppSettings.repeatDelays, id: \.self) { delay in
                        Text(delay == 0 ? "Never" : "\(delay.formatted()) s silence")
                    }
                }
                Picker("Keep the microphone on", selection: $settings.microphoneMinutes) {
                    ForEach(AppSettings.microphoneTimes, id: \.self) { Text("\($0.formatted()) min") }
                }
            } header: {
                Text("Listening")
            } footer: {
                Text("After writing, the microphone stays on for a while, so the next message starts from the keyboard without opening this app. iOS shows the orange dot while it is on.")
            }

            Section {
                Button("Reset Settings", role: .destructive) {
                    settings.reset()
                    address = settings.serverURL.absoluteString
                    check = .unchecked
                }
            }
        }
        .navigationTitle("Settings")
    }

    private func save() {
        guard let url = AppSettings.serverURL(from: address) else {
            check = .invalid
            return
        }
        settings.serverURL = url
        address = url.absoluteString
        check = .checking
        Task {
            check = await StepWriteAPI(baseURL: url).isStepWriteServer() ? .works : .fails
        }
    }
}

/// How the keyboard, this app and the server work together
struct HowItWorksView: View {
    var body: some View {
        List {
            Section {
                Step(symbol: "keyboard", title: "Switch to \(Brand.name)",
                     text: "In any chat, touch and hold 🌐 and choose \(Brand.name). It shows what you're replying to: the chat's messages when the app shares them, your latest screenshot, a message you copied and pasted, or the text around the cursor.")
                Step(symbol: "mic.fill", title: "Tap Reply by voice",
                     text: "If the microphone is off, this app opens to turn it on, since keyboards can't start it. Go back to the chat; it keeps listening.")
                Step(symbol: "questionmark.bubble", title: "Answer out loud",
                     text: "StepWrite asks a few short questions about what you want to say. Say \"skip\", \"repeat the question\" or \"finish writing\" at any time.")
                Step(symbol: "text.insert", title: "The message appears",
                     text: "The keyboard puts it in the text field. Read it, change it if you like, and send it.")
            }
            Section("Privacy") {
                Text("The keyboard sends what you're replying to, at most the last 10 messages, to your StepWrite server only when you tap Reply by voice. Your spoken answers go there too, to be transcribed and written. On the phone, the app keeps only the last message it wrote and what it replied to, until the next one.")
                    .font(.subheadline)
            }
        }
        .navigationTitle("How it works")
    }

    private struct Step: View {
        let symbol: String
        let title: String
        let text: String

        var body: some View {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: symbol)
                    .font(.title3)
                    .foregroundStyle(Brand.accent)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.headline)
                    Text(text).font(.subheadline).foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
        }
    }
}
