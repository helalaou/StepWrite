import SwiftUI

@main
struct StepWriteVoiceApp: App {
    @State private var session = WritingSession.shared

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(session)
                .tint(Brand.accent)
                .onOpenURL { session.open($0) }
        }
    }
}
