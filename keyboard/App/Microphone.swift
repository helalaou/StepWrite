import AVFoundation

/// The microphone input, kept running for as long as the keyboard may need it.
/// iOS lets an app in the background go on recording but not start, so the
/// input stays on between answers and for a few minutes after writing (Settings
/// > Keep the microphone on). Audio is kept only while an answer is being
/// listened for; the rest is dropped as it arrives.
final class Microphone: @unchecked Sendable {
    enum MicrophoneError: LocalizedError {
        case unavailable

        var errorDescription: String? {
            "The microphone isn't available. Check that no other app is using it, then try again."
        }
    }

    /// 16 kHz mono: what the web app sends, and plenty for Whisper
    static let sampleRate: Double = 16_000

    private let engine = AVAudioEngine()
    private let format = AVAudioFormat(
        commonFormat: .pcmFormatFloat32, sampleRate: Microphone.sampleRate, channels: 1, interleaved: false
    )!
    private var converter: AVAudioConverter?

    // Shared between the audio thread and the reader, under `lock`
    private let lock = NSLock()
    private var isCollecting = false
    private var samples: [Float] = []
    private var sumOfSquares: Double = 0
    private var sampleCount = 0

    var isRunning: Bool { engine.isRunning }

    /// Starts the input. The audio session must be active.
    func start() throws {
        guard !engine.isRunning else { return }
        let input = engine.inputNode
        let inputFormat = input.outputFormat(forBus: 0)
        guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0,
              let converter = AVAudioConverter(from: inputFormat, to: format) else {
            throw MicrophoneError.unavailable
        }
        self.converter = converter
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 4_096, format: inputFormat) { [weak self] buffer, _ in
            self?.receive(buffer)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            throw error
        }
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        collect(false)
    }

    /// Starts or stops keeping what the microphone hears, dropping anything kept so far
    func collect(_ collecting: Bool) {
#if DEBUG && targetEnvironment(simulator)
        if collecting {
            SimulatorAnswers.shared.loadNext()
        } else {
            SimulatorAnswers.shared.clear()
        }
#endif
        lock.withLock {
            isCollecting = collecting
            samples.removeAll(keepingCapacity: collecting)
            sumOfSquares = 0
            sampleCount = 0
        }
    }

    /// The samples heard since the last call, and their loudness in dBFS, or
    /// nil when nothing arrived since
    func take() -> (samples: [Float], level: Float?) {
        lock.withLock {
            let taken = samples
            let level = sampleCount > 0 ? Float(10 * log10(max(sumOfSquares / Double(sampleCount), 1e-12))) : nil
            samples.removeAll(keepingCapacity: true)
            sumOfSquares = 0
            sampleCount = 0
            return (taken, level)
        }
    }

    /// On the audio thread: converts to 16 kHz mono and keeps the result while collecting.
    private func receive(_ buffer: AVAudioPCMBuffer) {
        guard lock.withLock({ isCollecting }), let converter else { return }
        let ratio = format.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 64
        guard let converted = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else { return }
        var supplied = false
        var error: NSError?
        converter.convert(to: converted, error: &error) { _, status in
            if supplied {
                status.pointee = .noDataNow
                return nil
            }
            supplied = true
            status.pointee = .haveData
            return buffer
        }
        guard error == nil, let channel = converted.floatChannelData?[0] else { return }
        var chunk = Array(UnsafeBufferPointer(start: channel, count: Int(converted.frameLength)))
#if DEBUG && targetEnvironment(simulator)
        SimulatorAnswers.shared.replace(&chunk)
#endif
        let squares = chunk.reduce(0) { $0 + Double($1 * $1) }
        lock.withLock {
            guard isCollecting else { return }
            samples.append(contentsOf: chunk)
            sumOfSquares += squares
            sampleCount += chunk.count
        }
    }
}

/// 16-bit PCM WAV files, for the server's transcription and the app's own tones
enum WAV {
    static func data(samples: [Float], sampleRate: Double) -> Data {
        var pcm = Data(capacity: samples.count * 2)
        for sample in samples {
            var value = Int16(max(-1, min(1, sample)) * Float(Int16.max)).littleEndian
            withUnsafeBytes(of: &value) { pcm.append(contentsOf: $0) }
        }
        var header = Data()
        func append<Value: FixedWidthInteger>(_ value: Value) {
            var little = value.littleEndian
            withUnsafeBytes(of: &little) { header.append(contentsOf: $0) }
        }
        let rate = UInt32(sampleRate)
        header.append(Data("RIFF".utf8))
        append(UInt32(36 + pcm.count))
        header.append(Data("WAVEfmt ".utf8))
        append(UInt32(16))      // size of the format chunk
        append(UInt16(1))       // PCM
        append(UInt16(1))       // mono
        append(rate)
        append(rate * 2)        // bytes per second
        append(UInt16(2))       // bytes per frame
        append(UInt16(16))      // bits per sample
        header.append(Data("data".utf8))
        append(UInt32(pcm.count))
        return header + pcm
    }
}
