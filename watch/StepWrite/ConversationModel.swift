import AVFoundation
import Observation

/// Runs a writing session the way the web app's hands-free mode does
/// (client/src/components/HandsFreeInterface.js): read a question aloud, listen
/// for the answer or a voice command, send answers to the server, and read the
/// finished text aloud. Nothing needs a tap; the buttons send the same commands
/// a user can say.
@MainActor
@Observable
final class ConversationModel {
    enum Screen: Equatable {
        case home
        case questions
        /// The finished text, or the draft so far when `isDraft`
        case text
        case failed(String)
    }

    /// What the voice loop is doing, shown by the indicators
    enum Activity: Equatable {
        case idle
        /// Reading a question, the text or a message aloud
        case speaking
        /// The microphone is open, waiting for speech
        case listening
        /// Speech is being recorded
        case hearing
        /// The recording is being transcribed
        case processing
        /// Waiting for the server's next question or text
        case thinking
    }

    /// A short message shown at the bottom of the screen, and spoken
    struct Feedback: Equatable, Identifiable {
        enum Kind { case command, success, error }

        let id = UUID()
        let kind: Kind
        let message: String
    }

    private(set) var screen: Screen = .home
    private(set) var activity: Activity = .idle
    /// The input level while listening, or the output level while speaking, from 0 to 1
    private(set) var level: Float = 0
    private(set) var questions: [PlannedQuestion] = []
    private(set) var index = 0
    private(set) var isPaused = false
    /// The next answer replaces the current question's answer
    private(set) var isModifying = false
    private(set) var feedback: Feedback?
    /// What the text screen shows
    private(set) var text = ""
    private(set) var isDraft = false
    private(set) var isDraftReady = false
    /// Settings is open, and the voice loop waits for it to close
    private(set) var isShowingSettings = false

    /// How long one recording lasts while only commands are listened for
    private let commandListeningWindow: Duration = .seconds(30)

    @ObservationIgnored private let settings = AppSettings.shared
    /// Made for each request, so a server or voice chosen in Settings applies at once
    private var api: StepWriteAPI {
        StepWriteAPI(baseURL: settings.serverURL, voice: settings.voice)
    }
    @ObservationIgnored private let recorder = SpeechRecorder()
    @ObservationIgnored private let voice = SpeechPlayer()
    @ObservationIgnored private var hasLaunched = false
    /// The voice loop in progress; each user action replaces it
    @ObservationIgnored private var loop: Task<Void, Never>?
    /// What "Try again" repeats, and the screen it runs on
    @ObservationIgnored private var failedOperation: (() async throws -> Step?)?
    @ObservationIgnored private var screenBeforeFailure: Screen = .home
    @ObservationIgnored private var feedbackDismissal: Task<Void, Never>?
    /// The questions as the server last saw them, for telling it what an edit replaced
    @ObservationIgnored private var serverQuestions: [PlannedQuestion] = []
    @ObservationIgnored private var backgroundDraft: BackgroundDraft?
    @ObservationIgnored private var hasAnnouncedDraft = false
    @ObservationIgnored private var finalText: String?
    /// The user went back from the finished text to the questions
    @ObservationIgnored private var cameFromText = false
    /// An answer changed since the finished text was written
    @ObservationIgnored private var hasChanges = false

    /// One step of the voice loop; each returns the step that follows.
    private enum Step {
        /// Read the current question aloud, then listen
        case ask
        case listen
        /// Read the text aloud, then listen for commands
        case read
        case submit(answer: String, index: Int, replacesAnswer: Bool)
        case finish
    }

    var currentQuestion: PlannedQuestion? {
        questions.indices.contains(index) ? questions[index] : nil
    }

    /// The current question's answer, which is the skipped marker for a skipped question
    var currentAnswer: String? {
        guard let response = currentQuestion?.response, !response.isEmpty else { return nil }
        return response
    }

    /// The final text needs at least one real answer to be written from.
    var canFinish: Bool {
        questions.contains { Self.isRealAnswer($0.response) }
    }

    /// Whether a request is in flight, during which nothing can change
    var isBusy: Bool {
        activity == .processing || activity == .thinking
    }

