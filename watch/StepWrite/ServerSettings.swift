import Foundation

/// Where the StepWrite server runs.
enum ServerSettings {
#if targetEnvironment(simulator)
    /// The simulator shares the Mac's network, so it reaches the server started
    /// with `npm start` in server/.
    static let baseURL = URL(string: "http://localhost:3001")!
#else
    /// A real watch needs an HTTPS address it can reach. This is the server tunnel
    /// from client/src/config.js (NGROK.SERVER_URL); keep the two in sync.
    static let baseURL = URL(string: "https://64908c6e5c4d.ngrok.app")!
#endif
}
