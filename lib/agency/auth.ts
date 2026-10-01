// lib/agency/auth.ts
// Verifies the caller's Supabase session (Bearer token) and an owner allowlist.
import { createClient } from '@supabase/supabase-js';

export type AuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; status: 401 | 403 | 500; error: string };

function allowedEmails(): string[] {
  return (process.env.AGENCY_ALLOWED_EMAILS || process.env.TUBEOS_ALLOWED_EMAILS || 'jvnashley@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireUser(req: Request): Promise<AuthResult> {
  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, error: 'Sign in required.' };

  const clean = (v?: string) => (v ?? '').replace(/[^\x21-\x7E]/g, '');
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anon) return { ok: false, status: 500, error: 'Auth is not configured on the server.' };

  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    console.error('[auth] getUser failed:', error?.status, error?.name, error?.message);
    return { ok: false, status: 401, error: `Session expired. Please sign in again.${error ? ` (${error.status ?? ''} ${error.message})` : ''}` };
  }

  const email = data.user.email?.toLowerCase();
  if (!email || !data.user.email_confirmed_at) {
    return { ok: false, status: 403, error: 'Confirm your email address to use the agents.' };
  }
  if (!allowedEmails().includes(email)) {
    return { ok: false, status: 403, error: 'This account is not allowed to run agents.' };
  }
  return { ok: true, userId: data.user.id, email };
}
