//
//  DonelyStoreKitBridge.swift
//  Donely
//
//  Native StoreKit 2 half of the Donely premium bridge.
//  Wired up automatically by DonelyViewController — no manual Xcode steps.
//
//  JS → Swift (webkit.messageHandlers):
//    bridgeReady         { version }
//    requestEntitlement  {}
//    requestProduct      { product }
//    purchasePremium     { product }
//    restorePurchase     {}
//    manageSubscription  {}
//
//  Swift → JS:
//    window.__donelySetEntitlement({ subscribed, inTrial, trialDaysLeft })
//    window.__donelySetProduct({ id, displayPrice } | null)
//    window.__donelyPurchaseResult(status, message?)
//

import Foundation
import UIKit
import StoreKit
import WebKit

@available(iOS 15.0, *)
final class DonelyStoreKitBridge: NSObject {

    static let handlerNames = [
        "bridgeReady",
        "requestEntitlement",
        "requestProduct",
        "purchasePremium",
        "restorePurchase",
        "manageSubscription",
    ]

    static let productID = "donely.premium.monthly"

    private weak var webView: WKWebView?
    private var product: Product?
    private var updatesTask: Task<Void, Never>?

    init(webView: WKWebView) {
        self.webView = webView
        super.init()
        // Keep entitlement in sync with renewals, refunds and Ask-to-Buy.
        updatesTask = Task.detached { [weak self] in
            for await update in Transaction.updates {
                if case .verified(let transaction) = update {
                    await transaction.finish()
                }
                await self?.pushEntitlement()
            }
        }
    }

    deinit { updatesTask?.cancel() }

    func register(on controller: WKUserContentController) {
        for name in DonelyStoreKitBridge.handlerNames {
            controller.removeScriptMessageHandler(forName: name)
            controller.add(self, name: name)
        }
    }

    /// Called once the web app has loaded: push product + entitlement.
    func webViewDidFinishLoad() {
        Task {
            await loadProduct()
            await pushEntitlement()
        }
    }

    // MARK: - StoreKit

    @discardableResult
    private func loadProduct() async -> Product? {
        do {
            let products = try await Product.products(for: [DonelyStoreKitBridge.productID])
            guard let product = products.first else {
                sendProduct(nil)
                return nil
            }
            self.product = product
            sendProduct(product)
            return product
        } catch {
            sendProduct(nil)
            return nil
        }
    }

    private func currentProduct() async -> Product? {
        if let product { return product }
        return await loadProduct()
    }

    /// Reads Transaction.currentEntitlements — the only source of truth.
    private func pushEntitlement() async {
        var subscribed = false
        var inTrial = false
        var trialDaysLeft = 0

        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  transaction.productID == DonelyStoreKitBridge.productID else { continue }
            if let revocation = transaction.revocationDate, revocation <= Date() { continue }
            if let expiration = transaction.expirationDate, expiration <= Date() { continue }

            subscribed = true

            if transaction.offerType == .introductory {
                inTrial = true
                if let expiration = transaction.expirationDate {
                    let seconds = expiration.timeIntervalSinceNow
                    trialDaysLeft = max(0, Int(ceil(seconds / 86_400)))
                }
            }
        }

        // Not subscribed: grant the 7-day free trial locally. Apple's own
        // introductory offer only starts once the user buys, so without this
        // the app would demand Premium from the very first launch.
        if !subscribed {
            let daysLeft = TrialClock.daysLeft()
            inTrial = daysLeft > 0
            trialDaysLeft = daysLeft
        }

