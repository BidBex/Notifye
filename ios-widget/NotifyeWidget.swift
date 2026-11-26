import AppIntents
import Foundation
import SwiftUI
import UIKit
import WidgetKit

// Storage keys and App Group lookup live in NotifyeShared.swift (compiled into both targets).

// MARK: - Timeline

struct NotifyeTimelineEntry: TimelineEntry {
    let date: Date
    let state: NotifyeWidgetState
    let isPaired: Bool
    /// "Sent to Ana", "Couldn't send…" (only for a few seconds after a tap)
    let lastStatus: String
    let showStatus: Bool
    let statusIsError: Bool
    /// Last tap delivered from the widget (shown as "Last sent 14:05")
    let lastSentAt: Date?
    let lastSentUrgent: Bool

    /// The button is in its "just sent" state (checkmark, glow ring).
    var justSent: Bool { showStatus && !statusIsError }
}

// Short, so the button is back to normal quickly for the next tap.
private let kStatusVisibleSeconds: TimeInterval = 3

struct NotifyeProvider: TimelineProvider {
    func placeholder(in context: Context) -> NotifyeTimelineEntry {
        NotifyeTimelineEntry(
            date: Date(), state: .placeholder, isPaired: true,
            lastStatus: "", showStatus: false, statusIsError: false,
            lastSentAt: nil, lastSentUrgent: false
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (NotifyeTimelineEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : loadEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NotifyeTimelineEntry>) -> Void) {
        let now = Date()
        let entry = loadEntry(at: now)
        var entries = [entry]
        if entry.showStatus {
            // Back to the normal button a few seconds after the tap.
            let lastMs = NotifyeShared.defaults?.double(forKey: NotifyeShared.lastSentKey) ?? 0
            let clearAt = Date(timeIntervalSince1970: lastMs / 1000.0 + kStatusVisibleSeconds)
            if clearAt > now {
                entries.append(
                    NotifyeTimelineEntry(
                        date: clearAt, state: entry.state, isPaired: entry.isPaired,
                        lastStatus: "", showStatus: false, statusIsError: false,
                        lastSentAt: entry.lastSentAt, lastSentUrgent: entry.lastSentUrgent
                    )
                )
            }
        }
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: now) ?? now
        completion(Timeline(entries: entries, policy: .after(nextRefresh)))
    }

    private func loadEntry(at date: Date) -> NotifyeTimelineEntry {
        let defaults = NotifyeShared.defaults
        let state = NotifyeWidgetState.load() ?? .placeholder
        let lastMs = defaults?.double(forKey: NotifyeShared.lastSentKey) ?? 0
        let showStatus = (date.timeIntervalSince1970 * 1000.0 - lastMs) < kStatusVisibleSeconds * 1000
        let status = showStatus ? (defaults?.string(forKey: NotifyeShared.lastStatusKey) ?? "") : ""
        let isError = status.hasPrefix("Couldn't") || status.hasPrefix("Open")
        let successMs = defaults?.double(forKey: NotifyeShared.lastSuccessKey) ?? 0
        return NotifyeTimelineEntry(
            date: date, state: state, isPaired: state.isPaired,
            lastStatus: status, showStatus: showStatus && !status.isEmpty, statusIsError: isError,
            lastSentAt: successMs > 0 ? Date(timeIntervalSince1970: successMs / 1000.0) : nil,
            lastSentUrgent: defaults?.bool(forKey: NotifyeShared.lastSuccessUrgentKey) ?? false
        )
    }
}

// MARK: - Look (mirrors ThinkOfMeButton in the app)

@available(iOS 17.0, *)
private struct Palette {
    let accent: Color
    let buttonTop: Color
    let buttonBottom: Color
    let bg: Color
    let bgTop: Color
    let ink: Color
    let shape: String // orb | squircle | bloom
    let priority = Color(hex: "#FB7185")

    init(state: NotifyeWidgetState) {
        accent = Color(hex: state.buttonColorHex)
        buttonTop = state.buttonTopHex.map { Color(hex: $0) } ?? accent.blend(with: .white, by: 0.1)
        buttonBottom = state.buttonBottomHex.map { Color(hex: $0) } ?? accent.blend(with: .black, by: 0.06)
        bg = Color(hex: state.backgroundColorHex)
        bgTop = Color(hex: state.backgroundColorHex).blend(with: .white, by: 0.07)
        if let inkHex = state.buttonInkHex {
            ink = Color(hex: inkHex)
        } else {
            ink = accent.isLight ? Color(hex: "#0B0B0F") : .white
        }
        shape = state.buttonShape ?? "orb"
    }

