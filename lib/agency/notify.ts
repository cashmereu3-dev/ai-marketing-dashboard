// lib/agency/notify.ts
// Phone notifications when a draft needs approval (SERVER-ONLY).
//   1. ntfy push (MAIN): the free ntfy app, subscribed to NTFY_TOPIC. Most reliable on Android.
//   2. Web Push to every device that turned notifications on in the browser/PWA.
// Never throws: a failed notification must not lose the queued draft.
import webpush from 'web-push';
import { getServiceClient } from './serverSupabase';

export interface ApprovalNotice {
  brand: string;
  platform: string;
  title: string;
}

let vapidReady: boolean | null = null;
function initVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:jvnashley@gmail.com';
  if (!pub || !priv) return (vapidReady = false);
  webpush.setVapidDetails(subject, pub, priv);
  return (vapidReady = true);
}

const BRAND_LABEL: Record<string, string> = { visions4u: 'Visions4U', build_catalyst: 'Build Catalyst', silverfoxx2u: 'Silverfoxx2u' };

export async function sendPushToAll(payload: { title: string; body: string; url?: string; tag?: string }): Promise<{ sent: number; failed: number; skipped?: string }> {
  if (!initVapid()) return { sent: 0, failed: 0, skipped: 'VAPID keys are not set.' };
  const db = getServiceClient();
  const { data, error } = await db.from('agency_push_subscriptions').select('endpoint, p256dh, auth');
  if (error) return { sent: 0, failed: 0, skipped: error.message };
  let sent = 0;
  let failed = 0;
  await Promise.all(
    (data ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
        sent++;
      } catch (e) {
        failed++;
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from('agency_push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }),
  );
  return { sent, failed };
}

const NTFY_TAGS: Record<string, string> = { visions4u: 'movie_camera', build_catalyst: 'hammer_and_wrench', silverfoxx2u: 'musical_note' };

export function ntfyInfo(): { configured: boolean; topic?: string; server: string } {
  const server = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '');
  const topic = process.env.NTFY_TOPIC;
  return topic ? { configured: true, topic, server } : { configured: false, server };
}

// MAIN phone channel: the free ntfy app (Android/iOS). Optional NTFY_SERVER (self-hosted) and NTFY_TOKEN (private topic).
export async function sendNtfy(title: string, body: string, opts: { brand?: string; priority?: 'default' | 'high' } = {}): Promise<{ sent: boolean; skipped?: string }> {
  const info = ntfyInfo();
  if (!info.configured || !info.topic) return { sent: false, skipped: 'NTFY_TOPIC is not set.' };
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const headers: Record<string, string> = {
    Title: title,
    Tags: (opts.brand && NTFY_TAGS[opts.brand]) || 'inbox_tray',
    Priority: opts.priority === 'high' ? '4' : '3',
  };
  if (base) {
    headers.Click = `${base}/approvals`;
    headers.Actions = `view, Open approvals, ${base}/approvals`;
  }
  if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(`${info.server}/${encodeURIComponent(info.topic)}`, { method: 'POST', headers, body, signal: ctl.signal });
    return res.ok ? { sent: true } : { sent: false, skipped: `ntfy responded ${res.status}` };
  } catch (e) {
    return { sent: false, skipped: e instanceof Error ? e.message : 'ntfy request failed' };
  } finally {
    clearTimeout(t);
  }
}

export async function notifyApproval(n: ApprovalNotice): Promise<void> {
  const title = `Approval needed: ${BRAND_LABEL[n.brand] ?? n.brand} · ${n.platform}`;
  const body = n.title;
  // ntfy first (main channel), browser push as a second channel.
  await Promise.allSettled([sendNtfy(title, body, { brand: n.brand, priority: 'high' }), sendPushToAll({ title, body, url: '/approvals', tag: 'agency-approval' })]);
}
