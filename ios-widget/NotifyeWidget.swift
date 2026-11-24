import AppIntents
import Foundation
import SwiftUI
import WidgetKit

private let kWidgetAppGroup = "group.com.notifye.app"
private let kWidgetStateKey = "notifye_widget_state"
private let kWidgetLastSentKey = "notifye_widget_last_sent_ms"
private let kWidgetLastStatusKey = "notifye_widget_last_status"

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
}

@available(iOS 17.0, *)
struct SendNotifyePingIntent: AppIntent {
    static var title: LocalizedStringResource = "Send Notifye Ping"
    static var description = IntentDescription("Press inside the widget to notify your paired partner.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Priority Alert", default: false)
    var isUrgent: Bool

    init() {
        self.isUrgent = false
    }

    init(isUrgent: Bool) {
        self.isUrgent = isUrgent
    }

    func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: kWidgetAppGroup)
        guard
            let data = defaults?.data(forKey: kWidgetStateKey),
            let state = try? JSONDecoder().decode(NotifyeWidgetState.self, from: data),
            !state.pairId.isEmpty,
            !state.refreshToken.isEmpty,
            !state.apiKey.isEmpty,
            state.memberUids.count == 2
        else {
            defaults?.set("Open Notifye to pair", forKey: kWidgetLastStatusKey)
            WidgetCenter.shared.reloadAllTimelines()
            return .result()
        }

        do {
            let idToken = try await exchangeRefreshToken(apiKey: state.apiKey, refreshToken: state.refreshToken)
            try await commitFirestorePing(state: state, idToken: idToken, isUrgent: isUrgent)
            defaults?.set(Date().timeIntervalSince1970 * 1000.0, forKey: kWidgetLastSentKey)
            defaults?.set(
                isUrgent ? "Priority sent to \(state.partnerName)" : "Sent to \(state.partnerName)",
                forKey: kWidgetLastStatusKey
            )
        } catch {
            defaults?.set("Tap app to reconnect", forKey: kWidgetLastStatusKey)
        }

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }

    private func exchangeRefreshToken(apiKey: String, refreshToken: String) async throws -> String {
        guard let url = URL(string: "https://securetoken.googleapis.com/v1/token?key=\(apiKey)") else {
            throw URLError(.badURL)
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let encoded = refreshToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? refreshToken
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
        return idToken
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

        let body: [String: Any] = [
            "writes": [
                [
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
                        [
                            "fieldPath": "lastPingAt",
                            "setToServerValue": "REQUEST_TIME",
                        ],
                        [
                            "fieldPath": "updatedAt",
                            "setToServerValue": "REQUEST_TIME",
                        ],
                        [
                            "fieldPath": "pingCount",
                            "increment": ["integerValue": "1"],
                        ],
                    ],
                ],
                [
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
                        [
                            "fieldPath": "createdAt",
                            "setToServerValue": "REQUEST_TIME",
                        ],
                    ],
                ],
            ],
        ]

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (_, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}

struct NotifyeTimelineEntry: TimelineEntry {
    let date: Date
    let state: NotifyeWidgetState
    let lastStatus: String
    let recentlySent: Bool
}

struct NotifyeProvider: TimelineProvider {
    func placeholder(in context: Context) -> NotifyeTimelineEntry {
        NotifyeTimelineEntry(date: Date(), state: .placeholder, lastStatus: "", recentlySent: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (NotifyeTimelineEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NotifyeTimelineEntry>) -> Void) {
        let entry = loadEntry()
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }

    private func loadEntry() -> NotifyeTimelineEntry {
        let defaults = UserDefaults(suiteName: kWidgetAppGroup)
        var state = NotifyeWidgetState.placeholder
        if let data = defaults?.data(forKey: kWidgetStateKey),
           let decoded = try? JSONDecoder().decode(NotifyeWidgetState.self, from: data) {
            state = decoded
        }
        let lastSentMs = defaults?.double(forKey: kWidgetLastSentKey) ?? 0
        let recentlySent = (Date().timeIntervalSince1970 * 1000.0 - lastSentMs) < 12_000
        let status = recentlySent ? (defaults?.string(forKey: kWidgetLastStatusKey) ?? "") : ""
        return NotifyeTimelineEntry(date: Date(), state: state, lastStatus: status, recentlySent: recentlySent)
    }
}

@available(iOS 17.0, *)
struct NotifyeWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: NotifyeTimelineEntry

