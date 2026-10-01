import { NextResponse } from 'next/server';
import { checkState, exchangeCode } from '@/lib/agency/linkedin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const base = (process.env.NEXT_PUBLIC_APP_URL || u.origin).replace(/\/+$/, '');
  const go = (q: string) => NextResponse.redirect(`${base}/quotes?${q}`);
  if (!checkState(u.searchParams.get('state'))) return go('linkedin=error&why=' + encodeURIComponent('Expired or invalid connection attempt. Try again.'));
  const err = u.searchParams.get('error_description');
  if (err) return go('linkedin=error&why=' + encodeURIComponent(err.slice(0, 200)));
  const code = u.searchParams.get('code');
  if (!code) return go('linkedin=error&why=' + encodeURIComponent('LinkedIn did not return a code.'));
  const r = await exchangeCode(code);
  return r.ok ? go('linkedin=connected') : go('linkedin=error&why=' + encodeURIComponent((r.error || 'Connection failed').slice(0, 300)));
}
