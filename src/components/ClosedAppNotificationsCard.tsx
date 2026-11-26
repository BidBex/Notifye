import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BellRing, Check, Copy, ExternalLink, Send } from 'lucide-react';
import {
  NTFY_APP_STORE_URL,
  NTFY_PLAY_STORE_URL,
  getReceiveTopic,
  ntfySubscribeLink,
  sendTestPush,
} from '../utils/closedAppPush';

interface ClosedAppNotificationsCardProps {
  enabled: boolean;
  onSetEnabled: (enabled: boolean) => void;
  partnerHasIt: boolean;
  partnerName: string;
  accentColor: string;
}

/** Setup for notifications while Notifye is closed, relayed through the free ntfy app. */
export const ClosedAppNotificationsCard: React.FC<ClosedAppNotificationsCardProps> = ({
  enabled,
  onSetEnabled,
  partnerHasIt,
  partnerName,
  accentColor,
}) => {
  const [topic] = useState(getReceiveTopic);
  const [copied, setCopied] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'sent' | 'failed'>('idle');
  const isAndroid = Capacitor.getPlatform() === 'android';
  const storeUrl = isAndroid ? NTFY_PLAY_STORE_URL : NTFY_APP_STORE_URL;

  const copyTopic = async () => {
    try {
      await navigator.clipboard.writeText(topic);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable; the topic is shown on screen to copy manually
    }
  };

  const test = async () => {
    setTestState((await sendTestPush(topic)) ? 'sent' : 'failed');
    window.setTimeout(() => setTestState('idle'), 3000);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
      <div className="flex items-start gap-3">
        <BellRing className="w-5 h-5 shrink-0 mt-0.5" style={{ color: accentColor }} />
        <div className="space-y-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100">Notifications when the app is closed</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Free, no account. Uses the <span className="text-zinc-200 font-medium">ntfy</span> app to deliver
            your partner&apos;s taps even when Notifye isn&apos;t open.
          </p>
        </div>
      </div>

      <ol className="space-y-2.5 text-xs text-zinc-300">
        <li className="flex items-center justify-between gap-3">
          <span>1. Install the free ntfy app</span>
          <a
            href={storeUrl}
            target="_blank"
            rel="noreferrer"
            className="min-h-[36px] px-3 rounded-lg bg-white/[0.08] border border-white/10 text-zinc-100 font-medium flex items-center gap-1.5 shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Get ntfy
          </a>
        </li>
        <li className="space-y-1.5">
          <span>
            2. {isAndroid ? 'Subscribe to your private topic' : 'In ntfy tap +, paste this topic and tap Subscribe'}
          </span>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 font-mono text-[12px] text-zinc-200 select-all">
              {topic}
            </code>
            {isAndroid ? (
              <a
                href={ntfySubscribeLink(topic)}
                className="min-h-[36px] px-3 rounded-lg text-[#0B0B0F] font-semibold flex items-center shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                Subscribe
              </a>
            ) : (
              <button
                type="button"
                onClick={() => void copyTopic()}
                className="min-h-[36px] px-3 rounded-lg text-[#0B0B0F] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                style={{ backgroundColor: accentColor }}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span>3. Check it works</span>
          <button
            type="button"
            onClick={() => void test()}
            className="min-h-[36px] px-3 rounded-lg bg-white/[0.08] border border-white/10 text-zinc-100 font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {testState === 'sent' ? 'Sent' : testState === 'failed' ? 'Failed, retry' : 'Send test'}
          </button>
        </li>
      </ol>

      <label className="flex items-center justify-between gap-3 pt-2 border-t border-white/10 cursor-pointer">
        <span className="text-sm text-zinc-100">Get {partnerName}&apos;s taps through ntfy</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onSetEnabled(e.target.checked)}
          className="w-5 h-5 accent-amber-500 cursor-pointer"
        />
      </label>
      <p className="text-[12px] text-zinc-500 leading-relaxed">
        {partnerHasIt
          ? `${partnerName} has it on too, so your taps reach them when their app is closed.`
          : `${partnerName} hasn't turned this on yet, so your taps only reach them while Notifye is open.`}{' '}
        Messages pass through the public ntfy.sh server; the long topic keeps them private.
      </p>
    </section>
  );
};
