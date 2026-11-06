import AVFoundation
import Observation
import UIKit

/// Runs StepWrite's questions and answers for the keyboard, the way the watch
/// app's ConversationModel does (watch/StepWrite/ConversationModel.swift): it
/// reads a question aloud, listens for the answer or a voice command, and
/// sends the answers to the server until the message is written.
///
/// It runs in this app rather than in the keyboard because a keyboard can't use
/// the microphone. The keyboard opens the app to start, the user goes back to
/// the chat, and the app goes on listening in the background. The keyboard
/// follows along through `state`, which is written to the shared container on
/// every change, and sends its buttons back as `KeyboardRequest`s.
@MainActor
@Observable
final class WritingSession {
    static let shared = WritingSession()

    enum SessionError: LocalizedError {
        case microphoneDenied
        case microphoneOff

        var errorDescription: String? {
            switch self {
            case .microphoneDenied:
                return "\(Brand.name) can't use the microphone. Allow it in Settings, then try again."
            case .microphoneOff:
                return "The microphone is off. Tap Start on the keyboard to open \(Brand.name) and turn it on."
            }
        }
    }

    /// What this app and the keyboard show
    private(set) var state = SessionState() {
        didSet { publish() }
    }
    /// The keyboard opened the app to start writing, so the app asks the user
    /// to go back to the chat
    var openedByKeyboard = false
    private(set) var isMicrophoneOn = false

    /// How long one recording lasts while only commands are listened for
    private let commandListeningWindow: Duration = .seconds(30)

    @ObservationIgnored private let settings = AppSettings.shared
    /// Made for each request, so a server or voice chosen in Settings applies at once
    private var api: StepWriteAPI {
        StepWriteAPI(baseURL: settings.serverURL, voice: settings.voice)
    }
    @ObservationIgnored private let microphone = Microphone()
    @ObservationIgnored private let recorder = SpeechRecorder()
    @ObservationIgnored private let voice = SpeechPlayer()
    @ObservationIgnored private var observers: [SignalObserver] = []
    @ObservationIgnored private var interruptionObserver: NSObjectProtocol?
    /// The voice loop in progress; each new action replaces it
    @ObservationIgnored private var loop: Task<Void, Never>?
    @ObservationIgnored private var microphoneTimer: Task<Void, Never>?
    @ObservationIgnored private var handledRequest: UUID?
    /// What "Try again" repeats
    @ObservationIgnored private var failedOperation: (() async throws -> Step?)?
    @ObservationIgnored private var context: ConversationSnapshot?

    // The conversation with the server
    @ObservationIgnored private var flow: StepWriteAPI.Flow = .write
    @ObservationIgnored private var questions: [PlannedQuestion] = []
    @ObservationIgnored private var index = 0
    /// The questions as the server last saw them, for telling it what an edit replaced
    @ObservationIgnored private var serverQuestions: [PlannedQuestion] = []
    @ObservationIgnored private var backgroundDraft: BackgroundDraft?
    @ObservationIgnored private var isPaused = false
    /// The next answer replaces the current question's answer
    @ObservationIgnored private var isModifying = false

    /// One step of the voice loop; each returns the step that follows.
    private enum Step {
        /// Read the current question aloud, then listen
        case ask
        case listen
        case submit(answer: String, index: Int, replacesAnswer: Bool)
        case finish
    }

    private var currentQuestion: PlannedQuestion? {
        questions.indices.contains(index) ? questions[index] : nil
    }

    /// The current question's answer, which is the skipped marker for a skipped question
    private var currentAnswer: String? {
        guard let response = currentQuestion?.response, !response.isEmpty else { return nil }
        return response
    }

