import SwiftUI

/// The name, App Group and link scheme from Config/Base.xcconfig, which every
/// target's Info.plist carries, so renaming the keyboard is a change there only.
enum Brand {
    static let name = info("StepWriteName", default: "StepWrite Voice")
    static let appGroup = info("StepWriteAppGroup", default: "group.io.github.helalaou.stepwrite.keyboard")
    static let urlScheme = info("StepWriteURLScheme", default: "stepwrite-voice")

    /// The practice chat's text field has this content type, so the keyboard
    /// offers the practice chat there and nowhere else
    static let practiceChatField = UITextContentType(rawValue: "\(urlScheme).practice-chat")

    /// StepWrite's red (client/src/theme.js), lighter in dark mode
    static let accent = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0xF0 / 255, green: 0x8C / 255, blue: 0x7C / 255, alpha: 1)
            : UIColor(red: 0xA1 / 255, green: 0x26 / 255, blue: 0x14 / 255, alpha: 1)
    })

    private static func info(_ key: String, default fallback: String) -> String {
        Bundle.main.object(forInfoDictionaryKey: key) as? String ?? fallback
    }
}
