// lib/agency/notify.ts
// Phone notifications when a draft needs approval (SERVER-ONLY).
//   1. Web Push to every device that turned notifications on (PWA on the home screen).
//   2. ntfy.sh push, if NTFY_TOPIC is set (works with the free ntfy app, no setup on the phone beyond the topic).
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

async function sendNtfy(title: string, body: string): Promise<void> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const headers: Record<string, string> = { Title: title, Tags: 'inbox_tray', Priority: 'default' };
  if (base) headers.Click = `${base}/approvals`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: 'POST', headers, body, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function notifyApproval(n: ApprovalNotice): Promise<void> {
  const title = `Approval needed: ${BRAND_LABEL[n.brand] ?? n.brand} · ${n.platform}`;
  const body = n.title;
  await Promise.allSettled([sendPushToAll({ title, body, url: '/approvals', tag: 'agency-approval' }), sendNtfy(title, body)]);
}
