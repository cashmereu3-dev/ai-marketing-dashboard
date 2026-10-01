// app/api/agency/cron/route.ts: planner tick. Runs the 6 AM quote agents and the per-agent schedule.
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { tick } from '@/lib/agency/schedule';
import { runDueQuotes } from '@/lib/agency/quoteAgents';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given), b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [quotes, ran] = await Promise.all([runDueQuotes().catch((e) => ({ error: String(e) })), tick().catch((e) => ({ error: String(e) }))]);
  return NextResponse.json({ quotes, ran });
}
