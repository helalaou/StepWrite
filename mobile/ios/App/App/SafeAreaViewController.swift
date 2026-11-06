import UIKit

/// Shows the Capacitor web view inside the safe area, so the web client stays
/// clear of the notch or Dynamic Island and the home indicator, as it does in
/// Safari. The strips around it are white, like the web client's background.
class SafeAreaViewController: UIViewController {
    let bridgeViewController = BridgeViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white

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
    }

    // Capacitor keeps control of the status bar, home indicator and orientations.
    override var childForStatusBarStyle: UIViewController? { bridgeViewController }
    override var childForStatusBarHidden: UIViewController? { bridgeViewController }
    override var childForHomeIndicatorAutoHidden: UIViewController? { bridgeViewController }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        bridgeViewController.supportedInterfaceOrientations
    }
}
