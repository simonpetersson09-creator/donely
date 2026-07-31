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

final class DonelyViewController: CAPBridgeViewController {

    /// Strong reference — the bridge is the WKScriptMessageHandler and the
    /// UNUserNotificationCenter delegate for the whole app lifetime.
    private var notificationBridge: DonelyNotificationBridge?
    /// Strong reference — StoreKit 2 bridge (WKScriptMessageHandler).
    private var storeKitBridge: AnyObject?
    private var loadingObservation: NSKeyValueObservation?

    override func viewDidLoad() {
        super.viewDidLoad()
        installNotificationBridge()
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
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