    private init() {
        observers = [
            SignalObserver(.request) { [weak self] in self?.readRequest() },
            SignalObserver(.ping) { [weak self] in self?.answerPing() },
        ]
        // A phone call or another app taking the microphone stops the input
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] notification in
            let type = (notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt)
                .flatMap(AVAudioSession.InterruptionType.init)
            guard type == .began else { return }
            MainActor.assumeIsolated { self?.interrupted() }
        }
        // A session from an earlier run of the app has ended with it, and
        // so has its practice chat
        publish()
        SharedStore.remove(.practiceChat)
    }

    // MARK: - Requests from the keyboard

    /// Handles the app's link, which the keyboard opens when the app isn't
    /// running with the microphone on: stepwrite-voice://request
    func open(_ url: URL) {
        guard url.scheme == Brand.urlScheme, url.host == "request" else { return }
        openedByKeyboard = true
        readRequest()
    }

    /// Does what the keyboard last asked, once
    func readRequest() {
        guard let request = SharedStore.read(KeyboardRequest.self, from: .request),
              request.id != handledRequest,
              Date().timeIntervalSince(request.sentAt) < 120 else {
            return
        }
        handledRequest = request.id
        switch request.action {
        case .start:
            start(replyingTo: request.context, requestID: request.id)
        case .startFromScreenshot:
            startFromScreenshot(requestID: request.id)
        case .skip:
            send(.skip)
        case .finish:
            send(.finish)
        case .repeatQuestion:
            send(.repeatQuestion)
        case .stop:
            stop()
        case .retry:
            retry()
        case .closeMicrophone:
            stop()
            closeMicrophone()
        }
    }

    /// Tells the keyboard the app can start writing without being opened: it
    /// is in front, or the microphone is already on in the background.
    private func answerPing() {
        if microphone.isRunning || UIApplication.shared.applicationState == .active {
            Signal.pong.post()
        }
    }

    // MARK: - Actions

    /// Starts writing: a reply to `context`, or a new message when it is nil
    func start(replyingTo context: ConversationSnapshot?, requestID: UUID? = nil) {
        state = SessionState(phase: .starting, requestID: requestID, isReply: context != nil,
                             replyingTo: context?.lastIncoming)
        run {
            self.prepare(replyingTo: context)
            return try await self.begin()
        }
    }

    /// Replies to the chat in the latest screenshot in Photos
    func startFromScreenshot(requestID: UUID? = nil) {
        state = SessionState(phase: .starting, requestID: requestID, isReply: true)
        run {
            let image = try await ScreenshotLibrary.latestScreenshot()
            let context = try await ScreenshotReader.conversation(in: image)
            // The keyboard shows it as what the message replies to
            SharedStore.write(context, to: .sharedContext)
            Signal.contextChanged.post()
            self.state.replyingTo = context.lastIncoming
            self.prepare(replyingTo: context)
            return try await self.begin()
        }
    }

    /// Does what saying `command` does.
    func send(_ command: VoiceCommand) {
        guard state.isActive else { return }
        run { try await self.execute(command) }
    }

    func stop() {
        loop?.cancel()
        loop = nil
        voice.stop()
        if state.isActive {
            state.phase = .idle
            state.question = nil
        }
        keepMicrophoneOn()
    }

    func retry() {
        guard state.phase == .failed else { return }
        state.error = nil
        state.phase = .starting
        if let failedOperation {
            run(failedOperation)
        } else {
            start(replyingTo: context, requestID: state.requestID)
        }
    }

    /// Turns the microphone off now, rather than when Settings says
    func closeMicrophone() {
        microphoneTimer?.cancel()
        guard !state.isActive else { return }
        microphone.stop()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        isMicrophoneOn = false
        state.microphoneOpenUntil = nil
    }

    private func interrupted() {
        guard isMicrophoneOn else { return }
        let wasWriting = state.isActive
        loop?.cancel()
        loop = nil
        voice.stop()
        microphone.stop()
        isMicrophoneOn = false
        state.microphoneOpenUntil = nil
        if wasWriting {
            failedOperation = nil
            state.phase = .failed
            state.error = "Another app took the microphone, so writing stopped."
        }
    }

    // MARK: - Voice loop

    /// Replaces the loop in progress. The new loop waits for the old one to
    /// wind down, so two never use the microphone or speaker at once.
    private func run(_ first: @escaping () async throws -> Step?) {
        let previous = loop
        previous?.cancel()
        voice.stop()
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
        case let .submit(answer, index, replacesAnswer):
            return try await submit(answer, at: index, replacesAnswer: replacesAnswer)
        case .finish:
            return try await finish()
        }
    }

    private func prepare(replyingTo context: ConversationSnapshot?) {
        self.context = context
        flow = context.map { .reply(originalText: $0.replyText) } ?? .write
        questions = []
        serverQuestions = []
        index = 0
        backgroundDraft = nil
        isPaused = false
        isModifying = false
        failedOperation = nil
    }

    /// Turns the microphone on and gets the first question
    private func begin() async throws -> Step? {
        try await openMicrophone()
        let first: String
        switch flow {
        case .write:
            first = "What would you like to write?"
        case .reply(let originalText):
            state.phase = .thinking
            first = try await api.firstReplyQuestion(to: originalText)
        }
        questions = [PlannedQuestion(id: 1, question: first)]
        index = 0
        return .ask
    }

    private func askQuestion() async throws -> Step? {
        guard let question = currentQuestion else { return nil }
        state.question = question.question
        state.questionNumber = index + 1
        state.feedback = nil
        try await speak(question.question)
        await Cues.listening()
        return .listen
    }

    private func listen() async throws -> Step? {
        state.phase = isPaused ? .paused : .listening
        // As in the web app, an unanswered silence brings the question back,
        // except while paused, while a new answer is awaited, or when Settings
        // turned it off.
        let replayAfter = !isPaused && !isModifying && settings.repeatAfter > 0
            ? Duration.seconds(settings.repeatAfter)
            : nil
        let recording = try await recorder.record(
            from: microphone,
            timeout: replayAfter ?? commandListeningWindow,
            endOfAnswerSilence: .seconds(settings.answerPause),
            onHearing: { hearing in
                if !self.isPaused {
                    self.state.phase = hearing ? .hearing : .listening
                }
            }
        )
        guard case .speech(let wav) = recording else {
            return replayAfter != nil ? .ask : .listen
        }

        if !isPaused {
            state.phase = .transcribing
        }
        let spoken: String
        do {
            spoken = try await api.transcribe(wav: wav)
        } catch {
            if Task.isCancelled { throw CancellationError() }
            try await say("Speech recognition failed, please try again.", isError: true)
            return .listen
        }
        // Noise Whisper heard as no words (nothing, or only punctuation): keep listening
        guard spoken.contains(where: { $0.isLetter || $0.isNumber }) else { return .listen }
        return try await handle(spoken)
    }

    /// Acts on what was said, in the order the web app checks it.
    private func handle(_ spoken: String) async throws -> Step? {
        if isPaused {
            guard VoiceCommand.match(spoken, among: [.resume]) != nil else { return .listen }
            return try await execute(.resume)
        }
        state.heard = spoken
        if let command = VoiceCommand.match(spoken, among: VoiceCommand.questionCommands) {
            return try await execute(command)
        }
        if currentAnswer != nil && !isModifying {
            try await say("Say \"modify question\" to change your answer, or use navigation commands.")
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
            try await say("Writing paused. Say \"continue writing\" to resume...")
            return .listen

        case .resume:
            isPaused = false
            try await say("Writing resumed.")
            return .listen

        case .finish, .endWriting:
            guard questions.contains(where: { Self.isRealAnswer($0.response) }) else {
                try await say("Answer at least one question first.", isError: true)
                return .listen
            }
            isModifying = false
            try await say("Finishing writing and generating final text.")
            return .finish

        case .modify:
            isModifying = true
            try await say("Now modifying. Speak your new answer.")
            return .listen

        case .next:
            isModifying = false
            guard index < questions.count - 1 else {
                try await say("No more questions available yet", isError: true)
                return .listen
            }
            index += 1
            return .ask

        case .previous:
            isModifying = false
            guard index > 0 else {
                try await say("This is the first question!", isError: true)
                return .listen
            }
            try await say("Moving to previous question...")
            index -= 1
            return .ask

        case .skip:
            try await say("Skipping this question...")
            return .submit(answer: skippedAnswer, index: index, replacesAnswer: isModifying)

        case .repeatQuestion, .readAgain:
            return .ask

        case .home, .stopReading, .backToQuestions:
            try await say("Stopped writing.")
            stop()
            return nil

        case .showText:
            // The keyboard puts the message in the text field once it is finished
            try await say("Say \"finish writing\" when you're ready for your message.")
            return .listen
        }
    }

    private func submit(_ answer: String, at answerIndex: Int, replacesAnswer: Bool) async throws -> Step? {
        let previousAnswer = serverQuestions.indices.contains(answerIndex)
            ? serverQuestions[answerIndex].response ?? ""
            : ""
        questions[answerIndex].response = answer
        isModifying = false
        state.phase = .thinking

        let change = StepWriteAPI.AnswerChange(index: answerIndex, answer: answer, previousAnswer: previousAnswer)
        switch try await api.submitTurn(planning(followupNeeded: true), flow: flow, change: change) {
        case .finished(let output):
            return try await finished(output)
        case .nextQuestion(let next):
            questions = next.questions
            serverQuestions = next.questions
            backgroundDraft = next.backgroundDraft ?? backgroundDraft
            await Cues.click()
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
        state.phase = .thinking
        let result = try await api.submitTurn(planning(followupNeeded: false), flow: flow, finish: true)
        guard case .finished(let output) = result else {
            throw StepWriteAPI.APIError.unexpectedResponse
        }
        return try await finished(output)
    }

    /// The keyboard puts the message in the text field as soon as it sees it;
    /// meanwhile it is read aloud.
    private func finished(_ output: String) async throws -> Step? {
        serverQuestions = questions
        state.text = output
        state.question = nil
        state.feedback = nil
        state.phase = .finished
        keepMicrophoneOn()
        await Cues.success()
        try await voice.speak("Here is your message: \(output)", using: api, rate: Float(settings.readingSpeed))
        return nil
    }

    // MARK: - Helpers

    private func planning(followupNeeded: Bool) -> ConversationPlanning {
        ConversationPlanning(questions: questions, followupNeeded: followupNeeded, backgroundDraft: backgroundDraft)
    }

    private static func isRealAnswer(_ response: String?) -> Bool {
        guard let response, !response.isEmpty else { return false }
        return response != skippedAnswer
    }

    private func speak(_ text: String, cacheName: String? = nil) async throws {
        state.phase = .speaking
        try await voice.speak(text, using: api, cacheName: cacheName, rate: Float(settings.readingSpeed))
    }

    /// Shows a message on the keyboard and speaks it. Messages are cached on
    /// the server under the names the web app uses, so the apps share the clips.
    private func say(_ message: String, isError: Bool = false) async throws {
        state.feedback = message
        if isError {
            await Cues.failure()
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

    /// Shows the error with a way to retry, and says it in the phone's own
    /// voice, which works even when the server can't be reached.
    private func fail(_ error: Error, retry: @escaping () async throws -> Step?) async {
        failedOperation = retry
        isModifying = false
        state.error = error.localizedDescription
        state.phase = .failed
        keepMicrophoneOn()
        await Cues.failure()
        try? await voice.speak(error.localizedDescription, using: nil, rate: Float(settings.readingSpeed))
    }

    private func openMicrophone() async throws {
        microphoneTimer?.cancel()
        state.microphoneOpenUntil = nil
        guard !microphone.isRunning else { return }
        guard await AVAudioApplication.requestRecordPermission() else {
            throw SessionError.microphoneDenied
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
            try session.setActive(true)
            try microphone.start()
        } catch {
            // iOS doesn't let an app in the background turn the microphone on
            if UIApplication.shared.applicationState == .background {
                throw SessionError.microphoneOff
            }
            throw error
        }
        isMicrophoneOn = true
    }

    /// Leaves the microphone on for the time Settings says, so the keyboard can
    /// start again without opening the app, then turns it off.
    private func keepMicrophoneOn() {
        microphoneTimer?.cancel()
        guard microphone.isRunning else { return }
        let minutes = settings.microphoneMinutes
        state.microphoneOpenUntil = Date().addingTimeInterval(minutes * 60)
        microphoneTimer = Task {
            try? await Task.sleep(for: .seconds(minutes * 60))
            if !Task.isCancelled {
                closeMicrophone()
            }
        }
    }

    /// Writes the state for the keyboard and tells it so
    private func publish() {
        var shared = state
        shared.updatedAt = Date()
        SharedStore.write(shared, to: .session)
        Signal.sessionChanged.post()
    }
}
