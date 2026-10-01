// app/api/agency/push/route.ts
// Register this phone/browser for approval notifications, or send a test notification.
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/agency/auth';
import { getServiceClient } from '@/lib/agency/serverSupabase';
import { sendPushToAll, sendNtfy, sendSms, sendWhatsApp, ntfyInfo } from '@/lib/agency/notify';

export const runtime = 'nodejs';

const MISSING = /does not exist|schema cache|PGRST205|42P01/i;

// Tells the phone page how to subscribe to the main (ntfy) alerts.
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const info = ntfyInfo();
  return NextResponse.json({ ntfy: info.configured ? { configured: true, topic: info.topic, server: info.server } : { configured: false } });
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { action?: unknown; subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (body.action === 'test') {
    const [w, m, n, r] = await Promise.all([
      sendWhatsApp('The Agency: WhatsApp alerts are working. Approvals will arrive here.'),
      sendSms('The Agency: text alerts are working. Approvals will arrive here.'),
      sendNtfy('The Agency', 'Notifications are working. Approvals will show up here.'),
      sendPushToAll({ title: 'The Agency', body: 'Notifications are working. Approvals will show up here.', url: '/approvals', tag: 'agency-test' }),
    ]);
    if (!w.sent && !m.sent && !n.sent && r.skipped) return NextResponse.json({ error: `Could not send. WhatsApp: ${w.skipped}. SMS: ${m.skipped}. ntfy: ${n.skipped}. Browser push: ${r.skipped}` }, { status: 503 });
    return NextResponse.json({ whatsapp: w.sent, whatsappNote: w.skipped, sms: m.sent, smsNote: m.skipped, ntfy: n.sent, sent: r.sent, failed: r.failed });
  }

  const sub = body.subscription;
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
  const authKey = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : '';
  if (!endpoint.startsWith('https://') || !p256dh || !authKey) return NextResponse.json({ error: 'A valid push subscription is required.' }, { status: 400 });

  const { error } = await getServiceClient()
    .from('agency_push_subscriptions')
    .upsert([{ endpoint, p256dh, auth: authKey, user_email: auth.email }], { onConflict: 'endpoint' });
  if (error) {
    if (MISSING.test(`${error.code ?? ''} ${error.message}`)) {
      return NextResponse.json({ error: 'The notifications table is not set up yet. Run supabase/migrations/agency_approval_queue.sql in the Supabase SQL editor.' }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
