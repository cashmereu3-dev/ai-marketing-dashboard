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
