import Testing
@testable import StepWrite

/// What the watch hears on the question screen, and the command it should act on.
@Suite("Commands while answering questions")
struct QuestionCommandTests {
    @Test(arguments: [
        ("Pause.", VoiceCommand.pause),
        ("Take a short break", .pause),
        ("Finish", .finish),
        ("I would like to stop here.", .finish),
        ("Change my answer", .modify),
        ("I want to edit this answer", .modify),
        ("Next", .next),
        ("Next question, please.", .next),
        ("Go back", .previous),
        ("Return to the previous question", .previous),
        ("Skip", .skip),
        ("Skip this question", .skip),
        ("Show me the draft", .showText),
        ("Open editor", .showText),
        ("Go to home page", .home),
        ("Repeat the question", .repeatQuestion),
        ("What was the question?", .repeatQuestion),
    ])
    func recognizesCommand(spoken: String, command: VoiceCommand) {
        #expect(VoiceCommand.match(spoken, among: VoiceCommand.questionCommands) == command)
    }

    @Test(arguments: ["SKIP", "skip!", "  skip  ", "Skip it."])
    func ignoresCaseSpacingAndPunctuation(spoken: String) {
        #expect(VoiceCommand.match(spoken, among: VoiceCommand.questionCommands) == .skip)
    }

    @Test func readsCurlyApostrophes() {
        // Whisper writes "Let’s" with a curly apostrophe. Only "lets stop here"
        // can match, since "stop here" allows just one extra word.
        #expect(VoiceCommand.match("Let’s stop here now.", among: VoiceCommand.questionCommands) == .finish)
    }

    @Test func allowsAFewExtraWords() {
        #expect(VoiceCommand.match("Skip this question, please.", among: VoiceCommand.questionCommands) == .skip)
    }

    @Test func prefersTheLongestMatchingPhrase() {
        // "next question please" matches too, but "skip to next question" is longer.
        #expect(VoiceCommand.match("Skip to next question, please", among: VoiceCommand.questionCommands) == .skip)
    }

    @Test(arguments: [
        "Next Tuesday",
        "Finish the report by Friday",
        "My answer is to go to the beach",
        "I want to invite my team to the meeting next week",
        "Go back to the office after lunch",
    ])
    func treatsAnswersAsAnswers(spoken: String) {
        #expect(VoiceCommand.match(spoken, among: VoiceCommand.questionCommands) == nil)
    }

    @Test(arguments: ["", "   ", "...", "?!"])
    func ignoresSilence(spoken: String) {
        #expect(VoiceCommand.match(spoken, among: VoiceCommand.allCases) == nil)
    }

    @Test func listensForResumeOnlyWhilePaused() {
        #expect(VoiceCommand.match("Continue", among: VoiceCommand.questionCommands) == nil)
        #expect(VoiceCommand.match("Continue", among: [.resume]) == .resume)
        #expect(VoiceCommand.match("Resume writing, please", among: [.resume]) == .resume)
    }
}

/// What the watch hears while it shows the finished text.
@Suite("Commands while the text is shown")
struct TextCommandTests {
    @Test(arguments: [
        ("Read it again", VoiceCommand.readAgain),
        ("Play that again, please.", .readAgain),
        ("Stop reading", .stopReading),
        ("Be quiet, please.", .stopReading),
        ("Go back to questions", .backToQuestions),
        ("Return to questions view", .backToQuestions),
        ("Save and exit", .endWriting),
        ("End writing", .endWriting),
    ])
    func recognizesCommand(spoken: String, command: VoiceCommand) {
        #expect(VoiceCommand.match(spoken, among: VoiceCommand.textCommands) == command)
    }

    @Test func ignoresQuestionCommands() {
        #expect(VoiceCommand.match("Skip this question", among: VoiceCommand.textCommands) == nil)
    }

    @Test func meansTheCurrentScreenWhenPhrasesOverlap() {
        // "Finish writing" ends the questions on the question screen and
        // saves the text on the text screen.
        #expect(VoiceCommand.match("Finish writing", among: VoiceCommand.questionCommands) == .finish)
        #expect(VoiceCommand.match("Finish writing", among: VoiceCommand.textCommands) == .endWriting)
    }
}

@Test("Every command is listened for on some screen")
func everyCommandIsReachable() {
    let listenedFor = Set(VoiceCommand.questionCommands + VoiceCommand.textCommands + [.resume])
    #expect(listenedFor == Set(VoiceCommand.allCases))
}
