//
//  DonelyDiagnosticsOverlay.swift
//  Donely
//
//  Temporary native diagnostics for the "blank background" report on device.
//  Renders a label ON TOP of the WKWebView with the live view-hierarchy state
//  so we can tell a view-hierarchy problem apart from a web-content problem.
//
//  Enabled when Info.plist has DonelyDebugOverlay = YES. Set it to NO (or
//  remove the key) to ship without the overlay.
//

import UIKit
import WebKit

/// Logs the exact request passed to WKWebView. This distinguishes Capacitor's
/// public/index.html file routing from the URL visible to TanStack Router.
final class DonelyDiagnosticWebView: WKWebView {
    override func load(_ request: URLRequest) -> WKNavigation? {
        print("DONELY_WEBVIEW: load request=\(request.url?.absoluteString ?? "nil") method=\(request.httpMethod ?? "GET")")
        return super.load(request)
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        print("DONELY_WEBVIEW: didMoveToWindow window=\(String(describing: window)) frame=\(frame) hidden=\(isHidden) alpha=\(alpha)")
    }
}

/// Captures JavaScript startup milestones before React or any Donely module is
/// evaluated. Messages are written to the Xcode/device console even when the
/// visible diagnostics overlay cannot be installed.
final class DonelyWebRuntimeDiagnostics: NSObject, WKScriptMessageHandler {
    static let handlerName = "donelyDiagnostics"

    static let bootstrapScript = """
    (function () {
      function emit(stage, detail) {
        try {
          window.webkit.messageHandlers.donelyDiagnostics.postMessage({
            stage: stage,
            detail: String(detail || ''),
            url: location.href,
            readyState: document.readyState
          });
        } catch (_) {}
      }
      emit('document-start', 'bootstrap installed');
      window.addEventListener('error', function (event) {
        emit('error', (event.message || 'Script error') + ' @ ' +
          (event.filename || '') + ':' + (event.lineno || 0) + ':' + (event.colno || 0));
      }, true);
      window.addEventListener('unhandledrejection', function (event) {
        var reason = event.reason;
        emit('unhandledrejection', (reason && (reason.stack || reason.message)) || String(reason));
      });
      document.addEventListener('DOMContentLoaded', function () {
        emit('dom-content-loaded', 'bodyChildren=' + (document.body ? document.body.children.length : -1));
      });
      window.addEventListener('load', function () {
        emit('window-load', 'ready=' + !!document.querySelector('[data-donely-app-ready]'));
        setTimeout(function () {
          emit('react-check', 'ready=' + !!document.querySelector('[data-donely-app-ready]') +
            ' bodyText=' + (document.body ? document.body.innerText.trim().slice(0, 120) : '(no body)'));
        }, 1500);
      });
    })();
    """

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let payload = message.body as? [String: Any]
        let stage = payload?["stage"] as? String ?? "unknown"
        let detail = payload?["detail"] as? String ?? ""
        let url = payload?["url"] as? String ?? "(no URL)"
        let readyState = payload?["readyState"] as? String ?? "unknown"
        let prefix = stage == "react-check" ? "DONELY_REACT" : "DONELY_HTML"
        print("\(prefix): stage=\(stage) readyState=\(readyState) url=\(url) detail=\(detail)")
    }
}

final class DonelyDiagnosticsOverlay {

    static var isEnabled: Bool {
        (Bundle.main.object(forInfoDictionaryKey: "DonelyDebugOverlay") as? Bool) ?? false
    }

    private let label = UILabel()
    private let container = UIView()
    private weak var host: UIView?
    private weak var webView: WKWebView?
    private var timer: Timer?

    init(host: UIView, webView: WKWebView?) {
        self.host = host
        self.webView = webView
        install()
    }

