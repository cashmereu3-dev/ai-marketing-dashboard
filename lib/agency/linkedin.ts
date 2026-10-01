// lib/agency/linkedin.ts (SERVER-ONLY)
// LinkedIn connection: credentials live in the private Supabase bucket (_system/linkedin.json), never in the browser.
// The author ID is always RESOLVED from the token through LinkedIn's API; nobody types it.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServiceClient } from './serverSupabase';
import { CONTENT_BUCKET, ensureBucket } from './content';
import type { LinkedInCreds } from './publish';

const FILE = '_system/linkedin.json';
export const REQUIRED_SCOPES = 'openid profile w_member_social';
const URN_RE = /^urn:li:(person|organization):[A-Za-z0-9_-]{4,}$/;

export interface StoredLinkedIn { accessToken?: string; authorUrn?: string; name?: string; expiresAt?: string; scope?: string; connectedAt?: string; via?: string }

export async function loadLinkedIn(): Promise<StoredLinkedIn> {
  try {
    await ensureBucket();
    const { data } = await getServiceClient().storage.from(CONTENT_BUCKET).download(FILE);
    return data ? (JSON.parse(await data.text()) as StoredLinkedIn) : {};
  } catch { return {}; }
}
export async function saveLinkedIn(s: StoredLinkedIn): Promise<void> {
  await ensureBucket();
  const { error } = await getServiceClient().storage.from(CONTENT_BUCKET).upload(FILE, JSON.stringify(s), { upsert: true, contentType: 'application/json' });
  if (error) throw new Error(error.message);
}

/** Tokens are one line of URL-safe characters. Rejects shell commands, whitespace, multiline input. */
export function validTokenShape(t: unknown): t is string {
  return typeof t === 'string' && /^[A-Za-z0-9._~+/=-]{20,2000}$/.test(t);
}

interface ApiProbe { endpoint: string; status: number; message: string }
export interface Identity { ok: boolean; urn?: string; name?: string; via?: string; probes: ApiProbe[]; advice?: string }

