//
//  DonelyViewController.swift
//  Donely
//
//  Capacitor bridge view controller that wires DonelyNotificationBridge into
//  the WKWebView as soon as it is created. Referenced from Main.storyboard.
//

import UIKit
import Capacitor
import UserNotifications
import WebKit

/// Single source of truth for the native chrome color. Must stay in sync with
/// the web app's `--background` token (src/styles.css) and the
/// `backgroundColor` values in capacitor.config.ts.
enum DonelyAppColors {
    /// #afa9a6 (warm taupe). The web app currently keeps this background in
    /// both iOS appearances, so native chrome must not turn black in Dark Mode.
    static let background = UIColor(red: 0.686, green: 0.663, blue: 0.651, alpha: 1)
}

final class DonelyViewController: CAPBridgeViewController {

    /// Strong reference — the bridge is the WKScriptMessageHandler and the
    /// UNUserNotificationCenter delegate for the whole app lifetime.
    private var notificationBridge: DonelyNotificationBridge?
    /// Strong reference — StoreKit 2 bridge (WKScriptMessageHandler).
    private var storeKitBridge: AnyObject?
    /// Strong reference — mail composer bridge (WKScriptMessageHandler).
    private var mailBridge: DonelyMailBridge?
    private var loadingObservation: NSKeyValueObservation?
    private var progressObservation: NSKeyValueObservation?
    private var urlObservation: NSKeyValueObservation?
    private let runtimeDiagnostics = DonelyWebRuntimeDiagnostics()
    /// Temporary on-device diagnostics (Info.plist: DonelyDebugOverlay).
    private var diagnosticsOverlay: DonelyDiagnosticsOverlay?

    override func viewDidLoad() {
        print("DONELY_NATIVE: DonelyViewController.viewDidLoad enter view=\(type(of: view))")
        guard validateBundledWebApp() else { return }
        super.viewDidLoad()
        print("DONELY_CAPACITOR: super.viewDidLoad returned webView=\(String(describing: webView)) bridge=\(String(describing: bridge))")
        edgesForExtendedLayout = .all
        extendedLayoutIncludesOpaqueBars = true
        applyAppBackgroundColor()
        installNotificationBridge()
        installDiagnosticsOverlay()
        installRuntimeObservations()
        logViewHierarchy(stage: "viewDidLoad")
    }

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        let controller = configuration.userContentController
        controller.removeScriptMessageHandler(forName: DonelyWebRuntimeDiagnostics.handlerName)
        controller.add(runtimeDiagnostics, name: DonelyWebRuntimeDiagnostics.handlerName)
        controller.addUserScript(WKUserScript(
            source: DonelyWebRuntimeDiagnostics.bootstrapScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        print("DONELY_CAPACITOR: WKWebViewConfiguration created; startup diagnostics installed")
        return configuration
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        print("DONELY_CAPACITOR: creating WKWebView frame=\(frame)")
        return DonelyDiagnosticWebView(frame: frame, configuration: configuration)
    }

    /// Capacitor terminates the process inside `super.viewDidLoad()` when the
    /// bundled start file is missing. Validate first so an incomplete archive
    /// can never look like a silent, solid-colour screen on a physical device.
    private func validateBundledWebApp() -> Bool {
        let indexURL = Bundle.main.url(
            forResource: "index",
            withExtension: "html",
            subdirectory: "public"
        )
        let configURL = Bundle.main.url(forResource: "capacitor.config", withExtension: "json")
        guard indexURL != nil, configURL != nil else {
            print("DONELY_NATIVE: bundle validation FAILED index=\(String(describing: indexURL)) config=\(String(describing: configURL)) resourceURL=\(String(describing: Bundle.main.resourceURL))")
            showNativeStartupFailure(
                "Donely kunde inte starta\n\nWebbfiler saknas i app-paketet. " +
                "Bygg om med npm run build och npx cap sync ios före arkivering."
            )
            return false
        }
        let assetURL = Bundle.main.url(forResource: "assets", withExtension: nil, subdirectory: "public")
        print("DONELY_NATIVE: bundle validation OK index=\(indexURL?.path ?? "nil") config=\(configURL?.path ?? "nil") assets=\(assetURL?.path ?? "nil")")
        return true
    }

    private func showNativeStartupFailure(_ message: String) {
        view.backgroundColor = DonelyAppColors.background

        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.numberOfLines = 0
        label.textAlignment = .center
        label.textColor = UIColor(red: 0.110, green: 0.102, blue: 0.098, alpha: 1)
        label.font = .systemFont(ofSize: 17, weight: .semibold)
        label.text = message
        view.addSubview(label)

        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            label.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        print("DONELY_NATIVE: DonelyViewController.viewDidAppear")
        // Explicitly prove that the launch screen has yielded to the app
        // controller and keep the real app window above any stale window.
        view.window?.backgroundColor = DonelyAppColors.background
        view.window?.makeKeyAndVisible()
        installDiagnosticsOverlay()
        diagnosticsOverlay?.bringToFront()
        logViewHierarchy(stage: "viewDidAppear")
        auditWindowHierarchy(stage: "viewDidAppear")
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.auditWindowHierarchy(stage: "viewDidAppear+2s")
        }
    }

