import SwiftUI

/// The watch's settings. Each change applies at once and is kept on the watch;
/// the voice loop waits while this screen is open.
struct SettingsScreen: View {
    @Bindable private var settings = AppSettings.shared

    var body: some View {
        NavigationStack {
            Form {
                Section("Reading aloud") {
                    Picker("Voice", selection: $settings.voice) {
                        ForEach(AppSettings.voices, id: \.self) { voice in
                            Text(voice.capitalized).tag(voice)
                        }
                    }
                    Picker("Speed", selection: $settings.readingSpeed) {
                        ForEach(AppSettings.readingSpeeds, id: \.self) { speed in
                            Text("\(speed.formatted())×").tag(speed)
                        }
                    }
                }

                Section("Listening") {
                    Picker("Send answer after", selection: $settings.answerPause) {
                        ForEach(AppSettings.answerPauses, id: \.self) { seconds in
                            Text("\(seconds.formatted()) s pause").tag(seconds)
                        }
                    }
                    Picker("Ask again after", selection: $settings.repeatAfter) {
                        ForEach(AppSettings.repeatDelays, id: \.self) { seconds in
                            Text(seconds > 0 ? "\(seconds.formatted()) s" : "Never").tag(seconds)
                        }
                    }
                    Toggle("Taps on the wrist", isOn: $settings.haptics)
                    Toggle("Start when opened", isOn: $settings.startsOnLaunch)
                }

                Section {
                    ServerAddress(settings: settings)
                } header: {
                    Text("Server")
                } footer: {
                    Text("A watch needs an HTTPS address it can reach, such as your server's tunnel.")
                }

                Section {
                    Button("Reset all", role: .destructive, action: settings.reset)
                } footer: {
                    if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
                        Text("StepWrite \(version)")
                    }
                }
            }
            .navigationTitle("Settings")
            // Black like the rest of the app, rather than a blur of the screen underneath
            .containerBackground(.black, for: .navigation)
        }
    }
}

/// The server address, checked before it replaces the one in use, so a
/// mistyped address never cuts the watch off from a working server
private struct ServerAddress: View {
    let settings: AppSettings

    private enum Status {
        case checking, connected, unreachable, invalid
    }

    @State private var draft = ""
    @State private var status: Status?

    var body: some View {
        TextField("Server address", text: $draft)
            .textContentType(.URL)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .onSubmit(check)
            .onAppear { draft = settings.serverURL.absoluteString }

        Button(action: check) {
            Label(status == .checking ? "Checking…" : "Check and use", systemImage: "network")
        }
        .disabled(status == .checking)

        if let status, status != .checking {
            Label(message(for: status), systemImage: status == .connected ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .font(.footnote)
                .foregroundStyle(status == .connected ? Color.stepGreen : .orange)
        }

        if settings.serverURL != ServerSettings.baseURL {
            Button("Use this build's server") {
                draft = ServerSettings.baseURL.absoluteString
                check()
            }
        }
    }

    private func message(for status: Status) -> String {
        switch status {
        case .checking: ""
        case .connected: "Connected. StepWrite uses this server now."
        case .unreachable: "No StepWrite server answered there, so the old one is kept."
        case .invalid: "Enter an address that starts with https://"
        }
    }

    private func check() {
        guard let url = AppSettings.serverURL(from: draft) else {
            status = .invalid
            return
        }
        status = .checking
        Task {
            if await StepWriteAPI(baseURL: url).isStepWriteServer() {
                settings.serverURL = url
                draft = url.absoluteString
                status = .connected
            } else {
                status = .unreachable
            }
        }
    }
}

/// The small gear in the clock's row of the text screen
struct SettingsGear: View {
    let model: ConversationModel

    var body: some View {
        Button(action: model.openSettings) {
            Image(systemName: "gearshape.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(width: 26, height: 26)
                .background(Circle().fill(.white.opacity(0.12)))
                // A little bigger to the finger than it looks
                .contentShape(Circle().inset(by: -5))
        }
        .buttonStyle(.plain)
        .disabled(model.isBusy)
        .accessibilityLabel("Settings")
    }
}

/// The labelled gear that opens Settings from the home screen
struct SettingsButton: View {
    let model: ConversationModel

    var body: some View {
        Button(action: model.openSettings) {
            Label("Settings", systemImage: "gearshape.fill")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Capsule().fill(.white.opacity(0.12)))
        }
        .buttonStyle(.plain)
        .disabled(model.isBusy)
        .frame(maxWidth: .infinity)
    }
}
