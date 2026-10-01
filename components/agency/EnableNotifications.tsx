'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Bell, BellRing } from 'lucide-react';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type State = 'checking' | 'unsupported' | 'off' | 'on' | 'denied';

export default function EnableNotifications() {
  const [state, setState] = useState<State>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ntfy, setNtfy] = useState<{ configured: boolean; topic?: string; server?: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/agency/push', { headers: await authHeaders() });
      if (res.ok) setNtfy(((await res.json()) as { ntfy: { configured: boolean; topic?: string; server?: string } }).ntfy);
    })().catch(() => undefined);
  }, []);

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState('unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && Notification.permission === 'granted' ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error('Notifications are not configured on the server yet (missing VAPID key).');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'off');
        throw new Error('Notifications were not allowed.');
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      const res = await fetch('/api/agency/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || 'Could not save this device.');
      setState('on');
      setMessage('Notifications are on for this device.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not turn notifications on.');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/agency/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ action: 'test' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || 'Test failed.');
      const b = body as { sent: number; ntfy?: boolean };
      setMessage(`Test sent${b.ntfy ? ' to the ntfy app' : ''}${b.sent ? ` and ${b.sent} browser device(s)` : ''}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Test failed.');
    } finally {
      setBusy(false);
    }
  };

  const ntfyCard = ntfy && (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-2">
      <p className="text-sm font-bold text-white flex items-center gap-2"><BellRing className="w-4 h-4 text-red-500" /> Main phone alerts (ntfy app)</p>
      {ntfy.configured ? (
        <>
          <ol className="text-sm text-zinc-300 list-decimal pl-5 space-y-1">
            <li>Install the free <b>ntfy</b> app (Google Play or App Store).</li>
            <li>Tap <b>+</b>, then enter this topic{ntfy.server && ntfy.server !== 'https://ntfy.sh' ? ` on server ${ntfy.server}` : ''}:</li>
          </ol>
          <code className="block break-all rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-emerald-300 select-all">{ntfy.topic}</code>
          <div className="flex items-center gap-2">
            <a href={`${ntfy.server ?? 'https://ntfy.sh'}/${ntfy.topic}`} className="text-xs text-zinc-400 underline">Open topic page</a>
            <button onClick={sendTest} disabled={busy} className="ml-auto px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold disabled:opacity-50 cursor-pointer">Send test</button>
          </div>
        </>
      ) : (
        <p className="text-sm text-amber-300">Not set up yet: add NTFY_TOPIC in Vercel (run scripts/finish-setup.sh) and redeploy.</p>
      )}
      {message && <p className="text-xs text-zinc-400">{message}</p>}
    </div>
  );

  if (state === 'checking') return ntfyCard || null;

  return (
    <div className="space-y-3">
      {ntfyCard}
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
      {state === 'unsupported' && (
        <p className="text-sm text-zinc-400">
          This browser can&apos;t do push notifications. On iPhone, tap Share, then Add to Home Screen, and open The Agency from the home screen icon.
        </p>
      )}
      {state === 'denied' && <p className="text-sm text-amber-300">Notifications are blocked for this site. Allow them in your phone&apos;s settings, then reload.</p>}
      {state === 'off' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-300">Get a notification when a draft needs your approval.</p>
          <button onClick={enable} disabled={busy} className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
            <Bell className="w-4 h-4" /> Turn on
          </button>
        </div>
      )}
      {state === 'on' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-emerald-400 flex items-center gap-2">
            <BellRing className="w-4 h-4" /> Notifications are on for this device.
          </p>
          <button onClick={sendTest} disabled={busy} className="shrink-0 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold disabled:opacity-50 cursor-pointer">
            Send test
          </button>
        </div>
      )}
      {!ntfy?.configured && message && <p className="text-xs text-zinc-400">{message}</p>}
    </div>
    </div>
  );
}
