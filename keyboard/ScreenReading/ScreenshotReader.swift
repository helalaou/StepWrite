import UIKit
import Vision

/// Reads the messages in a chat screenshot with Vision. Chat apps put the other
/// person's bubbles on the left and the user's on the right, so each line's
/// side says who sent it. Lines centred on the screen are the chat's name,
/// dates and times.
enum ScreenshotReader {
    enum ReadError: LocalizedError {
        case noText

        var errorDescription: String? {
            "There are no messages in that picture. Take a screenshot of the chat and try again."
        }
    }

    private struct Line {
        enum Side { case left, right, centre }

        let text: String
        /// Vision's normalized box: origin at the bottom left, 0 to 1
        let box: CGRect

        var side: Side {
            let leftMargin = box.minX
            let rightMargin = 1 - box.maxX
            if abs(leftMargin - rightMargin) < 0.08 { return .centre }
            return leftMargin < rightMargin ? .left : .right
        }
    }

    /// Status words chat apps show under a bubble, which aren't messages
    private static let statusWords: Set<String> = ["delivered", "read", "sent", "seen", "edited", "typing..."]

    static func conversation(in image: UIImage) async throws -> ConversationSnapshot {
        guard let cgImage = image.cgImage else { throw ReadError.noText }
        let orientation = CGImagePropertyOrientation(image.imageOrientation)
        let lines = try await Task.detached(priority: .userInitiated) {
            try recognizeLines(in: cgImage, orientation: orientation)
        }.value
        let snapshot = conversation(from: lines)
        guard !snapshot.messages.isEmpty else { throw ReadError.noText }
        return snapshot
    }

    private static func recognizeLines(in image: CGImage, orientation: CGImagePropertyOrientation) throws -> [Line] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        try VNImageRequestHandler(cgImage: image, orientation: orientation).perform([request])
        return (request.results ?? []).compactMap { observation in
            guard let text = observation.topCandidates(1).first?.string else { return nil }
            return Line(text: text, box: observation.boundingBox)
        }
    }

    private static func conversation(from lines: [Line]) -> ConversationSnapshot {
        // Top to bottom, as the chat reads
        let ordered = lines.sorted { $0.box.maxY > $1.box.maxY }
        // The status bar is above 95%, and the chat's name is the first centred
        // line under it
        let title = ordered.first { $0.box.maxY < 0.95 && $0.box.minY > 0.75 && $0.side == .centre }?.text

        var messages: [ConversationSnapshot.Message] = []
        var previous: Line?
        for line in ordered where line.box.maxY < 0.95 && line.box.minY > 0.06 {
            let text = line.text.trimmingCharacters(in: .whitespaces)
            guard line.side != .centre, !isStatus(text) else {
                previous = nil
                continue
            }
            let isFromMe = line.side == .right
            // A line close under the last one on the same side is the same bubble
            if let previous, previous.side == line.side,
               previous.box.minY - line.box.maxY < line.box.height * 0.9,
               var last = messages.popLast() {
                last.text += " " + text
                messages.append(last)
            } else {
                messages.append(.init(sender: isFromMe ? "" : (title ?? ""), text: text, isFromMe: isFromMe))
            }
            previous = line
        }
        return ConversationSnapshot(source: .screenshot, messages: messages, title: title)
    }

    private static func isStatus(_ text: String) -> Bool {
        let lowered = text.lowercased()
        if statusWords.contains(lowered) { return true }
        // "Read 9:41 AM", "Delivered Yesterday", a time on its own
        if let first = lowered.split(separator: " ").first, statusWords.contains(String(first)) { return true }
        return lowered.range(of: #"^\d{1,2}:\d{2}(\s?[ap]m)?$"#, options: .regularExpression) != nil
    }
}

private extension CGImagePropertyOrientation {
    init(_ orientation: UIImage.Orientation) {
        switch orientation {
        case .up: self = .up
        case .down: self = .down
        case .left: self = .left
        case .right: self = .right
        case .upMirrored: self = .upMirrored
        case .downMirrored: self = .downMirrored
        case .leftMirrored: self = .leftMirrored
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}
