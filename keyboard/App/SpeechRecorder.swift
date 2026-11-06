import Foundation

/// Records one spoken answer, the way the watch app does
/// (watch/StepWrite/SpeechRecorder.swift): it waits for speech to start and
/// stops once the speaker pauses, so nobody has to touch the phone to end an
/// answer. Speech is told apart from background noise by how much louder it
/// is than the measured noise floor. It reads the always-on `Microphone`
/// instead of starting a recorder, which iOS wouldn't allow in the background.
@MainActor
final class SpeechRecorder {
    enum Recording {
        /// WAV audio with the speech
        case speech(Data)
        /// Nobody spoke before the timeout
        case silence
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
    /// An answer must be loud for this long in all, so a knock isn't sent,
    /// which Whisper would turn into words such as "Thank you for watching".
    private let minimumSpeech: Duration = .milliseconds(300)
    private let maximumAnswerLength: Duration = .seconds(90)
    /// Audio kept from before speech starts, so the first word isn't cut
    private let preRoll = Int(Microphone.sampleRate * 0.4)

    /// Records until the speaker pauses for `endOfAnswerSilence` after
    /// speaking, or until `timeout` passes without speech. `onHearing` is
    /// called with true when speech starts, and with false if it turns out to
    /// be only a noise. Cancelling the calling task stops the recording.
    func record(
        from microphone: Microphone,
        timeout: Duration,
        endOfAnswerSilence: Duration,
        onHearing: (Bool) -> Void
    ) async throws -> Recording {
        microphone.collect(true)
        defer { microphone.collect(false) }

        let clock = ContinuousClock()
        let listeningStart = clock.now
        var audio: [Float] = []
        /// Levels heard before the answer started, oldest first
        var recentLevels: [Float] = []
        let noiseWindowPolls = Int(noiseWindow / pollInterval)
        var loudSince: ContinuousClock.Instant?
        var speechStart: ContinuousClock.Instant?
        var lastSpeech = listeningStart
        /// How long the input has been loud since the answer started
        var speechHeard: Duration = .zero
        var level: Float = -120

        while true {
            try await Task.sleep(for: pollInterval)
            let now = clock.now
            // The input arrives in buffers of about 0.1 s, so some polls get
            // nothing new; they keep the last level rather than count as silence.
            let (samples, newLevel) = microphone.take()
            if let newLevel {
                level = newLevel
            }
            audio.append(contentsOf: samples)

            // The floor stops moving once the answer starts, so speech never raises it
            if speechStart == nil {
                if audio.count > preRoll {
                    audio.removeFirst(audio.count - preRoll)
                }
                recentLevels.append(level)
                if recentLevels.count > noiseWindowPolls {
                    recentLevels.removeFirst()
                }
            }
            let noiseFloor = recentLevels.sorted()[recentLevels.count / 5]
            let isLoud = level > max(noiseFloor + speechMargin, minimumSpeechLevel)
            loudSince = isLoud ? (loudSince ?? now) : nil

            if let start = speechStart {
                if isLoud {
                    speechHeard += pollInterval
                }
                if let loudSince, now - loudSince >= sustainedSpeech {
                    lastSpeech = now
                }
                if now - lastSpeech >= endOfAnswerSilence || now - start >= maximumAnswerLength {
                    if speechHeard >= minimumSpeech {
                        return .speech(WAV.data(samples: audio, sampleRate: Microphone.sampleRate))
                    }
                    // Only a noise: listen again without it
                    audio.removeAll()
                    speechStart = nil
                    onHearing(false)
                }
            } else if let loudSince, now - loudSince >= speechOnset, now - listeningStart >= warmUp {
                speechStart = now
                lastSpeech = now
                speechHeard = speechOnset
                onHearing(true)
            } else if loudSince == nil, now - listeningStart >= timeout {
                return .silence
            }
        }
    }
}