    /// Dumps the REAL view hierarchy of every window and flags any view that is
    /// ordered above the WKWebView and large enough to cover it. This is the
    /// evidence needed to rule out a native overlay: the log lists class,
    /// frame, alpha, hidden, opaque and background colour for every node.
    private func auditWindowHierarchy(stage: String) {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.windows }
            .flatMap { $0 }
        let web = webView

        func describe(_ v: UIView, depth: Int) {
            let pad = String(repeating: "  ", count: depth)
            let mark = (v === web) ? " <== WKWEBVIEW" : ((v === view) ? " <== VC.view" : "")
            print("DONELY_HIERARCHY: \(pad)\(type(of: v)) frame=\(v.frame) alpha=\(v.alpha) hidden=\(v.isHidden) opaque=\(v.isOpaque) bg=\(v.backgroundColor.map { "\($0)" } ?? "nil")\(mark)")
            v.subviews.forEach { describe($0, depth: depth + 1) }
        }

        for window in windows {
            print("DONELY_HIERARCHY: --- stage=\(stage) window key=\(window.isKeyWindow) level=\(window.windowLevel.rawValue) bg=\(window.backgroundColor.map { "\($0)" } ?? "nil") ---")
            describe(window, depth: 0)
        }

        // Coverage check: anything painted after (above) the web view.
        guard let web, let webWindow = web.window else {
            print("DONELY_HIERARCHY: coverage check skipped; webView=\(web != nil) window=nil")
            return
        }
        var offenders: [String] = []
        func scan(_ v: UIView, seenWeb: inout Bool) {
            if v === web { seenWeb = true; return }
            if seenWeb, !v.isHidden, v.alpha > 0.01 {
                let rect = v.convert(v.bounds, to: webWindow)
                let coverage = rect.intersection(webWindow.bounds)
                let ratio = (coverage.width * coverage.height) / max(webWindow.bounds.width * webWindow.bounds.height, 1)
                if ratio > 0.5 {
                    offenders.append("\(type(of: v)) coverage=\(Int(ratio * 100))% alpha=\(v.alpha) bg=\(v.backgroundColor.map { "\($0)" } ?? "nil")")
                }
            }
            v.subviews.forEach { scan($0, seenWeb: &seenWeb) }
        }
        for window in windows {
            var seenWeb = window !== webWindow ? (window.windowLevel.rawValue > webWindow.windowLevel.rawValue) : false
            scan(window, seenWeb: &seenWeb)
        }
        if offenders.isEmpty {
            print("DONELY_HIERARCHY: coverage check OK — no native view above the WKWebView covers >50% of the screen")
        } else {
            print("DONELY_HIERARCHY: coverage check FAILED — views above the WKWebView: \(offenders.joined(separator: " | "))")
        }
    }


    private func installDiagnosticsOverlay() {
        guard diagnosticsOverlay == nil, DonelyDiagnosticsOverlay.isEnabled else { return }
        // CAPBridgeViewController makes `view` the WKWebView itself. Hosting a
        // diagnostic subview inside WebKit is unreliable because WebKit owns
        // and reorders its internal hierarchy. UIWindow is an independent,
        // guaranteed top layer and is used only while the debug flag is on.
        guard let window = view.window else {
            print("DONELY_NATIVE: diagnostics overlay waiting for UIWindow")
            return
        }
        diagnosticsOverlay = DonelyDiagnosticsOverlay(host: window, webView: webView)
        print("DONELY_NATIVE: diagnostics overlay installed on UIWindow")
    }

    /// Matches the web app background so the safe-area strips (status bar /
    /// home indicator) never show through as black. Applied to every layer
    /// that can be visible behind the web content: window, root view,
    /// web view and its scroll view.
    private func applyAppBackgroundColor() {
        let color = DonelyAppColors.background
        view.backgroundColor = color
        // ONLY this controller's own window may be tinted. Tinting every window
        // in the scene also painted system overlay windows (UITextEffectsWindow,
        // UIRemoteKeyboardWindow) — they sit ABOVE the app window and are
        // normally transparent, so an opaque taupe fill there covers the whole
        // screen while still letting touches/text selection reach the web view.
        // That is exactly the "layer over the app" symptom.
        view.window?.backgroundColor = color
        view.superview?.backgroundColor = color
        webView?.backgroundColor = color

        // Opaque: a transparent WKWebView can composite as pure black on a
        // device build before the page paints (the "black app" symptom).
        webView?.isOpaque = true
        webView?.scrollView.backgroundColor = color

        webView?.scrollView.bounces = false
        // The web app uses viewport-fit=cover and env(safe-area-inset-*).
        // Prevent UIKit from adding a second inset that exposes the root view.
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.contentInset = .zero
        webView?.scrollView.scrollIndicatorInsets = .zero
        // Keep the area revealed behind/around the page tinted, not black.
        if #available(iOS 15.0, *) {
            webView?.underPageBackgroundColor = color
        }
        setNeedsStatusBarAppearanceUpdate()
    }

    /// The status bar text has to follow the (light/dark) background so the
    /// safe area at the top reads as part of the app.
    override var preferredStatusBarStyle: UIStatusBarStyle {
        .darkContent
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        print("DONELY_NATIVE: DonelyViewController.viewWillAppear")
        applyAppBackgroundColor()
        installDiagnosticsOverlay()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        applyAppBackgroundColor()
        diagnosticsOverlay?.bringToFront()
    }

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        applyAppBackgroundColor()
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        print("DONELY_CAPACITOR: capacitorDidLoad bridge=\(String(describing: bridge)) webView=\(String(describing: webView))")
        applyAppBackgroundColor()
        installNotificationBridge()
    }

    private func installRuntimeObservations() {
        guard progressObservation == nil, let webView else {
            print("DONELY_WEBVIEW: observation install skipped; webView is nil or already observed")
            return
        }
        progressObservation = webView.observe(\.estimatedProgress, options: [.initial, .new]) { webView, _ in
            print("DONELY_WEBVIEW: progress=\(String(format: "%.2f", webView.estimatedProgress)) loading=\(webView.isLoading) url=\(webView.url?.absoluteString ?? "nil")")
        }
        urlObservation = webView.observe(\.url, options: [.initial, .new]) { webView, _ in
            print("DONELY_WEBVIEW: URL changed to \(webView.url?.absoluteString ?? "nil")")
        }
    }

    private func logViewHierarchy(stage: String) {
        let root = view.window?.rootViewController
        let web = webView
        let descendants = web.map { $0.isDescendant(of: view) } ?? false
        let index = web.flatMap { view.subviews.firstIndex(of: $0) }.map(String.init) ?? "-"
        print("DONELY_NATIVE: hierarchy stage=\(stage) root=\(String(describing: root.map { type(of: $0) })) active=\(type(of: self)) view=\(type(of: view)) subviews=\(view.subviews.count)")
        print("DONELY_WEBVIEW: exists=\(web != nil) viewIsWebView=\(web === view) descendant=\(descendants) index=\(index) frame=\(String(describing: web?.frame)) hidden=\(String(describing: web?.isHidden)) alpha=\(String(describing: web?.alpha)) window=\(String(describing: web?.window)) url=\(web?.url?.absoluteString ?? "nil")")
    }

    private func installNotificationBridge() {
        guard notificationBridge == nil, let webView = self.webView else { return }

        let bridge = DonelyNotificationBridge(webView: webView)
        notificationBridge = bridge

        // JS → Swift message handlers.
        bridge.register(on: webView.configuration.userContentController)

        // StoreKit 2 bridge (products, purchase, restore, entitlement).
        var store: DonelyStoreKitBridge?
        if #available(iOS 15.0, *) {
            let storeBridge = DonelyStoreKitBridge(webView: webView)
            storeBridge.register(on: webView.configuration.userContentController)
            storeKitBridge = storeBridge
            store = storeBridge
        }

        // Mail composer bridge (HTML mail with the weekly report inline).
        let mail = DonelyMailBridge(webView: webView)
        mail.register(on: webView.configuration.userContentController)
        mailBridge = mail

        // Notification delegate (also set in the bridge initializer; explicit
        // here so the wiring is obvious and survives refactors).
        UNUserNotificationCenter.current().delegate = bridge

        // Deliver deep links captured before the web app was ready.
        if webView.isLoading {
            loadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self] _, change in
                guard change.newValue == false else { return }
                self?.loadingObservation = nil
                self?.notificationBridge?.webViewDidFinishLoad()
                self?.mailBridge?.webViewDidFinishLoad()
                if #available(iOS 15.0, *) {
                    (self?.storeKitBridge as? DonelyStoreKitBridge)?.webViewDidFinishLoad()
                }
            }
        } else {
            bridge.webViewDidFinishLoad()
            mail.webViewDidFinishLoad()
            if #available(iOS 15.0, *) { store?.webViewDidFinishLoad() }
        }



        // A tap that cold-launched the app is replayed once the web app loads.
        AppDelegate.pendingNotificationRoute.map { route in
            AppDelegate.pendingNotificationRoute = nil
            bridge.openRoute(route)
        }
    }

    deinit {
        loadingObservation = nil
        progressObservation = nil
        urlObservation = nil
        webView?.configuration.userContentController.removeScriptMessageHandler(
            forName: DonelyWebRuntimeDiagnostics.handlerName
        )
    }
}
