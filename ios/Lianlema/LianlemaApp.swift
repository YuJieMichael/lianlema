import SwiftUI
import UserNotifications

/// 练了吗：SwiftUI 外壳，界面沿用 web/ 里的页面，原生部分负责通知、Apple 健康和系统分享。
@main
struct LianlemaApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            WebContainer()
                .ignoresSafeArea()
                .background(Color(red: 242 / 255, green: 248 / 255, blue: 245 / 255))
                .preferredColorScheme(.light)
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // 点通知打开 App 时，要能把「起来动一动」弹窗交给页面
        UNUserNotificationCenter.current().delegate = NativeBridge.shared
        return true
    }
}
