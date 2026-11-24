import firebaseConfig from '../../firebase-applet-config.json';
import type { PairDoc, StudioThemePrefs, UserProfile } from '../types';

export interface WidgetSyncPayload {
  apiKey: string;
  projectId: string;
  databaseId: string;
  refreshToken: string;
  uid: string;
  displayName: string;
  pairId: string;
  partnerName: string;
  memberUids: string[];
  buttonLabel: string;
  buttonColorHex: string;
  backgroundColorHex: string;
  normalMessage: string;
  priorityMessage: string;
  defaultUrgent: boolean;
  updatedAtMs: number;
}

interface CapacitorPluginBridge {
  syncWidgetState?: (payload: WidgetSyncPayload) => Promise<void>;
  clearWidgetState?: () => Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: {
    NotifyeWidgetBridge?: CapacitorPluginBridge;
  };
}

function getWidgetBridge(): CapacitorPluginBridge | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.Plugins?.NotifyeWidgetBridge ?? null;
}

export function isNativeCapacitorApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export async function syncNativeWidgetState(params: {
  refreshToken: string;
  profile: UserProfile;
  pair: PairDoc | null;
  themePrefs: StudioThemePrefs;
}): Promise<void> {
  const { refreshToken, profile, pair, themePrefs } = params;
  const isActive = Boolean(pair && pair.status === 'active');
  const partnerName = isActive && pair
    ? (pair.partnerAUid === profile.uid ? pair.partnerBName : pair.partnerAName) || 'Partner'
    : 'Partner';

  const payload: WidgetSyncPayload = {
    apiKey: firebaseConfig.apiKey,
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    refreshToken,
    uid: profile.uid,
    displayName: profile.displayName,
    pairId: isActive && pair ? pair.pairId : '',
    partnerName,
    memberUids: isActive && pair ? pair.memberUids : [],
    buttonLabel: themePrefs.buttonLabel || 'Think of me',
    buttonColorHex: themePrefs.buttonColor || '#F59E0B',
    backgroundColorHex: themePrefs.backgroundColor || '#0B0B0F',
    normalMessage:
      themePrefs.normalNotifMessage.trim() || 'Your partner wants your attention',
    priorityMessage:
      themePrefs.priorityNotifMessage.trim() || 'Your partner really needs your attention',
    defaultUrgent: themePrefs.widgetDefaultKind === 'urgent_attention',
    updatedAtMs: Date.now(),
  };

  try {
    localStorage.setItem(
      'notifye_widget_preview_meta',
      JSON.stringify({
        partnerName: payload.partnerName,
        buttonLabel: payload.buttonLabel,
        paired: Boolean(payload.pairId),
        updatedAtMs: payload.updatedAtMs,
      })
    );
  } catch {
    // ignore storage errors
  }

  const bridge = getWidgetBridge();
  if (bridge?.syncWidgetState) {
    try {
      await bridge.syncWidgetState(payload);
    } catch {
      // Ignore bridge errors on unsupported environments
    }
  }
}

export async function clearNativeWidgetState(): Promise<void> {
  try {
    localStorage.removeItem('notifye_widget_preview_meta');
  } catch {
    // ignore
  }
  const bridge = getWidgetBridge();
  if (bridge?.clearWidgetState) {
    try {
      await bridge.clearWidgetState();
    } catch {
      // ignore
    }
  }
}
