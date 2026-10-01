import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/agency/auth';
import { diagnose, connectWithToken, authorizeUrl, saveLinkedIn } from '@/lib/agency/linkedin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await diagnose());
}

// POST { action: 'token', token } | { action: 'oauth' } | { action: 'disconnect' }
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = (await req.json().catch(() => ({}))) as { action?: string; token?: unknown };
  if (b.action === 'token') {
    const r = await connectWithToken(b.token);
    return NextResponse.json({ ...r, ...(await diagnose()) }, { status: r.ok ? 200 : 400 });
  }
  if (b.action === 'oauth') {
    const url = authorizeUrl();
    return url ? NextResponse.json({ url }) : NextResponse.json({ error: 'LinkedIn app credentials (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET) are not set on the server, so the one-click connect is unavailable. Paste a token instead.' }, { status: 400 });
  }
  if (b.action === 'disconnect') { await saveLinkedIn({}); return NextResponse.json(await diagnose()); }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