    private var accentColor: Color {
        Color(hex: entry.state.buttonColorHex)
    }

    private var bgColor: Color {
        Color(hex: entry.state.backgroundColorHex)
    }

    private var isPaired: Bool {
        !entry.state.pairId.isEmpty
    }

    var body: some View {
        switch family {
        case .accessoryCircular:
            Button(intent: SendNotifyePingIntent(isUrgent: entry.state.defaultUrgent)) {
                ZStack {
                    AccessoryWidgetBackground()
                    Image(systemName: entry.recentlySent ? "checkmark" : "bell.fill")
                        .font(.system(size: 18, weight: .semibold))
                }
            }
            .buttonStyle(.plain)
            .containerBackground(.clear, for: .widget)

        case .systemMedium:
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Notifye")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.65))
                    Text(isPaired ? "Reach \(entry.state.partnerName)" : "Open to pair")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Text(
                        !entry.lastStatus.isEmpty
                            ? entry.lastStatus
                            : (isPaired ? "Press a button to notify" : "Link your partner in app")
                    )
                    .font(.caption2)
                    .foregroundStyle(entry.recentlySent ? accentColor : .white.opacity(0.6))
                    .lineLimit(2)
                }

                Spacer(minLength: 4)

                HStack(spacing: 10) {
                    Button(intent: SendNotifyePingIntent(isUrgent: false)) {
                        VStack(spacing: 4) {
                            Image(systemName: entry.recentlySent ? "checkmark" : "sparkle")
                                .font(.system(size: 18, weight: .semibold))
                            Text(entry.state.buttonLabel)
                                .font(.caption2.weight(.semibold))
                                .lineLimit(1)
                        }
                        .frame(width: 78, height: 84)
                        .foregroundStyle(Color(hex: "#0B0B0F"))
                        .background(accentColor, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    }
                    .buttonStyle(.plain)

                    Button(intent: SendNotifyePingIntent(isUrgent: true)) {
                        VStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 16, weight: .semibold))
                            Text("Priority")
                                .font(.caption2.weight(.semibold))
                                .lineLimit(1)
                        }
                        .frame(width: 64, height: 84)
                        .foregroundStyle(Color(hex: "#FDA4AF"))
                        .background(Color(hex: "#FB7185").opacity(0.18), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(2)
            .containerBackground(bgColor, for: .widget)

        default:
            VStack(spacing: 8) {
                Text(isPaired ? entry.state.partnerName : "Notifye")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(1)

                Button(intent: SendNotifyePingIntent(isUrgent: entry.state.defaultUrgent)) {
                    ZStack {
                        Circle()
                            .fill(accentColor)
                            .frame(width: 76, height: 76)
                            .shadow(color: accentColor.opacity(0.35), radius: 10)
                        VStack(spacing: 2) {
                            Image(systemName: entry.recentlySent ? "checkmark" : "bell.badge.fill")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundStyle(Color(hex: "#0B0B0F"))
                            Text(entry.recentlySent ? "Sent" : "Tap")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(Color(hex: "#0B0B0F"))
                        }
                    }
                }
                .buttonStyle(.plain)

                Text(
                    !entry.lastStatus.isEmpty
                        ? entry.lastStatus
                        : entry.state.buttonLabel
                )
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.65))
                .lineLimit(1)
            }
            .containerBackground(bgColor, for: .widget)
        }
    }
}

@available(iOS 17.0, *)
struct NotifyeQuickButtonWidget: Widget {
    let kind: String = "NotifyeQuickButtonWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NotifyeProvider()) { entry in
            NotifyeWidgetView(entry: entry)
        }
        .configurationDisplayName("Notifye Quick Button")
        .description("Press the button right inside the widget to send a notification to your partner.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular])
    }
}

@available(iOS 17.0, *)
@main
struct NotifyeWidgetBundle: WidgetBundle {
    var body: some Widget {
        NotifyeQuickButtonWidget()
    }
}

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        let r, g, b: UInt64
        if cleaned.count == 6 {
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        } else {
            (r, g, b) = (245, 158, 11)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255.0,
            green: Double(g) / 255.0,
            blue: Double(b) / 255.0,
            opacity: 1.0
        )
    }
}
