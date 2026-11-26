import AppIntents
import Foundation
import WidgetKit

// Compiled into BOTH the App target and the NotifyeWidgets extension (see setup-ios-widget.rb).

struct NotifyeWidgetState: Codable {
    var apiKey: String
    var projectId: String
    var databaseId: String
    var refreshToken: String
    var uid: String
    var displayName: String
    var pairId: String
    var partnerName: String
    var memberUids: [String]
    var buttonLabel: String
    var buttonColorHex: String
    var backgroundColorHex: String
    var normalMessage: String
    var priorityMessage: String
    var defaultUrgent: Bool
    // Exact in-app button look (optional so older saved state still decodes)
    var buttonTopHex: String? = nil
    var buttonBottomHex: String? = nil
    var buttonInkHex: String? = nil
    var buttonShape: String? = nil
    var buttonSubLabel: String? = nil
    /// Partner's ntfy topic for notifications while their app is closed ('' / nil if off).
    var partnerPushTopic: String? = nil

    static let placeholder = NotifyeWidgetState(
        apiKey: "",
        projectId: "",
        databaseId: "(default)",
        refreshToken: "",
        uid: "",
        displayName: "You",
        pairId: "",
        partnerName: "Partner",
        memberUids: [],
        buttonLabel: "Think of me",
        buttonColorHex: "#F59E0B",
        backgroundColorHex: "#0B0B0F",
        normalMessage: "Your partner wants your attention",
        priorityMessage: "Your partner really needs your attention",
        defaultUrgent: false
    )

    var isPaired: Bool {
        !pairId.isEmpty && memberUids.count == 2 && !refreshToken.isEmpty && !apiKey.isEmpty
    }

    static func load() -> NotifyeWidgetState? {
        guard
            let data = NotifyeShared.loadStateData(),
            let state = try? JSONDecoder().decode(NotifyeWidgetState.self, from: data)
        else { return nil }
        return state
    }
}

// MARK: - Send intents

/// Fast path: runs inside the widget extension itself (no app launch). Used when the widget can
/// read the pairing from the shared App Group.
@available(iOS 17.0, *)
struct SendNotifyePingIntent: AppIntent {
    static var title: LocalizedStringResource = "Notify Partner"
    static var description = IntentDescription("Sends a Notifye notification to your paired partner.")
    static var openAppWhenRun: Bool = false
    static var isDiscoverable: Bool = false

    @Parameter(title: "Priority Alert", default: false)
    var isUrgent: Bool

    init() { self.isUrgent = false }
    init(isUrgent: Bool) { self.isUrgent = isUrgent }

    func perform() async throws -> some IntentResult {
        await NotifyeSender().send(isUrgent: isUrgent)
        return .result()
    }
}

/// Fallback: LiveActivityIntent makes iOS run perform() inside the Notifye app process (started
/// in the background, nothing opens on screen), which can read the app's own storage when
/// re-signing broke the App Group. Slower, because the app may have to start first.
@available(iOS 17.0, *)
struct SendNotifyePingViaAppIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Notify Partner (via app)"
    static var description = IntentDescription("Sends a Notifye notification to your paired partner.")
    static var openAppWhenRun: Bool = false
    static var isDiscoverable: Bool = false

    @Parameter(title: "Priority Alert", default: false)
    var isUrgent: Bool

    init() { self.isUrgent = false }
    init(isUrgent: Bool) { self.isUrgent = isUrgent }

    func perform() async throws -> some IntentResult {
        await NotifyeSender().send(isUrgent: isUrgent)
        return .result()
    }
}

@available(iOS 17.0, *)
struct NotifyeSender {
    func send(isUrgent: Bool) async {
        guard let state = NotifyeWidgetState.load(), state.isPaired else {
            NotifyeShared.setStatus("Open Notifye once to connect")
            WidgetCenter.shared.reloadAllTimelines()
            return
        }

        do {
            let idToken = try await NotifyeFirestore.idToken(apiKey: state.apiKey, refreshToken: state.refreshToken)
            // Save the tap and wake the partner's phone at the same time.
            async let push: Void = sendClosedAppPush(state: state, isUrgent: isUrgent)
            do {
                try await commitFirestorePing(state: state, idToken: idToken, isUrgent: isUrgent)
            } catch {
                // A cached token may have been revoked: retry once with a fresh one.
                NotifyeFirestore.clearCachedToken()
                let fresh = try await NotifyeFirestore.idToken(apiKey: state.apiKey, refreshToken: state.refreshToken)
                try await commitFirestorePing(state: state, idToken: fresh, isUrgent: isUrgent)
            }
            await push
            NotifyeShared.setStatus(isUrgent ? "Priority sent to \(state.partnerName)" : "Sent to \(state.partnerName)")
            NotifyeShared.markSent(urgent: isUrgent)
        } catch {
            NotifyeShared.setStatus("Couldn't send · check internet")
        }

        WidgetCenter.shared.reloadAllTimelines()
    }

