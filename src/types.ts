import type { Timestamp } from 'firebase/firestore';

export type AspectRatioOption =
  | '1:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '9:16'
  | '16:9'
  | '21:9';

export type ButtonShape = 'orb' | 'squircle' | 'bloom';
export type TouchAnimationStyle = 'ripples' | 'heartbeat' | 'spark' | 'squish';
export type AutoDeleteDuration = 5 | 10 | 15;
export type AmbientNightMode = 'auto' | 'always' | 'off';
export type ButtonSizeOption = 'sm' | 'md' | 'lg';
export type SectionOrderOption = 'button_first' | 'activity_first';
export type VerticalPlacementOption = 'top' | 'center' | 'bottom';
export type ActivityScaleOption = 'compact' | 'standard' | 'expanded';
export type WidgetDefaultKind = 'attention' | 'urgent_attention';

export interface StudioThemePrefs {
  buttonLabel: string;
  buttonSubLabel: string;
  buttonShape: ButtonShape;
  touchAnimation: TouchAnimationStyle;
  buttonColor: string;
  backgroundColor: string;
  autoDeleteSeconds: AutoDeleteDuration;
  ambientNightMode: AmbientNightMode;
  showHeader: boolean;
  showHeading: boolean;
  showRecentPings: boolean;
  showNotificationsTab: boolean;
  showFloatingAlerts: boolean;
  sectionOrder: SectionOrderOption;
  buttonPlacement: VerticalPlacementOption;
  buttonSize: ButtonSizeOption;
  activityScale: ActivityScaleOption;
  normalNotifMessage: string;
  normalNotifTag: string;
  normalNotifColor: string;
  normalNotifPulse: boolean;
  priorityNotifMessage: string;
  priorityNotifTag: string;
  priorityNotifColor: string;
  priorityNotifPulse: boolean;
  incomingHapticIntensity: number;
  widgetDefaultKind: WidgetDefaultKind;
  widgetShowPriorityButton: boolean;
  widgetShowPartnerName: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  pairId: string;
  partnerUid: string;
  partnerName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  soundEnabled: boolean;
  fcmToken: string;
  updatedAt?: Timestamp;
}

export interface PairingCodeDoc {
  code: string;
  creatorUid: string;
  creatorName: string;
  creatorPhoto: string;
  pairId: string;
  status: 'pending' | 'claimed' | 'cancelled';
  claimedByUid: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PairDoc {
  pairId: string;
  partnerAUid: string;
  partnerAName: string;
  partnerAPhoto: string;
  partnerBUid: string;
  partnerBName: string;
  partnerBPhoto: string;
  memberUids: string[];
  status: 'waiting' | 'active' | 'unpaired';
  lastPingAt?: Timestamp;
  lastPingByUid: string;
  lastPingMessage: string;
  pingCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PingDoc {
  pingId: string;
  pairId: string;
  memberUids: string[];
  senderUid: string;
  senderName: string;
  message: string;
  kind: 'attention' | 'urgent_attention' | 'moment_card' | 'thoughtful_note';
  momentCardUrl: string;
  aspectRatio: '' | AspectRatioOption;
  createdAt?: Timestamp;
  clientCreatedMs?: number;
}

export interface PairDeviceDoc {
  uid: string;
  pairId: string;
  memberUids: string[];
  fcmToken: string;
  platform: 'web' | 'ios-pwa' | 'android-pwa';
  updatedAt?: Timestamp;
}