    var background: some View {
        ZStack {
            LinearGradient(colors: [bgTop, bg], startPoint: .top, endPoint: .bottom)
            // soft aura behind the button, like the app's ambient glow
            RadialGradient(colors: [accent.opacity(0.22), .clear], center: .center, startRadius: 4, endRadius: 110)
        }
    }

    /// Same vertical gradient as the in-app button: top tint → colour at 60% → bottom tint.
    var buttonFill: LinearGradient {
        LinearGradient(
            stops: [
                .init(color: buttonTop, location: 0),
                .init(color: accent, location: 0.6),
                .init(color: buttonBottom, location: 1),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    func buttonShape(size: CGFloat) -> AnyShape {
        shape == "squircle"
            ? AnyShape(RoundedRectangle(cornerRadius: size * 0.3, style: .continuous))
            : AnyShape(Circle())
    }
}

/// The coloured button surface, drawn as a picture. With iOS's tinted / clear Home Screen styles
/// every shape and colour in a widget is repainted in one tint (the button turned white); only
/// pictures can opt out and keep their real colours (widgetAccentedRenderingMode(.fullColor)).
@available(iOS 17.0, *)
private enum ButtonArt {
    static func image(palette: Palette, size: CGFloat) -> UIImage {
        let rect = CGRect(x: 0, y: 0, width: size, height: size)
        let renderer = UIGraphicsImageRenderer(size: rect.size, format: {
            let f = UIGraphicsImageRendererFormat.default()
            f.scale = 3
            f.opaque = false
            return f
        }())
        let img = renderer.image { ctx in
            let cg = ctx.cgContext
            let path = palette.shape == "squircle"
                ? UIBezierPath(roundedRect: rect, cornerRadius: size * 0.3)
                : UIBezierPath(ovalIn: rect)
            path.addClip()
            let space = CGColorSpaceCreateDeviceRGB()
            let colors = [UIColor(palette.buttonTop).cgColor, UIColor(palette.accent).cgColor, UIColor(palette.buttonBottom).cgColor] as CFArray
            if let g = CGGradient(colorsSpace: space, colors: colors, locations: [0, 0.6, 1]) {
                cg.drawLinearGradient(g, start: CGPoint(x: 0, y: 0), end: CGPoint(x: 0, y: size), options: [])
            }
            // soft top-left highlight, like the app's spotlight
            let hl = [UIColor.white.withAlphaComponent(0.28).cgColor, UIColor.white.withAlphaComponent(0).cgColor] as CFArray
            if let g = CGGradient(colorsSpace: space, colors: hl, locations: [0, 1]) {
                let c = CGPoint(x: size * 0.35, y: size * 0.25)
                cg.drawRadialGradient(g, startCenter: c, startRadius: 1, endCenter: c, endRadius: size * 0.6, options: [])
            }
        }
        return img
    }
}

/// Visible press feedback: the button sinks and darkens while the finger is on it.
@available(iOS 17.0, *)
private struct PressFeedbackStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.9 : 1)
            .brightness(configuration.isPressed ? -0.08 : 0)
            .animation(.spring(response: 0.22, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

/// The app's "Think of me" button, drawn natively. Shows three states:
/// normal (label + sub-label), while sending (iOS dims it until the tap is delivered),
/// and sent (checkmark + glowing ring for a few seconds).
@available(iOS 17.0, *)
private struct AppButtonFace: View {
    let entry: NotifyeTimelineEntry
    let palette: Palette
    let size: CGFloat
    var compact = false

    @ViewBuilder private var buttonSurface: some View {
        let img = Image(uiImage: ButtonArt.image(palette: palette, size: size)).resizable()
        if #available(iOSApplicationExtension 18.0, *) {
            img.widgetAccentedRenderingMode(.fullColor)
        } else {
            img
        }
    }

    var body: some View {
        let shape = palette.buttonShape(size: size)
        let sent = entry.justSent
        let ringColor = entry.lastSentUrgent && sent ? palette.priority : palette.accent
        ZStack {
            // "sent" ring, like the ripple burst in the app
            shape
                .stroke(ringColor.opacity(sent ? 0.85 : 0), lineWidth: 3)
                .frame(width: size + 12, height: size + 12)
            if palette.shape == "bloom" {
                Circle().stroke(palette.accent.opacity(0.5), lineWidth: 1).frame(width: size + 10, height: size + 10)
            }
            buttonSurface
                .shadow(color: palette.accent.opacity(0.45), radius: size * 0.16, y: 2)
            shape.stroke(
                LinearGradient(colors: [.white.opacity(0.38), .clear], startPoint: .top, endPoint: .center),
                lineWidth: 1
            )
            if palette.shape == "bloom" {
                Circle().stroke(palette.ink.opacity(0.22), lineWidth: 1).padding(size * 0.06)
            }

            VStack(spacing: compact ? 1 : 3) {
                if sent {
                    Image(systemName: "checkmark")
                        .font(.system(size: size * 0.3, weight: .bold))
                        .transition(.scale.combined(with: .opacity))
                    if !compact {
                        Text(entry.lastSentUrgent ? "Priority sent" : "Sent")
                            .font(.system(size: size * 0.12, weight: .semibold, design: .rounded))
                    }
                } else {
                    Text(entry.state.buttonLabel)
                        .font(.system(size: size * (compact ? 0.17 : 0.16), weight: .semibold, design: .serif))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.6)
                    let sub = entry.state.buttonSubLabel ?? ""
                    if !compact && !sub.isEmpty {
                        Text(sub)
                            .font(.system(size: size * 0.095, weight: .medium, design: .rounded))
                            .opacity(0.85)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                }
            }
            .foregroundStyle(palette.ink)
            .padding(size * 0.14)
            .invalidatableContent() // dimmed by iOS while the tap is being sent
        }
        .frame(width: size, height: size)
        .animation(.spring(response: 0.35, dampingFraction: 0.7), value: sent)
    }
}

@available(iOS 17.0, *)
private struct PartnerAvatar: View {
    let name: String
    let accent: Color
    var size: CGFloat = 26

    var body: some View {
        Text(String(name.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased())
            .font(.system(size: size * 0.46, weight: .bold, design: .rounded))
            .foregroundStyle(accent)
            .frame(width: size, height: size)
            .background(accent.opacity(0.18), in: Circle())
            .overlay(Circle().stroke(accent.opacity(0.35), lineWidth: 1))
    }
}

// MARK: - Views

@available(iOS 17.0, *)
struct NotifyeWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: NotifyeTimelineEntry

    private var palette: Palette { Palette(state: entry.state) }
    private var partner: String { entry.state.partnerName.isEmpty ? "Partner" : entry.state.partnerName }

    var body: some View {
        switch family {
        case .accessoryCircular: circular
        case .accessoryRectangular: rectangular
        case .systemMedium: medium
        default: small
        }
    }

    /// Always sends in place; never opens the app. If the widget can read the pairing it sends
    /// by itself (fast); otherwise iOS runs the send inside the Notifye app in the background.
    @ViewBuilder
    private func sendButton<Content: View>(urgent: Bool, @ViewBuilder _ content: () -> Content) -> some View {
        if entry.isPaired {
            Button(intent: SendNotifyePingIntent(isUrgent: urgent)) { content() }
                .buttonStyle(PressFeedbackStyle())
        } else {
            Button(intent: SendNotifyePingViaAppIntent(isUrgent: urgent)) { content() }
                .buttonStyle(PressFeedbackStyle())
        }
    }

    /// Status under the button: just-sent / error for a few seconds, then "Last sent 14:05".
    @ViewBuilder
    private func statusLine(fallback: String, leading: Bool = false) -> some View {
        Group {
            if entry.showStatus {
                Text(entry.lastStatus)
                    .foregroundStyle(entry.statusIsError ? palette.priority : palette.accent)
                    .fontWeight(.semibold)
            } else if let at = entry.lastSentAt {
                Text("Last sent \(at, style: .time)")
                    .foregroundStyle(.white.opacity(0.6))
            } else {
                Text(fallback)
                    .foregroundStyle(.white.opacity(0.6))
            }
        }
        .font(.system(size: 11, weight: .medium, design: .rounded))
        .lineLimit(1)
        .minimumScaleFactor(0.75)
        .multilineTextAlignment(leading ? .leading : .center)
        .contentTransition(.opacity)
        .invalidatableContent()
    }

    // Home Screen: small — the app's button, front and centre
    private var small: some View {
        VStack(spacing: 4) {
            HStack(spacing: 5) {
                PartnerAvatar(name: partner, accent: palette.accent, size: 18)
                Text(partner)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.9))
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            GeometryReader { geo in
                // Fits every iPhone's small widget (the ring needs ~6 pt on each side)
                let size = max(56, min(92, min(geo.size.width, geo.size.height) - 12))
                sendButton(urgent: entry.state.defaultUrgent) {
                    AppButtonFace(entry: entry, palette: palette, size: size)
                }
                .frame(width: geo.size.width, height: geo.size.height)
            }
            statusLine(fallback: entry.isPaired ? "Tap to notify" : "Open Notifye once")
        }
        .containerBackground(for: .widget) { palette.background }
    }

    // Home Screen: medium — big button + priority
    private var medium: some View {
        HStack(spacing: 14) {
            GeometryReader { geo in
                let size = max(64, min(116, geo.size.height - 12))
                sendButton(urgent: false) {
                    AppButtonFace(entry: entry, palette: palette, size: size)
                }
                .frame(width: geo.size.width, height: geo.size.height)
            }
            .aspectRatio(1, contentMode: .fit)

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    PartnerAvatar(name: partner, accent: palette.accent, size: 28)
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Notifye")
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white.opacity(0.55))
                        Text(partner)
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                    }
                }
                statusLine(fallback: entry.isPaired ? "Tap the button to notify" : "Open Notifye once", leading: true)
                Spacer(minLength: 0)
                sendButton(urgent: true) {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.2").font(.system(size: 13, weight: .bold))
                        Text("Priority").font(.system(size: 13, weight: .semibold, design: .rounded))
                    }
                    .foregroundStyle(Color(hex: "#FDA4AF"))
                    .frame(maxWidth: .infinity, minHeight: 38)
                    .background(palette.priority.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(palette.priority.opacity(0.45), lineWidth: 1))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .containerBackground(for: .widget) { palette.background }
    }

