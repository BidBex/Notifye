import { triggerHaptic } from './haptics';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function playWarmChime(
  variant: 'send' | 'receive' | 'urgentSend' | 'receiveUrgent'
): void {
  try {
    if (variant === 'receive') {
      triggerHaptic('receive');
    } else if (variant === 'receiveUrgent') {
      triggerHaptic('receiveUrgent');
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes =
      variant === 'receiveUrgent'
        ? [523.25, 659.25, 783.99, 1046.5]
        : variant === 'urgentSend'
        ? [440, 587.33, 783.99]
        : variant === 'receive'
        ? [440, 554.37, 659.25]
        : [392, 523.25];

    const isUrgent = variant === 'urgentSend' || variant === 'receiveUrgent';
    const isReceive = variant === 'receive' || variant === 'receiveUrgent';

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * (isUrgent ? 0.075 : 0.085);
      const duration = isUrgent ? 1.05 : isReceive ? 0.85 : 0.45;

      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        isUrgent ? 0.16 : isReceive ? 0.14 : 0.08,
        start + 0.025
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration + 0.02);
    });
  } catch {
    // Audio playback may require prior user gesture in strict browser policies.
  }
}
