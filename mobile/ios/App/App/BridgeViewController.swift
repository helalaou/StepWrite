import AVFoundation
import Capacitor
import WebKit

/// Capacitor's view controller, with the web view's microphone requests routed
/// through iOS's microphone permission.
///
/// Capacitor grants every getUserMedia request, but the web view does not ask
/// iOS for the microphone itself (in the simulator it never shows the prompt)
/// and records silence until the app has that permission. Asking first shows
/// the prompt when hands-free mode starts listening. If the user declines,
/// getUserMedia fails with NotAllowedError and the client shows its
/// microphone error.
class BridgeViewController: CAPBridgeViewController {
    private let uiDelegateProxy = MicrophonePermissionUIDelegate()

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        uiDelegateProxy.capacitorDelegate = webView?.uiDelegate
        webView?.uiDelegate = uiDelegateProxy
    }
}

/// Answers the web view's microphone requests and passes every other
/// WKUIDelegate call (alerts, Capacitor's bridge prompts) on to Capacitor.
private final class MicrophonePermissionUIDelegate: NSObject, WKUIDelegate {
    var capacitorDelegate: WKUIDelegate?

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || capacitorDelegate?.responds(to: aSelector) == true
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        capacitorDelegate
    }

    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        guard type == .microphone else {
            // StepWrite never asks for the camera; leave such requests to Capacitor.
            capacitorDelegate?.webView?(webView, requestMediaCapturePermissionFor: origin,
                                        initiatedByFrame: frame, type: type,
                                        decisionHandler: decisionHandler)
            return
        }
        requestRecordPermission { granted in
            DispatchQueue.main.async {
                decisionHandler(granted ? .grant : .deny)
            }
        }
    }

    private func requestRecordPermission(_ completion: @escaping (Bool) -> Void) {
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission(completionHandler: completion)
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission(completion)
        }
    }
}
