import Foundation
import HealthKit
import UIKit
import UserNotifications
import WebKit

/// 页面和原生之间的桥。页面发来的消息（window.webkit.messageHandlers.native.postMessage）：
/// - ready：页面加载完成
/// - reminders：按休息提醒设置重排系统通知（on / every / start / end / workdays）
/// - health：读取 Apple 健康里最新的体重、体脂率、身高、年龄、性别
/// - share：把文本存成文件，弹出系统分享（filename / text）
/// 原生回调页面的函数：nativeRemindStatus、nativeHealth、nativeReminderTapped。
@MainActor
final class NativeBridge: NSObject, WKScriptMessageHandler, UNUserNotificationCenterDelegate {
    static let shared = NativeBridge()

    weak var webView: WKWebView?
    private let health = HKHealthStore()
    private var pageReady = false
    private var pendingTap = false

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "ready":
            pageReady = true
            if pendingTap {
                pendingTap = false
                call("nativeReminderTapped")
            }
        case "reminders":
            Task { await scheduleReminders(body) }
        case "health":
            Task { await readHealth() }
        case "share":
            share(filename: body["filename"] as? String ?? "练了吗.txt", text: body["text"] as? String ?? "")
        default:
            break
        }
    }

    private func call(_ fn: String, _ payload: [String: Any]? = nil) {
        var arg = ""
        if let payload,
           let data = try? JSONSerialization.data(withJSONObject: payload),
           let json = String(data: data, encoding: .utf8) {
            arg = json
        }
        webView?.evaluateJavaScript("window.\(fn) && window.\(fn)(\(arg)); undefined", completionHandler: nil)
    }

    // MARK: - 休息提醒

    private func scheduleReminders(_ p: [String: Any]) async {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        guard p["on"] as? Bool == true else {
            call("nativeRemindStatus", ["on": false])
            return
        }
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        guard granted else {
            call("nativeRemindStatus", ["on": true, "granted": false])
            return
        }

        let every = max(15, p["every"] as? Int ?? 60)
        let start = minutes(p["start"] as? String ?? "09:00")
        let end = minutes(p["end"] as? String ?? "18:00")
        let workdays = p["workdays"] as? Bool ?? true
        var slots: [Int] = []
        var m = start + every
        while m <= end {
            slots.append(m)
            m += every
        }

        // iOS 最多保留 64 条待发通知：工作日按周一到周五各排一遍，排不下就改成每天提醒
        let perWeekday = workdays && slots.count * 5 <= 64
        let weekdays: [Int?] = perWeekday ? [2, 3, 4, 5, 6] : [nil]
        let label = every % 60 == 0 ? "\(every / 60) 小时" : every < 60 ? "\(every) 分钟" : String(format: "%.1f 小时", Double(every) / 60)

        var count = 0
        for day in weekdays {
            for slot in slots.prefix(64) {
                var when = DateComponents()
                when.hour = slot / 60
                when.minute = slot % 60
                if let day { when.weekday = day }
                let content = UNMutableNotificationContent()
                content.title = "已经坐了 \(label)啦"
                content.body = "起来动一动，顺便喝杯水 💧"
                content.sound = .default
                let request = UNNotificationRequest(
                    identifier: "remind-\(day ?? 0)-\(slot)",
                    content: content,
                    trigger: UNCalendarNotificationTrigger(dateMatching: when, repeats: true)
                )
                if (try? await center.add(request)) != nil { count += 1 }
            }
        }
        call("nativeRemindStatus", ["on": true, "granted": true, "count": count, "everyDay": workdays && !perWeekday])
    }

    private func minutes(_ time: String) -> Int {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        return (parts.first ?? 9) * 60 + (parts.count > 1 ? parts[1] : 0)
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // App 开着时页面自己会弹提醒，系统横幅就不再重复
        completionHandler([])
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        Task { @MainActor in
            if self.pageReady {
                self.call("nativeReminderTapped")
            } else {
                self.pendingTap = true
            }
            completionHandler()
        }
    }

    // MARK: - Apple 健康

    private func readHealth() async {
        guard HKHealthStore.isHealthDataAvailable() else {
            call("nativeHealth", ["error": "这台设备不支持 Apple 健康"])
            return
        }
        guard let mass = HKObjectType.quantityType(forIdentifier: .bodyMass),
              let fat = HKObjectType.quantityType(forIdentifier: .bodyFatPercentage),
              let height = HKObjectType.quantityType(forIdentifier: .height),
              let birth = HKObjectType.characteristicType(forIdentifier: .dateOfBirth),
              let sex = HKObjectType.characteristicType(forIdentifier: .biologicalSex) else { return }
        do {
            try await health.requestAuthorization(toShare: [], read: [mass, fat, height, birth, sex])
        } catch {
            call("nativeHealth", ["error": "没能打开 Apple 健康的授权"])
            return
        }

        // 没授权读取时 HealthKit 不会报错，只是查不到数据，由页面提示
        var out: [String: Any] = [:]
        if let s = await latest(mass) {
            out["weight"] = s.quantity.doubleValue(for: .gramUnit(with: .kilo))
            out["weightDate"] = dayString(s.endDate)
        }
        if let s = await latest(fat) {
            out["fat"] = s.quantity.doubleValue(for: .percent()) * 100
            out["fatDate"] = dayString(s.endDate)
        }
        if let s = await latest(height) {
            out["height"] = s.quantity.doubleValue(for: .meterUnit(with: .centi))
        }
        if let year = (try? health.dateOfBirthComponents())?.year {
            out["age"] = Calendar.current.component(.year, from: Date()) - year
        }
        if let value = try? health.biologicalSex().biologicalSex {
            if value == .male { out["sex"] = "m" } else if value == .female { out["sex"] = "f" }
        }
        call("nativeHealth", out)
    }

    private func latest(_ type: HKQuantityType) async -> HKQuantitySample? {
        let query = HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: type)],
            sortDescriptors: [SortDescriptor(\.endDate, order: .reverse)],
            limit: 1
        )
        return try? await query.result(for: health).first
    }

    private func dayString(_ date: Date) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    // MARK: - 系统分享（导出备份、日历文件）

    private func share(filename: String, text: String) {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        guard (try? text.write(to: url, atomically: true, encoding: .utf8)) != nil else { return }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        guard let root = UIApplication.shared.connectedScenes
            .compactMap({ ($0 as? UIWindowScene)?.keyWindow })
            .first?.rootViewController else { return }
        var top = root
        while let presented = top.presentedViewController { top = presented }
        sheet.popoverPresentationController?.sourceView = top.view
        top.present(sheet, animated: true)
    }
}