    /// Same as sendClosedAppPush() in src/utils/closedAppPush.ts: publish to the partner's ntfy topic.
    private func sendClosedAppPush(state: NotifyeWidgetState, isUrgent: Bool) async {
        guard
            let topic = state.partnerPushTopic,
            topic.range(of: "^notifye-[a-z0-9]{24}$", options: .regularExpression) != nil,
            let url = URL(string: "https://ntfy.sh")
        else { return }
        let body: [String: Any] = [
            "topic": topic,
            "title": isUrgent ? "Priority from \(state.displayName)" : state.displayName,
            "message": isUrgent ? state.priorityMessage : state.normalMessage,
            "priority": isUrgent ? 5 : 4,
            "tags": [isUrgent ? "rotating_light" : "bell"],
        ]
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 10
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        _ = try? await URLSession.shared.data(for: req)
    }

    private func commitFirestorePing(state: NotifyeWidgetState, idToken: String, isUrgent: Bool) async throws {
        let dbId = state.databaseId.isEmpty ? "(default)" : state.databaseId
        guard let url = URL(
            string: "https://firestore.googleapis.com/v1/projects/\(state.projectId)/databases/\(dbId)/documents:commit"
        ) else {
            throw URLError(.badURL)
        }

        let nowMs = Int64(Date().timeIntervalSince1970 * 1000.0)
        let rev = String(format: "%013lld", max(0, 9999999999999 - nowMs))
        let suffix = String(state.uid.prefix(6)).filter { $0.isLetter || $0.isNumber }
        let rand = String(UUID().uuidString.prefix(4)).lowercased()
        let pingId = "\(rev)_\(suffix.isEmpty ? "wgt" : suffix)_\(rand)"

        let message = isUrgent ? state.priorityMessage : state.normalMessage
        let kind = isUrgent ? "urgent_attention" : "attention"
        let baseDocPath = "projects/\(state.projectId)/databases/\(dbId)/documents"
        let pairDocName = "\(baseDocPath)/pairs/\(state.pairId)"
        let pingDocName = "\(pairDocName)/pings/\(pingId)"

        let memberArray = state.memberUids.map { ["stringValue": $0] }

        // The shared pair summary is updated at most every 1.5 s (like the app does); every tap
        // still gets its own ping document.
        let lastPairUpdate = UserDefaults.standard.double(forKey: "notifye_widget_pair_update_ms")
        let updatePair = Double(nowMs) - lastPairUpdate > 1500
        if updatePair { UserDefaults.standard.set(Double(nowMs), forKey: "notifye_widget_pair_update_ms") }

        let pairWrite: [String: Any] = [
            "update": [
                "name": pairDocName,
                "fields": [
                    "lastPingByUid": ["stringValue": state.uid],
                    "lastPingMessage": ["stringValue": message],
                ],
            ],
            "updateMask": [
                "fieldPaths": ["lastPingByUid", "lastPingMessage"],
            ],
            "updateTransforms": [
                ["fieldPath": "lastPingAt", "setToServerValue": "REQUEST_TIME"],
                ["fieldPath": "updatedAt", "setToServerValue": "REQUEST_TIME"],
                ["fieldPath": "pingCount", "increment": ["integerValue": "1"]],
            ],
        ]
        let pingWrite: [String: Any] = [
            "currentDocument": ["exists": false],
            "update": [
                "name": pingDocName,
                "fields": [
                    "pingId": ["stringValue": pingId],
                    "pairId": ["stringValue": state.pairId],
                    "memberUids": ["arrayValue": ["values": memberArray]],
                    "senderUid": ["stringValue": state.uid],
                    "senderName": ["stringValue": state.displayName],
                    "message": ["stringValue": message],
                    "kind": ["stringValue": kind],
                    "momentCardUrl": ["stringValue": ""],
                    "aspectRatio": ["stringValue": ""],
                ],
            ],
            "updateTransforms": [
                ["fieldPath": "createdAt", "setToServerValue": "REQUEST_TIME"],
            ],
        ]
        let body: [String: Any] = ["writes": updatePair ? [pairWrite, pingWrite] : [pingWrite]]

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 15
        req.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (_, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}

// MARK: - Firestore REST helpers (shared by the widget intent and the background check)

@available(iOS 15.0, *)
enum NotifyeFirestore {
    /// Exchanges the saved Firebase refresh token for a short-lived ID token.
    private static let tokenKey = "notifye_cached_id_token"
    private static let tokenExpKey = "notifye_cached_id_token_exp"
    private static let tokenOwnerKey = "notifye_cached_id_token_owner"

    /// Firebase ID tokens are valid for an hour; reusing one saves a round trip on every tap.
    static func clearCachedToken() {
        for store in [NotifyeShared.defaults, UserDefaults.standard].compactMap({ $0 }) {
            store.removeObject(forKey: tokenKey)
            store.removeObject(forKey: tokenExpKey)
            store.removeObject(forKey: tokenOwnerKey)
        }
    }

    static func idToken(apiKey: String, refreshToken: String) async throws -> String {
        let stores = [NotifyeShared.defaults, UserDefaults.standard].compactMap { $0 }
        let owner = String(refreshToken.suffix(24)) // a token only counts for the identity that made it
        for store in stores {
            if let token = store.string(forKey: tokenKey),
               store.string(forKey: tokenOwnerKey) == owner,
               store.double(forKey: tokenExpKey) > Date().timeIntervalSince1970 + 120 {
                return token
            }
        }
        let (token, expiresIn) = try await exchange(apiKey: apiKey, refreshToken: refreshToken)
        let exp = Date().timeIntervalSince1970 + expiresIn
        for store in stores {
            store.set(token, forKey: tokenKey)
            store.set(exp, forKey: tokenExpKey)
            store.set(owner, forKey: tokenOwnerKey)
        }
        return token
    }

    private static func exchange(apiKey: String, refreshToken: String) async throws -> (String, TimeInterval) {
        guard let url = URL(string: "https://securetoken.googleapis.com/v1/token?key=\(apiKey)") else {
            throw URLError(.badURL)
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 15
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        let encoded = refreshToken.addingPercentEncoding(withAllowedCharacters: allowed) ?? refreshToken
        req.httpBody = "grant_type=refresh_token&refresh_token=\(encoded)".data(using: .utf8)

        let (respData, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.userAuthenticationRequired)
        }
        guard
            let json = try JSONSerialization.jsonObject(with: respData) as? [String: Any],
            let idToken = json["id_token"] as? String
        else {
            throw URLError(.cannotParseResponse)
        }
        let expiresIn = TimeInterval((json["expires_in"] as? String).flatMap(Double.init) ?? 3600)
        return (idToken, expiresIn)
    }

    struct PairSummary {
        let lastPingAt: Date?
        let lastPingByUid: String
        let lastPingMessage: String
        let status: String
    }

    /// Reads the pair's summary fields (updated on every burst of pings).
    static func pairSummary(state: NotifyeWidgetState, idToken: String) async throws -> PairSummary {
        let dbId = state.databaseId.isEmpty ? "(default)" : state.databaseId
        let fields = ["lastPingAt", "lastPingByUid", "lastPingMessage", "status"]
            .map { "mask.fieldPaths=\($0)" }
            .joined(separator: "&")
        guard let url = URL(
            string: "https://firestore.googleapis.com/v1/projects/\(state.projectId)/databases/\(dbId)/documents/pairs/\(state.pairId)?\(fields)"
        ) else {
            throw URLError(.badURL)
        }
        var req = URLRequest(url: url)
        req.timeoutInterval = 15
        req.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let json = (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
        let f = (json["fields"] as? [String: Any]) ?? [:]
        func str(_ key: String) -> String {
            ((f[key] as? [String: Any])?["stringValue"] as? String) ?? ""
        }
        var date: Date?
        if let ts = (f["lastPingAt"] as? [String: Any])?["timestampValue"] as? String {
            let fmt = ISO8601DateFormatter()
            fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            date = fmt.date(from: ts) ?? ISO8601DateFormatter().date(from: ts)
        }
        return PairSummary(
            lastPingAt: date,
            lastPingByUid: str("lastPingByUid"),
            lastPingMessage: str("lastPingMessage"),
            status: str("status")
        )
    }
}