    // Lock Screen: round
    private var circular: some View {
        sendButton(urgent: entry.state.defaultUrgent) {
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: entry.justSent ? "checkmark" : "bell.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .invalidatableContent()
            }
        }
        .widgetAccentable()
        .containerBackground(.clear, for: .widget)
    }

    // Lock Screen: wide
    private var rectangular: some View {
        sendButton(urgent: entry.state.defaultUrgent) {
            HStack(spacing: 8) {
                Image(systemName: entry.justSent ? "checkmark.circle.fill" : "bell.badge.fill")
                    .font(.system(size: 22, weight: .semibold))
                VStack(alignment: .leading, spacing: 1) {
                    Text(entry.state.buttonLabel)
                        .font(.headline)
                        .lineLimit(1)
                    Group {
                        if entry.showStatus {
                            Text(entry.lastStatus)
                        } else if let at = entry.lastSentAt {
                            Text("Last sent \(at, style: .time)")
                        } else {
                            Text("Tap to notify \(partner)")
                        }
                    }
                    .font(.caption2)
                    .lineLimit(1)
                    .opacity(0.8)
                }
                Spacer(minLength: 0)
            }
            .invalidatableContent()
        }
        .widgetAccentable()
        .containerBackground(.clear, for: .widget)
    }
}

