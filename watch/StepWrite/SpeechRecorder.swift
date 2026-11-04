import AVFoundation

/// Records one spoken answer from the watch microphone. Like the web app's
/// voice activity detection, it waits for speech to start and stops once the
/// speaker pauses. Speech is told apart from background noise by how much
/// louder it is than the measured noise floor.
@MainActor
final class SpeechRecorder {
    enum RecorderError: LocalizedError {
        case microphoneDenied
        case couldNotRecord

        var errorDescription: String? {
            switch self {
            case .microphoneDenied:
                return "StepWrite can't use the microphone. Allow it in Settings > Privacy & Security > Microphone, then try again."
            case .couldNotRecord:
                return "The microphone couldn't start."
            }
        }
    }

    /// How often the input level is checked
    private let pollInterval: Duration = .milliseconds(50)
    /// How far above the noise floor, in dB, the input must be to count as speech
    private let speechMargin: Float = 12
    /// Input quieter than this (dBFS) is never speech, however quiet the room
    private let minimumSpeechLevel: Float = -50
    /// The noise floor is a low percentile of the levels over this window, so
    /// short noises don't raise it
    private let noiseWindow: Duration = .seconds(3)
    /// Levels gathered before speech may start, for a first noise floor
    private let warmUp: Duration = .milliseconds(300)
    /// Speech must last this long to start an answer, so clicks and bumps don't
    private let speechOnset: Duration = .milliseconds(150)
    /// Loudness this long counts as more speech; shorter spikes are noise
    private let sustainedSpeech: Duration = .milliseconds(100)
    /// Silence this long after speech ends the answer (the web app waits 1 s)
    private let endOfAnswerSilence: Duration = .milliseconds(1200)
    /// While nobody speaks, the recording restarts this often to stay short
    private let idleRestartInterval: Duration = .seconds(10)
    private let maximumAnswerLength: Duration = .seconds(90)

    private var finishRequested = false

    /// Ends the answer being recorded now, as if the speaker had paused.
    func finishAnswer() {
        finishRequested = true
    }

    /// Records until the speaker pauses after speaking and returns the WAV file
    /// (the caller deletes it), or nil if `finishAnswer()` was called before any
    /// speech. Cancelling the calling task stops the recording.
    func recordAnswer(onSpeechStart: () -> Void) async throws -> URL? {
        guard await AVAudioApplication.requestRecordPermission() else {
            throw RecorderError.microphoneDenied
        }
        finishRequested = false

        let file = FileManager.default.temporaryDirectory
            .appendingPathComponent("answer-\(UUID().uuidString).wav")
        // 16 kHz mono PCM: what the web app sends, and plenty for Whisper
        let recorder = try AVAudioRecorder(url: file, settings: [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: 16_000,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
        ])
        recorder.isMeteringEnabled = true
        // Stopping writes the WAV header, so the file is complete once this returns
        defer { recorder.stop() }
        guard recorder.record() else {
            throw RecorderError.couldNotRecord
        }

        let clock = ContinuousClock()
        let listeningStart = clock.now
        var recordingStart = listeningStart
        /// Levels heard before the answer started, oldest first
        var recentLevels: [Float] = []
        let noiseWindowPolls = Int(noiseWindow / pollInterval)
        var loudSince: ContinuousClock.Instant?
        var speechStart: ContinuousClock.Instant?
        var lastSpeech = listeningStart

        while true {
            try await Task.sleep(for: pollInterval)
            let now = clock.now
            recorder.updateMeters()
            let level = recorder.averagePower(forChannel: 0)

            // The floor stops moving once the answer starts, so speech never raises it
            if speechStart == nil {
                recentLevels.append(level)
                if recentLevels.count > noiseWindowPolls {
                    recentLevels.removeFirst()
                }
            }
            let noiseFloor = recentLevels.sorted()[recentLevels.count / 5]
            let isLoud = level > max(noiseFloor + speechMargin, minimumSpeechLevel)
            loudSince = isLoud ? (loudSince ?? now) : nil

            if let speechStart {
                if let loudSince, now - loudSince >= sustainedSpeech {
                    lastSpeech = now
                }
                if finishRequested
                    || now - lastSpeech >= endOfAnswerSilence
                    || now - speechStart >= maximumAnswerLength {
                    return file
                }
                continue
            }

            if finishRequested {
                try? FileManager.default.removeItem(at: file)
                return nil
            }

            if let loudSince, now - loudSince >= speechOnset, now - listeningStart >= warmUp {
                speechStart = now
                lastSpeech = now
                onSpeechStart()
            } else if loudSince == nil, now - recordingStart >= idleRestartInterval {
                // Start the file over so it holds little silence before the answer
                recorder.stop()
                _ = recorder.deleteRecording()
                guard recorder.record() else {
                    throw RecorderError.couldNotRecord
                }
                recordingStart = now
            }
        }
    }

    /// Maps dBFS to 0...1 for drawing: -60 dB and below is 0, -10 dB is 1.
    static func normalized(_ decibels: Float) -> Float {
        min(max((decibels + 60) / 50, 0), 1)
    }
}