    // MARK: - Actions

    /// Starts writing as soon as the app opens, so it can be used without touching it.
    func startOnLaunch() {
        guard !hasLaunched else { return }
        hasLaunched = true
        if settings.startsOnLaunch {
            start()
        }
    }

    func start() {
        questions = [PlannedQuestion(id: 1, question: "What would you like to write?")]
        serverQuestions = []
        index = 0
        isPaused = false
        isModifying = false
        backgroundDraft = nil
        isDraftReady = false
        hasAnnouncedDraft = false
        finalText = nil
        cameFromText = false
        hasChanges = false
        screen = .questions
        run { .ask }
    }

    /// Does what saying `command` does.
    func send(_ command: VoiceCommand) {
        run { try await self.execute(command) }
    }

    func tryAgain() {
        guard let failedOperation else { return }
        screen = screenBeforeFailure
        run(failedOperation)
    }

    /// Stops the voice loop, so nothing is said or heard while Settings is open
    func openSettings() {
        loop?.cancel()
        loop = nil
        voice.stop()
        activity = .idle
        isShowingSettings = true
    }

    /// Picks up where Settings interrupted: the question is read again, in the
    /// voice and at the speed just chosen
    func closeSettings() {
        isShowingSettings = false
        switch screen {
        case .questions:
            run { self.isPaused ? .listen : .ask }
        case .text:
            run { .listen }
        case .home, .failed:
            break
        }
    }

    func goHome() {
        loop?.cancel()
        loop = nil
        activity = .idle
        isPaused = false
        isModifying = false
        screen = .home
    }

    // MARK: - Voice loop

    /// Replaces the loop in progress. The new loop waits for the old one to
    /// wind down, so two never use the microphone or speaker at once.
    private func run(_ first: @escaping () async throws -> Step?) {
        let previous = loop
        previous?.cancel()
        loop = Task {
            await previous?.value
            var operation = first
            while !Task.isCancelled {
                let next: Step?
                do {
                    next = try await operation()
                } catch {
                    // Cancelled requests fail with their own errors, such as URLError.cancelled
                    if !Task.isCancelled {
                        await fail(error, retry: operation)
                    }
                    return
                }
                guard let next else { return }
                operation = { try await self.perform(next) }
            }
        }
    }

    private func perform(_ step: Step) async throws -> Step? {
        switch step {
        case .ask:
            return try await askQuestion()
        case .listen:
            return try await listen()
        case .read:
            return try await readText()
        case let .submit(answer, index, replacesAnswer):
            return try await submit(answer, at: index, replacesAnswer: replacesAnswer)
        case .finish:
            return try await finish()
        }
    }

    private func askQuestion() async throws -> Step? {
        guard let question = currentQuestion else { return nil }
        try await speak(question.question)
        await Cues.listening()
        return .listen
    }

    private func listen() async throws -> Step? {
        activity = .listening
        try activateAudioSession()
        // As in the web app, an unanswered silence brings the question back,
        // except while paused, while a new answer is awaited, or when Settings
        // turned it off.
        let replayAfter = screen == .questions && !isPaused && !isModifying && settings.repeatAfter > 0
            ? Duration.seconds(settings.repeatAfter)
            : nil
        let recording = try await recorder.record(
            timeout: replayAfter ?? commandListeningWindow,
            endOfAnswerSilence: .seconds(settings.answerPause),
            onHearing: { self.activity = $0 ? .hearing : .listening },
            onLevel: { self.level = $0 }
        )
        guard case .speech(let file) = recording else {
            return replayAfter != nil ? .ask : .listen
        }
        defer { try? FileManager.default.removeItem(at: file) }

        activity = .processing
        let spoken: String
        do {
            spoken = try await api.transcribe(wavFile: file)
        } catch {
            if Task.isCancelled { throw CancellationError() }
            try await say("Speech recognition failed, please try again.", kind: .error)
            return .listen
        }
        // Noise Whisper heard as no words (nothing, or only punctuation): keep listening
        guard spoken.contains(where: { $0.isLetter || $0.isNumber }) else { return .listen }
        return try await handle(spoken)
    }

