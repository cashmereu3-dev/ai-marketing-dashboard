// Client-side fetch that attaches the Supabase session, refreshes once on 401,
// and clears a dead session (redirecting to /login) instead of failing silently.
import { supabase } from '../supabase';

async function token(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = async (t: string | null) => {
    const headers = new Headers(init.headers);
    if (t) headers.set('Authorization', `Bearer ${t}`);
    return fetch(input, { ...init, headers });
  };
  let res = await send(await token());
  if (res.status === 401) {
    res = await send(await token(true));
    if (res.status === 401 && typeof window !== 'undefined') {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
    }
  }
  return res;
}
