import AVFoundation
import Observation

/// Runs one writing session the way the web app's hands-free mode does: read
/// a question aloud, listen for the answer, send it to the server, and repeat
/// until the server returns the finished text.
@MainActor
@Observable
final class ConversationModel {
    enum Phase: Equatable {
        case welcome
        /// Reading the question aloud
        case speaking
        /// Waiting for the answer to start
        case listening
        /// The answer is being spoken
        case hearing
        case transcribing
        /// Waiting for the next question or the finished text
        case thinking
        case finished(String)
        case failed(String)
    }

    private(set) var phase: Phase = .welcome
    private(set) var questions: [PlannedQuestion] = []
    /// The answer just heard, shown under the question until the next one comes
    private(set) var heardAnswer: String?
    private(set) var isReadingAloud = false

    @ObservationIgnored private let api = StepWriteAPI()
    @ObservationIgnored private let recorder = SpeechRecorder()
    /// Separate players, so stopping one never cuts off the other
    @ObservationIgnored private let questionPlayer = SpeechPlayer()
    @ObservationIgnored private let readingPlayer = SpeechPlayer()
    /// The step in progress; each user action replaces it
    @ObservationIgnored private var step: Task<Void, Never>?
    @ObservationIgnored private var reading: Task<Void, Never>?
    /// What "Try again" repeats after a failure
    @ObservationIgnored private var failedStep: (() async -> Void)?

    var currentQuestion: String {
        questions.last?.question ?? ""
    }

    /// The final text needs at least one real answer to be written from.
    var canFinish: Bool {
        questions.contains { question in
            guard let response = question.response else { return false }
            return !response.isEmpty && response != skippedAnswer
        }
    }

    /// Whether a request is in flight, during which the answer can't change
    var isBusy: Bool {
        phase == .transcribing || phase == .thinking
    }

    func start() {
        stopReadingAloud()
        questions = [PlannedQuestion(id: 1, question: "What would you like to write?")]
        heardAnswer = nil
        run { await self.askCurrentQuestion() }
    }

    func skipQuestion() {
        run { await self.submit(answer: skippedAnswer) }
    }

    func finishNow() {
        run { await self.submit(finish: true) }
    }

    func repeatQuestion() {
        run { await self.askCurrentQuestion() }
    }

    /// Ends the answer being spoken without waiting for a pause.
    func finishAnswer() {
        recorder.finishAnswer()
    }

    func tryAgain() {
        guard let failedStep else { return }
        run(failedStep)
    }

    func startOver() {
        stopReadingAloud()
        step?.cancel()
        phase = .welcome
    }

    func toggleReadingAloud(_ text: String) {
        if isReadingAloud {
            stopReadingAloud()
            return
        }
        isReadingAloud = true
        // A reading that was just stopped may still be winding down
        let previous = reading
        reading = Task {
            await previous?.value
            try? activateAudioSession()
            try? await readingPlayer.speak(text, using: api)
            if !Task.isCancelled {
                isReadingAloud = false
            }
        }
    }

    private func stopReadingAloud() {
        reading?.cancel()
        isReadingAloud = false
    }

    /// Replaces the step in progress. The new step waits for the old one to
    /// wind down, so two never use the microphone or speaker at once.
    private func run(_ work: @escaping () async -> Void) {
        let previous = step
        previous?.cancel()
        step = Task {
            await previous?.value
            await work()
        }
    }

    private func askCurrentQuestion() async {
        heardAnswer = nil
        phase = .speaking
        do {
            try activateAudioSession()
            try await questionPlayer.speak(currentQuestion, using: api)
            await listenForAnswer()
        } catch {
            fail(error, retry: askCurrentQuestion)
        }
    }

    private func listenForAnswer() async {
        do {
            while true {
                phase = .listening
                let recording = try await recorder.recordAnswer { phase = .hearing }
                guard let recording else { continue }
                defer { try? FileManager.default.removeItem(at: recording) }

                phase = .transcribing
                let text = try await api.transcribe(wavFile: recording)
                // Noise Whisper heard as nothing: keep listening
                if text.isEmpty { continue }

                await handle(spoken: text)
                return
            }
        } catch {
            fail(error, retry: listenForAnswer)
        }
    }

    private func handle(spoken text: String) async {
        switch VoiceCommand(transcription: text) {
        case .skip:
            await submit(answer: skippedAnswer)
        case .finish where canFinish:
            await submit(finish: true)
        case .repeatQuestion:
            await askCurrentQuestion()
        default:
            heardAnswer = text
            await submit(answer: text)
        }
    }

    private func submit(answer: String? = nil, finish: Bool = false) async {
        if let answer, !questions.isEmpty {
            questions[questions.count - 1].response = answer
        }
        phase = .thinking
        do {
            let planning = ConversationPlanning(questions: questions, followupNeeded: !finish)
            switch try await api.submitTurn(planning, finish: finish) {
            case .nextQuestion(let next):
                questions = next.questions
                await askCurrentQuestion()
            case .finished(let text):
                phase = .finished(text)
            }
        } catch {
            // The answer is already stored, so trying again only resends it
            fail(error) { await self.submit(finish: finish) }
        }
    }

    /// Shows the error with a way to retry, unless the step was cancelled
    /// because the user moved on.
    private func fail(_ error: Error, retry: @escaping () async -> Void) {
        guard !Task.isCancelled else { return }
        failedStep = retry
        phase = .failed(error.localizedDescription)
    }

    private func activateAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default)
        try session.setActive(true)
    }
}