    /// Acts on what was said, in the order the web app checks it.
    private func handle(_ spoken: String) async throws -> Step? {
        if screen == .text {
            guard let command = VoiceCommand.match(spoken, among: VoiceCommand.textCommands) else {
                return .listen
            }
            return try await execute(command)
        }

        if isPaused {
            guard VoiceCommand.match(spoken, among: [.resume]) != nil else { return .listen }
            return try await execute(.resume)
        }
        if let command = VoiceCommand.match(spoken, among: VoiceCommand.questionCommands) {
            return try await execute(command)
        }
        if currentAnswer != nil && !isModifying {
            try await say("Say \"modify question\" to change your answer, or use navigation commands.", kind: .command)
            return .listen
        }
        return .submit(answer: spoken, index: index, replacesAnswer: isModifying)
    }

    private func execute(_ requested: VoiceCommand) async throws -> Step? {
        // An answered question has nothing to skip, so skipping moves on instead
        let command: VoiceCommand = requested == .skip && currentAnswer != nil && !isModifying ? .next : requested
        await Cues.click()

        switch command {
        case .pause:
            isPaused = true
            isModifying = false
            Cues.paused()
            try await say("Writing paused. Say \"continue writing\" to resume...", kind: .command)
            return .listen

        case .resume:
            isPaused = false
            try await say("Writing resumed.", kind: .command)
            return .listen

        case .finish:
            guard canFinish else {
                try await say("Answer at least one question first.", kind: .error)
                return .listen
            }
            isModifying = false
            try await say("Finishing writing and generating final text.", kind: .command)
            return .finish

        case .modify:
            isModifying = true
            try await say("Now modifying. Speak your new answer.", kind: .command)
            return .listen

        case .next:
            isModifying = false
            if index < questions.count - 1 {
                index += 1
                return .ask
            }
            if cameFromText, let text = textToReturnTo {
                try await say("Moving to editor view...", kind: .command)
                return show(text.content, isDraft: text.isDraft)
            }
            try await say("No more questions available yet", kind: .error)
            return .listen

        case .previous:
            isModifying = false
            guard index > 0 else {
                try await say("This is the first question!", kind: .error)
                return .listen
            }
            try await say("Moving to previous question...", kind: .command)
            index -= 1
            return .ask

        case .skip:
            try await say("Skipping this question...", kind: .command)
            return .submit(answer: skippedAnswer, index: index, replacesAnswer: isModifying)

        case .showText:
            guard let text = textToReturnTo else {
                try await say("There's no draft yet. Keep answering.", kind: .error)
                return .listen
            }
            return show(text.content, isDraft: text.isDraft)

        case .home, .endWriting:
            try await say("Returning to home page...", kind: .command)
            goHome()
            return nil

        case .repeatQuestion:
            return .ask

        case .readAgain:
            return .read

        case .stopReading:
            // Starting this command already stopped the reading
            return .listen

        case .backToQuestions:
            screen = .questions
            cameFromText = true
            hasChanges = false
            index = questions.count - 1
            return .ask
        }
    }

    private func submit(_ answer: String, at answerIndex: Int, replacesAnswer: Bool) async throws -> Step? {
        let previousAnswer = serverQuestions.indices.contains(answerIndex)
            ? serverQuestions[answerIndex].response ?? ""
            : ""
        questions[answerIndex].response = answer
        isModifying = false
        if cameFromText && answer != previousAnswer {
            hasChanges = true
        }
        activity = .thinking

        let change = StepWriteAPI.AnswerChange(index: answerIndex, answer: answer, previousAnswer: previousAnswer)
        switch try await api.submitTurn(planning(followupNeeded: true), change: change) {
        case .finished(let output):
            return finished(output)
        case .nextQuestion(let next):
            questions = next.questions
            serverQuestions = next.questions
            backgroundDraft = next.backgroundDraft ?? backgroundDraft
            updateDraftReady()
            await Cues.click()
            if isDraftReady && !hasAnnouncedDraft {
                hasAnnouncedDraft = true
                try await say("Draft ready!", kind: .success)
            }
            // After an edit, earlier questions may have been dropped; the
            // question to answer is always the last one.
            index = replacesAnswer ? questions.count - 1 : min(answerIndex + 1, questions.count - 1)
            return .ask
        }
    }

