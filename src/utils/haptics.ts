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

export function triggerHaptic(pattern: HapticPattern, intensityPercent = 100): boolean {
  try {
    if (intensityPercent <= 0) return false;
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
