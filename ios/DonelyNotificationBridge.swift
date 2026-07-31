//
//  DonelyNotificationBridge.swift
//  Donely
//
//  Reference implementation of the native half of the notification bridge.
//  Drop this file into the Xcode project (Capacitor/WKWebView shell) and wire
//  it up as described at the bottom of the file.
//
//  It only covers the weekly local notification. Permissions, scheduling,
//  deduplication and the on/off toggle keep the exact same contract as before —
//  the only new pieces are:
//    * `title` / `body` come fully localized from JavaScript and are used as-is
//    * `bodyLines` gives the same body pre-split, so multi-line rendering is
//      guaranteed even if newlines are mangled somewhere in the bridge
//    * `route` is stored in userInfo for deep linking on tap
//

import Foundation
import UIKit
import UserNotifications
import WebKit

// MARK: - Payload

private struct WeeklyReminderPayload: Decodable {
    let id: String
    let weekday: Int          // iOS DateComponents: Sunday = 1 → Friday = 6
    let hour: Int
    let minute: Int
    let repeats: Bool
    let title: String         // already localized by JS
    let body: String          // already localized by JS, may contain "\n"
    let bodyLines: [String]?  // same body, pre-split
    let language: String?
    let timeZone: String?
    let route: String?

    /// Multi-line body: one line per category, an empty line, then the total.
    var resolvedBody: String {
        if let lines = bodyLines, !lines.isEmpty {
            return lines.joined(separator: "\n")
        }
        // Defensive: some bridges escape newlines on the way over.
        return body
            .replacingOccurrences(of: "\\n", with: "\n")
            .replacingOccurrences(of: "\r\n", with: "\n")
    }
}

private struct CancelPayload: Decodable { let id: String }

// MARK: - Bridge

final class DonelyNotificationBridge: NSObject {

    /// Handler names the web app posts to via `webkit.messageHandlers`.
    static let handlerNames = [
        "requestNotificationStatus",
        "requestNotificationPermission",
        "scheduleWeeklyReminder",
        "cancelNotification",
        "openAppSettings",
    ]

    private weak var webView: WKWebView?
    private let center = UNUserNotificationCenter.current()

    init(webView: WKWebView) {
        self.webView = webView
        super.init()
        center.delegate = self
    }

    // MARK: JS → Swift

    private func handleStatusRequest() {
        center.getNotificationSettings { [weak self] settings in
            self?.sendPermission(settings.authorizationStatus)
        }
    }

    private func handlePermissionRequest() {
        center.getNotificationSettings { [weak self] settings in
            guard let self else { return }
            guard settings.authorizationStatus == .notDetermined else {
                // iOS only ever shows the system dialog once.
                self.sendPermission(settings.authorizationStatus)
                return
            }
            self.center.requestAuthorization(options: [.alert, .sound, .badge]) { _, error in
                if let error {
                    self.sendError(error.localizedDescription)
                }
                self.center.getNotificationSettings { updated in
                    self.sendPermission(updated.authorizationStatus)
                }
            }
        }
    }

    private func schedule(_ payload: WeeklyReminderPayload) {
        let content = UNMutableNotificationContent()
        content.title = payload.title           // "Din vecka i Donely"
        content.body = payload.resolvedBody     // multi-line summary
        content.sound = .default
        if let route = payload.route {
            content.userInfo["route"] = route   // "/veckostatistik"
        }

        var comps = DateComponents()
        comps.weekday = payload.weekday         // 6 = Friday
        comps.hour = payload.hour               // 17
        comps.minute = payload.minute           // 0
        // No timeZone is set on purpose → Calendar.current follows the device,
        // so the reminder stays at 17:00 local time across DST and travel.

        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: payload.repeats)
        let request = UNNotificationRequest(identifier: payload.id, content: content, trigger: trigger)

        // Stable identifier + explicit removal = no duplicates when the body is
        // rescheduled on every data change.
        center.removePendingNotificationRequests(withIdentifiers: [payload.id])
        center.add(request) { [weak self] error in
            guard let self else { return }
            if let error {
                self.sendError(error.localizedDescription)
                return
            }
            self.center.getPendingNotificationRequests { requests in
                let next = requests
                    .first { $0.identifier == payload.id }
                    .flatMap { ($0.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate() }
                self.sendScheduled(id: payload.id, nextFireDate: next, language: payload.language)
            }
        }
    }

    private func cancel(id: String) {
        center.removePendingNotificationRequests(withIdentifiers: [id])
        center.removeDeliveredNotifications(withIdentifiers: [id])
    }

    private func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        DispatchQueue.main.async { UIApplication.shared.open(url) }
    }

    // MARK: Swift → JS

    private func sendPermission(_ status: UNAuthorizationStatus) {
        let value: String
        switch status {
        case .authorized, .ephemeral: value = "granted"
        case .denied: value = "denied"
        case .provisional: value = "provisional"
        default: value = "notDetermined"
        }
        evaluate("window.__donelySetNotificationPermission(\(json(value)))")
    }

    private func sendScheduled(id: String, nextFireDate: Date?, language: String?) {
        var payload: [String: Any] = ["id": id]
        if let nextFireDate {
            payload["nextFireDate"] = ISO8601DateFormatter().string(from: nextFireDate)
        }
        if let language { payload["language"] = language }
        evaluate("window.__donelyNotificationScheduled(\(json(payload)))")
    }

    private func sendError(_ message: String) {
        evaluate("window.__donelyNotificationError(\(json(message)))")
    }

    /// Called when the user taps the notification.
    private func openRoute(_ route: String) {
        evaluate("window.__donelyOpenRoute && window.__donelyOpenRoute(\(json(route)))")
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

    private func decode<T: Decodable>(_ type: T.Type, from body: Any) -> T? {
        let data: Data?
        if let string = body as? String {
            data = string.data(using: .utf8)
        } else {
            data = try? JSONSerialization.data(withJSONObject: body)
        }
        guard let data else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
}

// MARK: - WKScriptMessageHandler

extension DonelyNotificationBridge: WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "requestNotificationStatus":
            handleStatusRequest()
        case "requestNotificationPermission":
            handlePermissionRequest()
        case "scheduleWeeklyReminder":
            guard let payload = decode(WeeklyReminderPayload.self, from: message.body) else {
                sendError("Invalid scheduleWeeklyReminder payload")
                return
            }
            schedule(payload)
        case "cancelNotification":
            if let payload = decode(CancelPayload.self, from: message.body) {
                cancel(id: payload.id)
            }
        case "openAppSettings":
            openAppSettings()
        default:
            break
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension DonelyNotificationBridge: UNUserNotificationCenterDelegate {
    // Show the summary even when Donely is in the foreground.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .list])
    }

    // Tap → deep link into the weekly statistics screen.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let route = response.notification.request.content.userInfo["route"] as? String
        openRoute(route ?? "/veckostatistik")
        completionHandler()
    }
}

// MARK: - Wiring
//
// In the view controller that owns the WKWebView:
//
//   let config = WKWebViewConfiguration()
//   let webView = WKWebView(frame: .zero, configuration: config)
//   let bridge = DonelyNotificationBridge(webView: webView)   // keep a strong reference
//   for name in DonelyNotificationBridge.handlerNames {
//       config.userContentController.add(bridge, name: name)
//   }
//
// The web app pings `requestNotificationStatus` on launch and whenever the app
// regains focus, so no extra call is needed from Swift on foregrounding.
