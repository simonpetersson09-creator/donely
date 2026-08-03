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
    private var loadingObservation: NSKeyValueObservation?
    /// Temporary on-device diagnostics (Info.plist: DonelyDebugOverlay).
    private var diagnosticsOverlay: DonelyDiagnosticsOverlay?

    override func viewDidLoad() {
        guard validateBundledWebApp() else { return }
        super.viewDidLoad()
        edgesForExtendedLayout = .all
        extendedLayoutIncludesOpaqueBars = true
        applyAppBackgroundColor()
        installNotificationBridge()
        installDiagnosticsOverlay()
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
            showNativeStartupFailure(
                "Donely kunde inte starta\n\nWebbfiler saknas i app-paketet. " +
                "Bygg om med npm run build och npx cap sync ios före arkivering."
            )
            return false
        }
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
        // Explicitly prove that the launch screen has yielded to the app
        // controller and keep the real app window above any stale window.
        view.window?.backgroundColor = DonelyAppColors.background
        view.window?.makeKeyAndVisible()
        installDiagnosticsOverlay()
        diagnosticsOverlay?.bringToFront()
    }

    private func installDiagnosticsOverlay() {
        guard diagnosticsOverlay == nil, DonelyDiagnosticsOverlay.isEnabled else { return }
        diagnosticsOverlay = DonelyDiagnosticsOverlay(host: view, webView: webView)
    }

    /// Matches the web app background so the safe-area strips (status bar /
    /// home indicator) never show through as black. Applied to every layer
    /// that can be visible behind the web content: window, root view,
    /// web view and its scroll view.
    private func applyAppBackgroundColor() {
        let color = DonelyAppColors.background
        view.backgroundColor = color
        view.window?.backgroundColor = color
        view.superview?.backgroundColor = color
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.windows }
            .flatMap { $0 }
            .forEach { $0.backgroundColor = color }
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
        applyAppBackgroundColor()
        installNotificationBridge()
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

        // Notification delegate (also set in the bridge initializer; explicit
        // here so the wiring is obvious and survives refactors).
        UNUserNotificationCenter.current().delegate = bridge

        // Deliver deep links captured before the web app was ready.
        if webView.isLoading {
            loadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self] _, change in
                guard change.newValue == false else { return }
                self?.loadingObservation = nil
                self?.notificationBridge?.webViewDidFinishLoad()
                if #available(iOS 15.0, *) {
                    (self?.storeKitBridge as? DonelyStoreKitBridge)?.webViewDidFinishLoad()
                }
            }
        } else {
            bridge.webViewDidFinishLoad()
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
    }
}
