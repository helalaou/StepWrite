import Foundation

/// Response recorded for a skipped question. The server checks for the same
/// string, as does the web client (client/src/utils/conversation.js).
let skippedAnswer = "user has skipped this question"

/// One question of the conversation, as the server stores it.
struct PlannedQuestion: Codable, Equatable {
    let id: Int
    let question: String
    var response: String? = nil
}

/// A draft of the text so far, which the server writes once enough questions
/// have real answers. It travels with the planning, so it is sent back as is.
struct BackgroundDraft: Codable, Equatable {
    let content: String
    let generatedAt: String?
    let questionsCount: Int?
    let answeredCount: Int?
}

/// The conversation state the server reads and returns on every turn.
struct ConversationPlanning: Codable {
    var questions: [PlannedQuestion]
    var followupNeeded: Bool
    var backgroundDraft: BackgroundDraft?

    init(questions: [PlannedQuestion], followupNeeded: Bool, backgroundDraft: BackgroundDraft? = nil) {
        self.questions = questions
        self.followupNeeded = followupNeeded
        self.backgroundDraft = backgroundDraft
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        questions = try container.decode([PlannedQuestion].self, forKey: .questions)
        followupNeeded = try container.decodeIfPresent(Bool.self, forKey: .followupNeeded) ?? true
        backgroundDraft = try container.decodeIfPresent(BackgroundDraft.self, forKey: .backgroundDraft)
    }

    enum CodingKeys: String, CodingKey {
        case questions
        case followupNeeded = "followup_needed"
        case backgroundDraft
    }
}

/// The body of a failed request: { error, details }.
private struct ServerError: Decodable {
    let error: String?
    let details: String?
}

/// Calls the server endpoints the web app's write flow uses.
struct StepWriteAPI {
    enum APIError: LocalizedError {
        case server(String)
        case unexpectedResponse

        var errorDescription: String? {
            switch self {
            case .server(let message):
                return message
            case .unexpectedResponse:
                return "The server sent a response StepWrite doesn't understand."
            }
        }
    }

    /// What a turn produced: the planning with the next question added, or the finished text.
    enum TurnResult {
        case nextQuestion(ConversationPlanning)
        case finished(String)
    }

    var baseURL = ServerSettings.baseURL

    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        // Writing the final text, with fact-checking, can take a minute.
        configuration.timeoutIntervalForRequest = 180
        return URLSession(configuration: configuration)
    }()

    /// An answer given in this turn. The server compares it with the answer it
    /// saw before and drops later questions that depended on that one.
    struct AnswerChange {
        let index: Int
        let answer: String
        /// The answer the server last saw for this question; empty if none
        let previousAnswer: String
    }

    /// Sends the answers so far and gets the next question, or the final text
    /// when the server has enough (or `finish` asks it to stop asking).
    func submitTurn(_ planning: ConversationPlanning, change: AnswerChange? = nil, finish: Bool = false) async throws -> TurnResult {
        struct Request: Encodable {
            let conversationPlanning: ConversationPlanning
            let changedIndex: Int?
            let answer: String?
            let previousAnswer: String?
            let isFinishCommand: Bool
        }
        struct Response: Decodable {
            let conversationPlanning: ConversationPlanning?
            let output: String?
            let followupNeeded: Bool

            enum CodingKeys: String, CodingKey {
                case conversationPlanning, output
                case followupNeeded = "followup_needed"
            }
        }

        let request = try jsonRequest("api/write", body: Request(
            conversationPlanning: planning,
            changedIndex: change?.index,
            answer: change?.answer,
            previousAnswer: change?.previousAnswer,
            isFinishCommand: finish
        ))
        let response: Response = try await decoded(request)
        if response.followupNeeded, let next = response.conversationPlanning {
            return .nextQuestion(next)
        }
        if let output = response.output {
            return .finished(output)
        }
        throw APIError.unexpectedResponse
    }

    /// Transcribes a WAV recording with the server's Whisper endpoint.
    func transcribe(wavFile: URL) async throws -> String {
        let boundary = "StepWrite-\(UUID().uuidString)"
        var body = Data()
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"audio\"; filename=\"answer.wav\"\r\n".utf8))
        body.append(Data("Content-Type: audio/wav\r\n\r\n".utf8))
        body.append(try Data(contentsOf: wavFile))
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))

        var request = urlRequest("api/transcribe")
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        struct Response: Decodable {
            let text: String
        }
        let response: Response = try await decoded(request)
        return response.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Speech for `text` in the server's voice, as MP3 data. `cacheName` keeps
    /// the audio under a fixed file name on the server, as the web app does for
    /// its spoken feedback, so both apps reuse the same clips.
    func speech(for text: String, cacheName: String? = nil) async throws -> Data {
        struct Request: Encodable {
            let text: String
            let cache_as: String?
        }
        struct Response: Decodable {
            let audioUrl: String
        }

        let body = Request(text: text, cache_as: cacheName)
        let response: Response = try await decoded(try jsonRequest("api/tts/generate", body: body))
        // audioUrl is a path on the server, such as /tts/<hash>.mp3
        guard let audioURL = URL(string: response.audioUrl, relativeTo: baseURL) else {
            throw APIError.unexpectedResponse
        }
        return try await data(for: URLRequest(url: audioURL))
    }

    private func urlRequest(_ path: String) -> URLRequest {
        URLRequest(url: baseURL.appendingPathComponent(path))
    }

    private func jsonRequest<Body: Encodable>(_ path: String, body: Body) throws -> URLRequest {
        var request = urlRequest(path)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return request
    }

    private func decoded<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        try JSONDecoder().decode(Response.self, from: try await data(for: request))
    }

    private func data(for request: URLRequest) async throws -> Data {
        var request = request
        // ngrok's free plan answers with a warning page instead of forwarding
        // unless the request opts out; other servers ignore the header.
        request.setValue("true", forHTTPHeaderField: "ngrok-skip-browser-warning")
        let (data, response) = try await Self.session.data(for: request)
        guard let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status) else {
            let failure = try? JSONDecoder().decode(ServerError.self, from: data)
            throw APIError.server(failure?.details ?? failure?.error ?? "The server couldn't handle the request.")
        }
        return data
    }
}
