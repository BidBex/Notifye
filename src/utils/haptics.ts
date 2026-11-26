import { Capacitor } from '@capacitor/core';

export type HapticPattern =
  | 'press'
  | 'tap'
  | 'holdTick'
  | 'urgentSend'
  | 'receive'
  | 'receiveUrgent';

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  press: 12,
  tap: [20, 32, 14],
  holdTick: 10,
  urgentSend: [45, 50, 65, 50, 95],
  receive: [70, 50, 110],
  receiveUrgent: [90, 45, 90, 45, 160],
};

function scalePattern(raw: number | number[], intensityPercent: number): number | number[] {
  const scale = Math.max(0, Math.min(200, intensityPercent)) / 100;
  if (typeof raw === 'number') {
    return Math.max(8, Math.round(raw * scale));
  }
  return raw.map((ms, idx) =>
    idx % 2 === 0
      ? Math.max(10, Math.round(ms * scale))
      : Math.max(20, Math.round(ms * (0.7 + 0.3 * scale)))
  );
}

export function getHapticIntensityLabel(intensityPercent: number): string {
  if (intensityPercent <= 0) return 'Off';
  if (intensityPercent <= 60) return 'Gentle';
  if (intensityPercent <= 120) return 'Standard';
  if (intensityPercent <= 160) return 'Strong';
  return 'Intense';
}

// iPhone's WebView has no Vibration API, so on iOS the native Taptic Engine is used instead.
const IS_IOS_NATIVE = Capacitor.getPlatform() === 'ios';
let iosHaptics: typeof import('@capacitor/haptics') | null = null;
if (IS_IOS_NATIVE) {
  void import('@capacitor/haptics').then((m) => {
    iosHaptics = m;
  });
}

function iosHaptic(pattern: HapticPattern, intensityPercent: number): boolean {
  const m = iosHaptics;
  if (!m) return false;
  const { Haptics, ImpactStyle, NotificationType } = m;
  const strong = intensityPercent > 130;
  const gentle = intensityPercent <= 60;
  switch (pattern) {
    case 'press':
      void Haptics.impact({ style: ImpactStyle.Light });
      break;
    case 'holdTick':
      void Haptics.selectionChanged();
      break;
    case 'tap':
      void Haptics.impact({ style: gentle ? ImpactStyle.Light : strong ? ImpactStyle.Heavy : ImpactStyle.Medium });
      break;
    case 'urgentSend':
      void Haptics.notification({ type: NotificationType.Warning });
      break;
    case 'receive':
      // A real buzz for an incoming tap (plus a crisp success tap on gentle settings)
      if (gentle) void Haptics.notification({ type: NotificationType.Success });
      else void Haptics.vibrate({ duration: strong ? 600 : 400 });
      break;
    case 'receiveUrgent':
      void Haptics.vibrate({ duration: 600 });
      window.setTimeout(() => void Haptics.notification({ type: NotificationType.Warning }), 650);
      break;
  }
  return true;
}

export function triggerHaptic(pattern: HapticPattern, intensityPercent = 100): boolean {
  try {
    if (intensityPercent <= 0) return false;
    if (IS_IOS_NATIVE) return iosHaptic(pattern, intensityPercent);
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return false;
    }
    const scaled = scalePattern(HAPTIC_PATTERNS[pattern], intensityPercent);
    return navigator.vibrate(scaled);
  } catch {
    return false;
  }
}

export function cancelHaptic(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(0);
    }
  } catch {
    // Ignore Vibration API restrictions
  }
}
