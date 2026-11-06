import UIKit

/// Shows the Capacitor web view inside the safe area, so the web client stays
/// clear of the notch or Dynamic Island and the home indicator, as it does in
/// Safari. The strips around it take the page's theme-color, which the client
/// sets to its light or dark background, and follow the system until it does.
class SafeAreaViewController: UIViewController {
    let bridgeViewController = BridgeViewController()
    private var themeColorObservation: NSKeyValueObservation?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        addChild(bridgeViewController)
        let webView: UIView = bridgeViewController.view
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        let safeArea = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: safeArea.topAnchor),
            webView.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor)
        ])
        bridgeViewController.didMove(toParent: self)

        // Clear until the page paints, so a dark page doesn't open with a white flash
        bridgeViewController.webView?.isOpaque = false
        bridgeViewController.webView?.backgroundColor = .clear
        themeColorObservation = bridgeViewController.webView?.observe(\.themeColor) { [weak self] webView, _ in
            self?.view.backgroundColor = webView.themeColor ?? .systemBackground
        }
    }

    // Capacitor keeps control of the status bar, home indicator and orientations.
    override var childForStatusBarStyle: UIViewController? { bridgeViewController }
    override var childForStatusBarHidden: UIViewController? { bridgeViewController }
    override var childForHomeIndicatorAutoHidden: UIViewController? { bridgeViewController }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        bridgeViewController.supportedInterfaceOrientations
    }
}
