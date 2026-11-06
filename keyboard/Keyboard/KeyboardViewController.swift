import SwiftUI
import UIKit

/// The keyboard. It shows what the message replies to and the question being
/// asked, sends its buttons to the app, and puts the finished message in the
/// text field. The app does the listening, since Apple doesn't give keyboards
/// the microphone (keyboard/README.md has more).
final class KeyboardViewController: UIInputViewController {
    private lazy var model = KeyboardModel(controller: self)

    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: KeyboardView(model: model))
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        addChild(host)
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        host.didMove(toParent: self)

        // A little taller than the system keyboard's letters, for the question
        let height = view.heightAnchor.constraint(equalToConstant: 292)
        height.priority = .defaultHigh
        height.isActive = true
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        model.appear()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        model.disappear()
    }

    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        model.refreshContext()
    }

    @available(iOS 18.4, *)
    override func conversationContext(_ context: UIConversationContext?, didChange textInput: UITextInput?) {
        super.conversationContext(context, didChange: textInput)
        model.refreshContext()
    }

    /// Opens the app with its link. Keyboards have no API for this, so it goes
    /// through the responder chain to the host's UIApplication. Returns false
    /// when there is none to ask.
    func openContainingApp(_ url: URL) -> Bool {
        let selector = NSSelectorFromString("openURL:options:completionHandler:")
        var responder: UIResponder? = self
        while let current = responder {
            if let application = current as? UIApplication, application.responds(to: selector) {
                typealias Open = @convention(c) (
                    UIApplication, Selector, NSURL, NSDictionary, (@convention(block) (Bool) -> Void)?
                ) -> Void
                let open = unsafeBitCast(application.method(for: selector), to: Open.self)
                open(application, selector, url as NSURL, NSDictionary(), nil)
                return true
            }
            responder = current.next
        }
        return false
    }
}
