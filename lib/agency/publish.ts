// lib/agency/publish.ts
// Publishes a draft Jevon has just APPROVED (SERVER-ONLY). Only called from the approvals PATCH route,
// i.e. only after a human tap. Facebook is the one platform wired up; every other platform stays
// "approved" for manual posting.

export interface QueueItem {
  id: string;
  platform: string;
  title: string;
  content: string;
  media_url: string | null;
  scheduled_for: string | null;
}

export type PublishResult = { published: true; externalId: string; scheduled: boolean } | { published: false; reason: string };

const VIDEO = /\.(mp4|mov|m4v|webm)(\?|$)/i;
const IMAGE = /\.(jpe?g|png|gif|webp)(\?|$)/i;

async function graphPost(path: string, params: Record<string, string>): Promise<{ id?: string; post_id?: string }> {
  const ver = process.env.FACEBOOK_GRAPH_VERSION || 'v23.0';
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN as string;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(`https://graph.facebook.com/${ver}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, access_token: token }),
      signal: ctl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message || `Facebook responded ${res.status}`);
    return data;
  } finally {
    clearTimeout(t);
  }
}

export async function publishApproved(item: QueueItem): Promise<PublishResult> {
  if (item.platform !== 'facebook') return { published: false, reason: `Auto-publishing is only set up for Facebook; post this ${item.platform} item manually.` };
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!pageId || !process.env.FACEBOOK_PAGE_ACCESS_TOKEN) return { published: false, reason: 'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN are not set.' };

  const when = item.scheduled_for ? new Date(item.scheduled_for).getTime() : 0;
  const lead = when - Date.now();
  // Facebook accepts scheduling between 10 minutes and 75 days ahead; otherwise post now.
  const schedule = lead > 11 * 60_000 && lead < 74 * 86_400_000;
  const sched: Record<string, string> = schedule ? { published: 'false', scheduled_publish_time: String(Math.floor(when / 1000)) } : {};

  try {
    let r;
    if (item.media_url && VIDEO.test(item.media_url)) {
      r = await graphPost(`${pageId}/videos`, { file_url: item.media_url, description: item.content, title: item.title.slice(0, 100), ...sched });
    } else if (item.media_url && IMAGE.test(item.media_url)) {
      r = await graphPost(`${pageId}/photos`, { url: item.media_url, caption: item.content, ...sched });
    } else {
      r = await graphPost(`${pageId}/feed`, { message: item.content, ...(item.media_url ? { link: item.media_url } : {}), ...sched });
    }
    const id = r.post_id || r.id;
    if (!id) return { published: false, reason: 'Facebook accepted the request but returned no post id.' };
    return { published: true, externalId: id, scheduled: schedule };
  } catch (e) {
    return { published: false, reason: e instanceof Error ? e.message : 'Facebook publish failed.' };
  }
}

// ---- Autonomous publishers used by the Quote agents (no human tap; the owner turned autonomous mode on) ----

/** Looks at the Page's latest posts to see whether a post with this text already went out (used before any retry). */
export async function facebookHasPost(text: string): Promise<string | null> {
  const pageId = process.env.FACEBOOK_PAGE_ID, token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return null;
  const ver = process.env.FACEBOOK_GRAPH_VERSION || 'v23.0';
  try {
    const res = await fetch(`https://graph.facebook.com/${ver}/${pageId}/posts?fields=id,message&limit=10`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    const d = (await res.json()) as { data?: { id: string; message?: string }[] };
    const key = text.slice(0, 60);
    return d.data?.find((p) => (p.message || '').startsWith(key))?.id ?? null;
  } catch { return null; }
}

export async function facebookEngagement(postId: string): Promise<{ likes: number; comments: number; shares: number } | null> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) return null;
  const ver = process.env.FACEBOOK_GRAPH_VERSION || 'v23.0';
  try {
    const res = await fetch(`https://graph.facebook.com/${ver}/${postId}?fields=likes.summary(true).limit(0),comments.summary(true).limit(0),shares`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const d = (await res.json()) as { likes?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } }; shares?: { count?: number } };
    return { likes: d.likes?.summary?.total_count ?? 0, comments: d.comments?.summary?.total_count ?? 0, shares: d.shares?.count ?? 0 };
  } catch { return null; }
}

export function linkedinConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN);
}

/** Posts text to LinkedIn through the official UGC Posts API. Needs LINKEDIN_ACCESS_TOKEN (w_member_social) and LINKEDIN_AUTHOR_URN. */
export async function publishLinkedIn(text: string): Promise<PublishResult> {
  if (!linkedinConfigured()) return { published: false, reason: 'LinkedIn is not connected (LINKEDIN_ACCESS_TOKEN / LINKEDIN_AUTHOR_URN are not set).' };
  try {
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
      body: JSON.stringify({
        author: process.env.LINKEDIN_AUTHOR_URN,
        lifecycleState: 'PUBLISHED',
        specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text }, shareMediaCategory: 'NONE' } },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
      signal: AbortSignal.timeout(30000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { published: false, reason: body.message || `LinkedIn responded ${res.status}` };
    const id = res.headers.get('x-restli-id') || body.id;
    if (!id) return { published: false, reason: 'LinkedIn accepted the request but returned no post id.' };
    return { published: true, externalId: id, scheduled: false };
  } catch (e) {
    return { published: false, reason: e instanceof Error ? e.message : 'LinkedIn publish failed.' };
  }
}
