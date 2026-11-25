import { Capacitor } from '@capacitor/core';

export type WidgetLinkAction = 'send' | 'priority';

/**
 * notifye://send             -> normal notification
 * notifye://send?kind=priority -> priority notification
 * Opened by the iOS widget when it has no shared state (see NotifyeLinks in NotifyeWidget.swift).
 */
export function parseNotifyeLink(url: string): WidgetLinkAction | null {
  const match = /^notifye:\/\/send\b(.*)$/i.exec(url.trim());
  if (!match) return null;
  return /[?&]kind=priority\b/i.test(match[1]) ? 'priority' : 'send';
}

/** Calls `onAction` for the link that launched the app and for links opened while it runs. */
export function subscribeToWidgetLinks(onAction: (action: WidgetLinkAction) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  let cancelled = false;
  let removeListener: (() => void) | null = null;

  void import('@capacitor/app').then(async ({ App }) => {
    if (cancelled) return;
    const handle = await App.addListener('appUrlOpen', ({ url }) => {
      const action = parseNotifyeLink(url);
      if (action) onAction(action);
    });
    removeListener = () => void handle.remove();
    if (cancelled) {
      removeListener();
      return;
    }
    const launch = await App.getLaunchUrl();
    const action = launch?.url ? parseNotifyeLink(launch.url) : null;
    if (action && !cancelled) onAction(action);
  });

  return () => {
    cancelled = true;
    removeListener?.();
  };
}