        sendEntitlement(subscribed: subscribed, inTrial: inTrial, trialDaysLeft: trialDaysLeft)
    }


    private func purchase() async {
        guard let product = await currentProduct() else {
            sendPurchaseResult("productUnavailable")
            return
        }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                switch verification {
                case .verified(let transaction):
                    await transaction.finish()
                    await pushEntitlement()
                    sendPurchaseResult("success")
                case .unverified(_, let error):
                    sendPurchaseResult("failed", error.localizedDescription)
                }
            case .userCancelled:
                sendPurchaseResult("cancelled")
            case .pending:
                sendPurchaseResult("pending")
            @unknown default:
                sendPurchaseResult("failed")
            }
        } catch {
            sendPurchaseResult("failed", error.localizedDescription)
        }
    }

    private func restore() async {
        do {
            try await AppStore.sync()
        } catch {
            // A cancelled sync sheet should not read as a hard failure.
            await pushEntitlement()
            sendPurchaseResult("nothingToRestore")
            return
        }
        var found = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.productID == DonelyStoreKitBridge.productID {
                found = true
            }
        }
        await pushEntitlement()
        sendPurchaseResult(found ? "restored" : "nothingToRestore")
    }

    @MainActor
    private func manageSubscriptions() async {
        guard let scene = webView?.window?.windowScene
            ?? UIApplication.shared.connectedScenes.first as? UIWindowScene else { return }
        if #available(iOS 15.0, *) {
            try? await AppStore.showManageSubscriptions(in: scene)
        }
    }

    // MARK: - Swift → JS

    private func sendEntitlement(subscribed: Bool, inTrial: Bool, trialDaysLeft: Int) {
        let payload: [String: Any] = [
            "subscribed": subscribed,
            "inTrial": inTrial,
            "trialDaysLeft": trialDaysLeft,
        ]
        evaluate("window.__donelySetEntitlement && window.__donelySetEntitlement(\(json(payload)))")
    }

    private func sendProduct(_ product: Product?) {
        guard let product else {
            evaluate("window.__donelySetProduct && window.__donelySetProduct(null)")
            return
        }
        let payload: [String: Any] = ["id": product.id, "displayPrice": product.displayPrice]
        evaluate("window.__donelySetProduct && window.__donelySetProduct(\(json(payload)))")
    }

    private func sendPurchaseResult(_ status: String, _ message: String? = nil) {
        let messageArg = message.map { ", \(json($0))" } ?? ""
        evaluate("window.__donelyPurchaseResult && window.__donelyPurchaseResult(\(json(status))\(messageArg))")
    }

    private func evaluate(_ script: String) {
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script)
        }
    }

    private func json(_ value: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]),
              let string = String(data: data, encoding: .utf8) else { return "null" }
        return string
    }
}

// MARK: - WKScriptMessageHandler

@available(iOS 15.0, *)
extension DonelyStoreKitBridge: WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "bridgeReady":
            Task { await loadProduct(); await pushEntitlement() }
        case "requestEntitlement":
            Task { await pushEntitlement() }
        case "requestProduct":
            Task { await loadProduct() }
        case "purchasePremium":
            Task { await purchase() }
        case "restorePurchase":
            Task { await restore() }
        case "manageSubscription":
            Task { await manageSubscriptions() }
        default:
            break
        }
    }
}

// MARK: - Local 7-day trial

/// First-launch trial clock. The start date is written to the Keychain so the
/// trial cannot be reset by deleting and reinstalling the app, with a
/// UserDefaults mirror for fast reads.
enum TrialClock {
    static let trialDays = 7
    private static let key = "app.donely.trial.start"

    static func daysLeft() -> Int {
        let start = startDate()
        let end = start.addingTimeInterval(Double(trialDays) * 86_400)
        let seconds = end.timeIntervalSinceNow
        return max(0, Int(ceil(seconds / 86_400)))
    }

    private static func startDate() -> Date {
        if let stored = readKeychain() ?? readDefaults() {
            writeDefaults(stored)
            writeKeychain(stored)
            return stored
        }
        let now = Date()
        writeDefaults(now)
        writeKeychain(now)
        return now
    }

    // UserDefaults mirror

    private static func readDefaults() -> Date? {
        let value = UserDefaults.standard.double(forKey: key)
        return value > 0 ? Date(timeIntervalSince1970: value) : nil
    }

    private static func writeDefaults(_ date: Date) {
        UserDefaults.standard.set(date.timeIntervalSince1970, forKey: key)
    }

    // Keychain (survives reinstall)

    private static func query() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "app.donely.mobile",
            kSecAttrAccount as String: key,
        ]
    }

    private static func readKeychain() -> Date? {
        var q = query()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let string = String(data: data, encoding: .utf8),
              let seconds = Double(string) else { return nil }
        return Date(timeIntervalSince1970: seconds)
    }

    private static func writeKeychain(_ date: Date) {
        guard let data = String(date.timeIntervalSince1970).data(using: .utf8) else { return }
        let q = query()
        if SecItemCopyMatching(q as CFDictionary, nil) == errSecSuccess {
            SecItemUpdate(q as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        } else {
            var add = q
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(add as CFDictionary, nil)
        }
    }
}