async function probe(endpoint: string, token: string): Promise<{ status: number; json: Record<string, unknown> }> {
  try {
    const res = await fetch(`https://api.linkedin.com${endpoint}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch (e) {
    return { status: 0, json: { message: e instanceof Error ? e.message : 'network error' } };
  }
}

export function explain(probes: ApiProbe[]): string {
  const s = probes.map((p) => p.status);
  if (s.every((x) => x === 0)) return 'LinkedIn could not be reached from the server (network error).';
  if (s.includes(401)) return 'LinkedIn says the token is invalid, expired or revoked (HTTP 401). Reconnect LinkedIn to get a new token.';
  if (s.includes(403)) return `The token is valid but lacks permission to read the profile (HTTP 403). It needs the scopes: ${REQUIRED_SCOPES}. In the LinkedIn developer app, enable the products "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn", then reconnect.`;
  return `LinkedIn returned an unexpected response (${probes.map((p) => `${p.endpoint} ${p.status}`).join(', ')}).`;
}

/** Resolves the member ID from the token using the current OpenID endpoint, then the legacy one. */
export async function resolveIdentity(token: string): Promise<Identity> {
  const probes: ApiProbe[] = [];
  const u = await probe('/v2/userinfo', token);
  probes.push({ endpoint: '/v2/userinfo', status: u.status, message: String(u.json.message || u.json.error_description || '') });
  if (u.status === 200 && typeof u.json.sub === 'string' && /^[A-Za-z0-9_-]+$/.test(u.json.sub)) return { ok: true, urn: `urn:li:person:${u.json.sub}`, name: typeof u.json.name === 'string' ? u.json.name : undefined, via: 'userinfo', probes };
  const m = await probe('/v2/me', token);
  probes.push({ endpoint: '/v2/me', status: m.status, message: String(m.json.message || '') });
  if (m.status === 200 && typeof m.json.id === 'string' && /^[A-Za-z0-9_-]+$/.test(m.json.id)) return { ok: true, urn: `urn:li:person:${m.json.id}`, via: 'me', probes };
  return { ok: false, probes, advice: explain(probes) };
}

export type Resolved = { ok: true; creds: LinkedInCreds; source: 'stored' | 'env' } | { ok: false; reason: string };

/** Finds working credentials: stored (Supabase) first, then the server env token. Resolves and caches the member ID automatically. */
export async function getCredentials(): Promise<Resolved> {
  const st = await loadLinkedIn();
  if (st.expiresAt && new Date(st.expiresAt).getTime() < Date.now()) return { ok: false, reason: `The stored LinkedIn token expired on ${st.expiresAt.slice(0, 10)}. Reconnect LinkedIn on the Quote Agents page.` };
  const cands: { token: string; urn?: string; source: 'stored' | 'env' }[] = [];
  if (st.accessToken) cands.push({ token: st.accessToken, urn: st.authorUrn, source: 'stored' });
  const envTok = (process.env.LINKEDIN_ACCESS_TOKEN || '').trim();
  const envUrn = (process.env.LINKEDIN_AUTHOR_URN || '').trim();
  if (validTokenShape(envTok)) cands.push({ token: envTok, urn: URN_RE.test(envUrn) ? envUrn : undefined, source: 'env' });
  if (!cands.length) return { ok: false, reason: 'LinkedIn is not connected. Connect it on the Quote Agents page.' };
  let last = '';
  for (const c of cands) {
    if (c.urn) return { ok: true, creds: { token: c.token, urn: c.urn }, source: c.source };
    const id = await resolveIdentity(c.token);
    if (id.ok && id.urn) {
      await saveLinkedIn({ ...st, accessToken: c.token, authorUrn: id.urn, name: id.name ?? st.name, connectedAt: st.connectedAt || new Date().toISOString(), via: `${c.source}+${id.via}` }).catch(() => undefined);
      return { ok: true, creds: { token: c.token, urn: id.urn }, source: c.source };
    }
    last = id.advice || 'Could not resolve the LinkedIn member ID.';
  }
  return { ok: false, reason: last };
}

export async function diagnose() {
  const st = await loadLinkedIn();
  const r = await getCredentials();
  return {
    connected: r.ok, source: r.ok ? r.source : null, member: st.name || null, expiresAt: st.expiresAt || null, scope: st.scope || null,
    problem: r.ok ? null : r.reason, requiredScopes: REQUIRED_SCOPES,
    oauthAvailable: Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET && process.env.NEXT_PUBLIC_APP_URL),
  };
}

/** Validates a pasted token against LinkedIn BEFORE anything is saved. */
export async function connectWithToken(token: unknown): Promise<{ ok: boolean; error?: string; name?: string }> {
  if (!validTokenShape(token)) return { ok: false, error: 'That does not look like a token (one line, no spaces or shell syntax). Nothing was saved.' };
  const id = await resolveIdentity(token);
  if (!id.ok || !id.urn) return { ok: false, error: `${id.advice} Nothing was saved.` };
  await saveLinkedIn({ accessToken: token, authorUrn: id.urn, name: id.name, connectedAt: new Date().toISOString(), via: 'pasted-token' });
  return { ok: true, name: id.name };
}

// ---------- OAuth (normal "Connect with LinkedIn" flow) ----------
const stateKey = () => process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export function makeState(): string {
  const ts = Date.now().toString(36);
  const sig = createHmac('sha256', stateKey()).update(`li|${ts}`).digest('hex').slice(0, 32);
  return `${ts}.${sig}`;
}
export function checkState(state: string | null): boolean {
  if (!state || !stateKey()) return false;
  const [ts, sig] = state.split('.');
  if (!ts || !sig) return false;
  const age = Date.now() - parseInt(ts, 36);
  if (!(age >= 0 && age < 10 * 60_000)) return false;
  const want = createHmac('sha256', stateKey()).update(`li|${ts}`).digest('hex').slice(0, 32);
  return want.length === sig.length && timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}
export const redirectUri = () => `${(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')}/api/agency/linkedin/callback`;

export function authorizeUrl(): string | null {
  const id = process.env.LINKEDIN_CLIENT_ID;
  if (!id || !process.env.LINKEDIN_CLIENT_SECRET || !process.env.NEXT_PUBLIC_APP_URL) return null;
  const q = new URLSearchParams({ response_type: 'code', client_id: id, redirect_uri: redirectUri(), state: makeState(), scope: REQUIRED_SCOPES });
  return `https://www.linkedin.com/oauth/v2/authorization?${q}`;
}

export async function exchangeCode(code: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: process.env.LINKEDIN_CLIENT_ID || '', client_secret: process.env.LINKEDIN_CLIENT_SECRET || '' }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  const d = (await res?.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; scope?: string; error_description?: string } | undefined;
  if (!res || !res.ok || !d?.access_token) return { ok: false, error: d?.error_description || `LinkedIn token exchange failed (${res?.status ?? 'no response'}).` };
  const id = await resolveIdentity(d.access_token);
  if (!id.ok || !id.urn) return { ok: false, error: id.advice };
  await saveLinkedIn({ accessToken: d.access_token, authorUrn: id.urn, name: id.name, scope: d.scope, expiresAt: d.expires_in ? new Date(Date.now() + d.expires_in * 1000).toISOString() : undefined, connectedAt: new Date().toISOString(), via: 'oauth' });
  return { ok: true };
}