@available(iOS 17.0, *)
struct NotifyeQuickButtonWidget: Widget {
    let kind: String = "NotifyeQuickButtonWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NotifyeProvider()) { entry in
            NotifyeWidgetView(entry: entry)
        }
        .configurationDisplayName("Notify Partner")
        .description("Your Notifye button. Tap it to notify your partner without opening the app.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

@available(iOS 17.0, *)
@main
struct NotifyeWidgetBundle: WidgetBundle {
    var body: some Widget {
        NotifyeQuickButtonWidget()
    }
}

// MARK: - Color helpers

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
        self.init(.sRGB, red: Double(r) / 255.0, green: Double(g) / 255.0, blue: Double(b) / 255.0, opacity: 1.0)
    }

    private var rgb: (Double, Double, Double) {
        let ui = UIColor(self)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        ui.getRed(&r, green: &g, blue: &b, alpha: &a)
        return (Double(r), Double(g), Double(b))
    }

    var isLight: Bool {
        let (r, g, b) = rgb
        return (0.299 * r + 0.587 * g + 0.114 * b) > 0.6
    }

    func blend(with other: Color, by amount: Double) -> Color {
        let (r1, g1, b1) = rgb
        let (r2, g2, b2) = other.rgb
        let t = max(0, min(1, amount))
        return Color(.sRGB, red: r1 + (r2 - r1) * t, green: g1 + (g2 - g1) * t, blue: b1 + (b2 - b1) * t, opacity: 1)
    }
}