    private func finish() async throws -> Step? {
        if currentAnswer == nil {
            questions[index].response = skippedAnswer
        }
        activity = .thinking
        let result = try await api.submitTurn(planning(followupNeeded: false), finish: true)
        guard case .finished(let output) = result else {
            throw StepWriteAPI.APIError.unexpectedResponse
        }
        return finished(output)
    }

    private func finished(_ output: String) -> Step {
        finalText = output
        serverQuestions = questions
        hasChanges = false
        Cues.success()
        return show(output, isDraft: false)
    }

    private func show(_ content: String, isDraft: Bool) -> Step {
        text = content
        self.isDraft = isDraft
        isModifying = false
        isPaused = false
        screen = .text
        return .read
    }

    private func readText() async throws -> Step? {
        // The web app's editor reads its text with the same introduction
        let introduction = isDraft ? "Here is your draft so far:" : "The final output is:"
        try await speak("\(introduction) \(text)")
        return .listen
    }

    // MARK: - Helpers

    /// The finished text while the answers are unchanged, otherwise the latest draft
    private var textToReturnTo: (content: String, isDraft: Bool)? {
        if let finalText, !hasChanges {
            return (finalText, false)
        }
        if isDraftReady, let draft = backgroundDraft?.content {
            return (draft, true)
        }
        return nil
    }

    private func planning(followupNeeded: Bool) -> ConversationPlanning {
        ConversationPlanning(questions: questions, followupNeeded: followupNeeded, backgroundDraft: backgroundDraft)
    }

    /// A draft is offered once three questions have real answers, as in the web app.
    private func updateDraftReady() {
        let realAnswers = questions.filter { Self.isRealAnswer($0.response) }.count
        isDraftReady = !(backgroundDraft?.content.isEmpty ?? true) && realAnswers >= 3
    }

    private static func isRealAnswer(_ response: String?) -> Bool {
        guard let response, !response.isEmpty else { return false }
        return response != skippedAnswer
    }

    private func speak(_ text: String, cacheName: String? = nil) async throws {
        activity = .speaking
        try activateAudioSession()
        try await voice.speak(text, using: api, cacheName: cacheName, rate: Float(settings.readingSpeed)) { self.level = $0 }
    }

    /// Shows a message and speaks it. Messages are cached on the server under
    /// the same names the web app uses, so both apps share the clips.
    private func say(_ message: String, kind: Feedback.Kind) async throws {
        let shown = Feedback(kind: kind, message: message)
        feedback = shown
        feedbackDismissal?.cancel()
        feedbackDismissal = Task {
            try? await Task.sleep(for: .seconds(3))
            if !Task.isCancelled && feedback?.id == shown.id {
                feedback = nil
            }
        }
        if kind == .error {
            Cues.failure()
        }
        try await speak(message, cacheName: Self.cacheName(for: message, voice: settings.voice))
    }

    /// The web app's file name for a spoken message: `feedback_`, the voice,
    /// and the first 30 characters of the message, lower-cased, with spaces as
    /// underscores.
    private static func cacheName(for message: String, voice: String) -> String {
        let kept = message.lowercased().filter { character in
            (character.isASCII && (character.isLetter || character.isNumber)) || character.isWhitespace
        }
        let name = kept.split(whereSeparator: \.isWhitespace).joined(separator: "_")
        return "feedback_\(voice)_\(name.prefix(30)).mp3"
    }

    /// Shows the error with a way to retry, and says it in the watch's own
    /// voice, which works even when the server can't be reached.
    private func fail(_ error: Error, retry: @escaping () async throws -> Step?) async {
        screenBeforeFailure = screen
        failedOperation = retry
        activity = .idle
        isModifying = false
        screen = .failed(error.localizedDescription)
        Cues.failure()
        try? await voice.speak(error.localizedDescription, using: nil, rate: Float(settings.readingSpeed))
    }

    private func activateAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default)
        try session.setActive(true)
    }
}
