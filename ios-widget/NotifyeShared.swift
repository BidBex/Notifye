import Foundation

/// Shared between the App target and the NotifyeWidgets extension.
enum NotifyeShared {
    static let defaultAppGroup = "group.com.notifye.app"
    static let stateKey = "notifye_widget_state"
    static let lastSentKey = "notifye_widget_last_sent_ms"
    static let lastStatusKey = "notifye_widget_last_status"

    /// Re-signing tools (Sideloadly, AltStore) often rewrite the bundle ID and App Group to
    /// "group.<new bundle id>". Pick the first group this build is actually entitled to, so the
    /// app and the widget keep sharing the same storage after re-signing.
    static var appGroupId: String? {
        let bundleId = Bundle.main.bundleIdentifier ?? ""
        let appBundleId = bundleId.hasSuffix(".widgets")
            ? String(bundleId.dropLast(".widgets".count))
            : bundleId
        var candidates = [defaultAppGroup]
        if !appBundleId.isEmpty {
            candidates.insert("group.\(appBundleId)", at: 0)
        }
        for id in candidates
        where FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id) != nil {
            return id
        }
        return nil
    }

    static var defaults: UserDefaults? {
        guard let id = appGroupId else { return nil }
        return UserDefaults(suiteName: id)
    }
}
