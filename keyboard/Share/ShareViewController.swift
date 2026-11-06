import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Takes a screenshot of a chat, or the text of a message, from the share
/// sheet. It reads the messages, keeps them for the keyboard, and sends the
/// user back to the chat to reply.
final class ShareViewController: UIViewController {
    private let model = ShareModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: ShareView(model: model) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil)
        })
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)

        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        Task { await model.read(providers) }
    }
}

@MainActor
@Observable
final class ShareModel {
    enum Status {
        case reading
        case ready(ConversationSnapshot)
        case failed(String)
    }

    private(set) var status: Status = .reading

    func read(_ providers: [NSItemProvider]) async {
        do {
            let snapshot = try await snapshot(from: providers)
            guard SharedStore.write(snapshot, to: .sharedContext) else {
                status = .failed("\(Brand.name) couldn't keep the messages. Open the app once, then try again.")
                return
            }
            Signal.contextChanged.post()
            status = .ready(snapshot)
        } catch {
            status = .failed(error.localizedDescription)
        }
    }

    private func snapshot(from providers: [NSItemProvider]) async throws -> ConversationSnapshot {
        if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier) }) {
            // Apps share a picture as a file, an image or its data
            let item = try await provider.loadItem(forTypeIdentifier: UTType.image.identifier)
            let picture: UIImage?
            switch item {
            case let url as URL: picture = UIImage(contentsOfFile: url.path)
            case let image as UIImage: picture = image
            case let data as Data: picture = UIImage(data: data)
            default: picture = nil
            }
            guard let picture else { throw ScreenshotReader.ReadError.noText }
            return try await ScreenshotReader.conversation(in: picture)
        }
        if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) }),
           let text = try await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
            let messages = ConversationSnapshot.messages(fromText: text)
            if !messages.isEmpty {
                return ConversationSnapshot(source: .shared, messages: messages)
            }
        }
        throw ScreenshotReader.ReadError.noText
    }
}

private struct ShareView: View {
    let model: ShareModel
    let done: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                switch model.status {
                case .reading:
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("Reading the messages…")
                    }
                case .ready(let snapshot):
                    Label("Ready to reply", systemImage: "checkmark.circle.fill")
                        .font(.headline)
                        .foregroundStyle(.green)
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(snapshot.messages.suffix(4).enumerated()), id: \.offset) { _, message in
                            Text(message.text)
                                .font(.subheadline)
                                .lineLimit(2)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(message.isFromMe ? Brand.accent.opacity(0.18) : Color(.secondarySystemBackground),
                                            in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .frame(maxWidth: .infinity, alignment: message.isFromMe ? .trailing : .leading)
                        }
                    }
                    Text("Go back to the chat, switch to the \(Brand.name) keyboard with 🌐 and tap Reply by voice.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                case .failed(let message):
                    Label(message, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                }
                Spacer()
            }
            .padding(20)
            .navigationTitle(Brand.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: done)
                }
            }
        }
        .tint(Brand.accent)
    }
}
