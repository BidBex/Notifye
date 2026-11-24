import Capacitor
import Foundation
import WidgetKit

@objc(NotifyeWidgetBridge)
public class NotifyeWidgetBridge: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NotifyeWidgetBridge"
    public let jsName = "NotifyeWidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "syncWidgetState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearWidgetState", returnType: CAPPluginReturnPromise)
    ]

    private let appGroup = "group.com.notifye.app"
    private let stateKey = "notifye_widget_state"

    @objc func syncWidgetState(_ call: CAPPluginCall) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: call.options ?? [:]) else {
            call.reject("Invalid widget state payload")
            return
        }
        if let defaults = UserDefaults(suiteName: appGroup) {
            defaults.set(jsonData, forKey: stateKey)
            defaults.synchronize()
        }
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }

    @objc func clearWidgetState(_ call: CAPPluginCall) {
        if let defaults = UserDefaults(suiteName: appGroup) {
            defaults.removeObject(forKey: stateKey)
            defaults.synchronize()
        }
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
