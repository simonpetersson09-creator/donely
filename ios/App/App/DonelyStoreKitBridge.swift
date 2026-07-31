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

        // Not subscribed yet, but eligible for the 7-day introductory offer.
        if !subscribed,
           let product = await currentProduct(),
           let subscription = product.subscription,
           await subscription.isEligibleForIntroOffer,
           let intro = subscription.introductoryOffer,
           intro.paymentMode == .freeTrial {
            inTrial = false
            trialDaysLeft = 0
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