    private func install() {
        guard let host else { return }

        container.translatesAutoresizingMaskIntoConstraints = false
        container.backgroundColor = UIColor.black.withAlphaComponent(0.72)
        container.layer.cornerRadius = 10
        container.isUserInteractionEnabled = false

        label.translatesAutoresizingMaskIntoConstraints = false
        label.numberOfLines = 0
        label.textColor = .white
        label.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
        label.text = "Donely native overlay: startar…"

        container.addSubview(label)
        host.addSubview(container)
        host.bringSubviewToFront(container)

        NSLayoutConstraint.activate([
            container.leadingAnchor.constraint(equalTo: host.safeAreaLayoutGuide.leadingAnchor, constant: 8),
            container.trailingAnchor.constraint(equalTo: host.safeAreaLayoutGuide.trailingAnchor, constant: -8),
            container.topAnchor.constraint(equalTo: host.safeAreaLayoutGuide.topAnchor, constant: 8),
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 8),
            label.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -8),
            label.topAnchor.constraint(equalTo: container.topAnchor, constant: 8),
            label.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -8),
        ])

        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.refresh()
        }
        refresh()
    }

    /// Brings the overlay back on top after Capacitor/WebKit reorders subviews.
    func bringToFront() {
        host?.bringSubviewToFront(container)
    }

    private func refresh() {
        guard let host else { return }
        host.bringSubviewToFront(container)

        var lines: [String] = []
        lines.append("DONELY NATIVE DIAGNOSTIK")

        if let webView {
            let isViewItself = (host === webView)
            let isSubview = webView.isDescendant(of: host)
            let idx = host.subviews.firstIndex(of: webView).map(String.init) ?? "-"
            lines.append("webView: finns (\(type(of: webView)))")
            lines.append("host === webView: \(isViewItself)  subview: \(isSubview) idx: \(idx)")
            lines.append("frame: \(fmt(webView.frame))  screen: \(fmt(UIScreen.main.bounds))")
            lines.append("hidden: \(webView.isHidden)  alpha: \(webView.alpha)  opaque: \(webView.isOpaque)")
            lines.append("constraints: \(webView.constraints.count) egna / \(host.constraints.count) host / autoresize: \(webView.translatesAutoresizingMaskIntoConstraints)")
            lines.append("bg: \(hex(webView.backgroundColor)) scrollBg: \(hex(webView.scrollView.backgroundColor))")
            lines.append("URL: \(webView.url?.absoluteString ?? "(ingen)")")
            lines.append("loading: \(webView.isLoading)  progress: \(String(format: "%.2f", webView.estimatedProgress))")
            lines.append("contentSize: \(fmt(webView.scrollView.contentSize))  insets: \(webView.scrollView.adjustedContentInset)")

            webView.evaluateJavaScript(
                "(function(){try{return JSON.stringify({url:location.href,rs:document.readyState,body:(document.body?document.body.innerText.trim().slice(0,60):'(ingen body)'),h:document.body?document.body.scrollHeight:-1,ready:!!document.querySelector('[data-donely-app-ready]'),err:(window.__donelyLastError||null)})}catch(e){return 'JS-fel: '+e}})()"
            ) { [weak self] value, error in
                guard let self else { return }
                let js = (value as? String) ?? "evaluateJavaScript-fel: \(error?.localizedDescription ?? "okänt")"
                self.render(lines + ["JS: \(js)"])
            }
        } else {
            lines.append("webView: NIL – ingen webbvy skapad av Capacitor")
            lines.append("host: \(type(of: host)) frame \(fmt(host.frame)) subviews \(host.subviews.count)")
            render(lines)
        }
    }

    private func render(_ lines: [String]) {
        DispatchQueue.main.async { self.label.text = lines.joined(separator: "\n") }
    }

    private func fmt(_ rect: CGRect) -> String {
        String(format: "(%.0f,%.0f %.0fx%.0f)", rect.origin.x, rect.origin.y, rect.width, rect.height)
    }

    private func fmt(_ size: CGSize) -> String {
        String(format: "%.0fx%.0f", size.width, size.height)
    }

    private func hex(_ color: UIColor?) -> String {
        guard let color else { return "nil" }
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02X%02X%02X/%.2f", Int(r * 255), Int(g * 255), Int(b * 255), a)
    }

    deinit {
        timer?.invalidate()
    }
}
