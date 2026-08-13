//
//  DonelyMailBridge.swift
//  Donely
//
//  Native half of the Donely mail bridge.
//
//  Purpose: open MFMailComposeViewController with an HTML body where the
//  Donely weekly report PNG is embedded inline (base64 data URI), so the
//  recipient sees the card directly in the message instead of a file
//  attachment. The user always reviews, addresses and sends the mail.
//
//  Contract with the web app (see src/lib/mail-bridge.ts):
//    JS  -> composeMail { subject, html, plain, pngBase64, fileName }
//    Swift -> window.__donelyMailResult("sent"|"saved"|"cancelled"|"failed"|"unavailable")
//             window.__donelyMailAvailable = <Bool>
//

import Foundation
import MessageUI
import UIKit
import WebKit

private struct MailPayload: Decodable {
    let subject: String
    let html: String
    let plain: String?
    let pngBase64: String?
    let fileName: String?
}

final class DonelyMailBridge: NSObject {

    static let handlerNames = ["composeMail"]

    private weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
        super.init()
    }

    func register(on controller: WKUserContentController) {
        for name in DonelyMailBridge.handlerNames {
            controller.removeScriptMessageHandler(forName: name)
            controller.add(self, name: name)
        }
    }

    func webViewDidFinishLoad() {
        let available = MFMailComposeViewController.canSendMail()
        evaluate("window.__donelyMailAvailable = \(available ? "true" : "false");")
    }

    // MARK: - Compose

    private func present(_ payload: MailPayload) {
        guard MFMailComposeViewController.canSendMail() else {
            report("unavailable")
            return
        }
        guard let presenter = Self.topViewController() else {
            report("failed")
            return
        }

        let composer = MFMailComposeViewController()
        composer.mailComposeDelegate = self
        composer.setSubject(payload.subject)
        // HTML body: the report PNG is inlined as a data URI inside the HTML,
        // which iOS Mail renders and sends as part of the message body.
        composer.setMessageBody(payload.html, isHTML: true)

        presenter.present(composer, animated: true)
    }

    private func report(_ status: String) {
        evaluate("window.__donelyMailResult && window.__donelyMailResult('\(status)');")
    }

    private func evaluate(_ js: String) {
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive } ??
            UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var top = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

// MARK: - WKScriptMessageHandler

extension DonelyMailBridge: WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "composeMail" else { return }
        guard
            let body = message.body as? [String: Any],
            let data = try? JSONSerialization.data(withJSONObject: body),
            let payload = try? JSONDecoder().decode(MailPayload.self, from: data)
        else {
            report("failed")
            return
        }
        DispatchQueue.main.async { [weak self] in self?.present(payload) }
    }
}

// MARK: - MFMailComposeViewControllerDelegate

extension DonelyMailBridge: MFMailComposeViewControllerDelegate {
    func mailComposeController(
        _ controller: MFMailComposeViewController,
        didFinishWith result: MFMailComposeResult,
        error: Error?
    ) {
        controller.dismiss(animated: true) { [weak self] in
            switch result {
            case .sent: self?.report("sent")
            case .saved: self?.report("saved")
            case .cancelled: self?.report("cancelled")
            default: self?.report("failed")
            }
        }
    }
}
