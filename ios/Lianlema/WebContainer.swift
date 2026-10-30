import SwiftUI
import WebKit

/// 加载打包进 App 的 web/index.html，并把 window.webkit.messageHandlers.native 接到 NativeBridge。
struct WebContainer: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(NativeBridge.shared, name: "native")
        config.websiteDataStore = .default()

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 242 / 255, green: 248 / 255, blue: 245 / 255, alpha: 1)
        // 安全区交给页面的 env(safe-area-inset-*) 处理
        web.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif

        NativeBridge.shared.webView = web
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
