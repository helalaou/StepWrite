#if DEBUG && targetEnvironment(simulator)
import AVFoundation

/// Spoken answers for trying the app in the simulator, whose microphone input
/// doesn't carry the Mac's microphone. Put WAV files in the app's
/// Documents/SimulatorAnswers folder (keyboard/README.md shows how). Each time
/// the app listens, the next file, by name, plays into the microphone input a
/// second after listening starts, so the silence detection, the transcription
/// and the server see it as a spoken answer. Debug builds for the simulator
/// only; a phone always uses its microphone.
final class SimulatorAnswers: @unchecked Sendable {
    static let shared = SimulatorAnswers()

    private let lock = NSLock()
    /// The answer playing, at the microphone's 16 kHz
    private var answer: [Float] = []
    private var position = 0
    /// Microphone samples to let through before the answer starts
    private var delay = 0

    private var folder: URL? {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?
            .appendingPathComponent("SimulatorAnswers")
    }

    /// Takes the next answer file, if there is one, moving it to Used/
    func loadNext() {
        guard let folder,
              let files = try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil),
              let next = files.filter({ $0.pathExtension.lowercased() == "wav" })
                  .sorted(by: { $0.lastPathComponent < $1.lastPathComponent }).first else {
            clear()
            return
        }
        let samples = Self.samples(of: next)
        let used = folder.appendingPathComponent("Used")
        try? FileManager.default.createDirectory(at: used, withIntermediateDirectories: true)
        try? FileManager.default.moveItem(at: next, to: used.appendingPathComponent(next.lastPathComponent))
        lock.withLock {
            answer = samples
            position = 0
            delay = Int(Microphone.sampleRate)
        }
    }

    func clear() {
        lock.withLock {
            answer = []
            position = 0
        }
    }

    /// On the audio thread: replaces microphone samples with the answer's
    func replace(_ chunk: inout [Float]) {
        lock.withLock {
            guard position < answer.count else { return }
            for index in chunk.indices {
                if delay > 0 {
                    delay -= 1
                } else if position < answer.count {
                    chunk[index] = answer[position]
                    position += 1
                }
            }
        }
    }

    /// The file's audio as 16 kHz mono
    private static func samples(of url: URL) -> [Float] {
        guard let file = try? AVAudioFile(forReading: url),
              let target = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: Microphone.sampleRate,
                                         channels: 1, interleaved: false),
              let converter = AVAudioConverter(from: file.processingFormat, to: target),
              let input = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
              (try? file.read(into: input)) != nil else {
            return []
        }
        let ratio = target.sampleRate / file.processingFormat.sampleRate
        guard let output = AVAudioPCMBuffer(pcmFormat: target,
                                            frameCapacity: AVAudioFrameCount(Double(input.frameLength) * ratio) + 1_024) else {
            return []
        }
        var supplied = false
        converter.convert(to: output, error: nil) { _, status in
            if supplied {
                status.pointee = .endOfStream
                return nil
            }
            supplied = true
            status.pointee = .haveData
            return input
        }
        guard let channel = output.floatChannelData?[0] else { return [] }
        return Array(UnsafeBufferPointer(start: channel, count: Int(output.frameLength)))
    }
}
#endif
