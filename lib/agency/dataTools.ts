// lib/agency/dataTools.ts
// REAL data tools for The Agency's agents (SERVER-ONLY).
//
// Every tool here calls a real API or does real arithmetic. None returns sample data:
// when a key or table is missing the tool throws a clear "not configured" error, which the
// agent sees and reports instead of inventing numbers.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { getServiceClient } from './serverSupabase';
import { BRANDS, PLATFORMS } from './dataToolSchemas';
import { notifyApproval } from './notify';
import { listContent, readContent } from './content';

export interface ToolContext {
  agentId: string;
  projectId: string;
}
type Impl = (input: Record<string, unknown>, ctx: ToolContext) => Promise<Record<string, unknown>>;

const TIMEOUT_MS = 12000;
const MAX_PAGE_BYTES = 600_000;

// ---------- helpers ----------
function str(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function numIn(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set on the server, so this tool is not configured yet. Report that instead of estimating.`);
  return v;
}

async function http(url: string, init: RequestInit = {}): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}
async function getJson(url: string, init: RequestInit = {}): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await http(url, init);
  const text = await res.text();
  let body: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const msg = body?.error?.message || body?.error_description || body?.message || text.slice(0, 200);
    throw new Error(`Request failed (${res.status}): ${msg}`);
  }
  return body;
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// ---------- YouTube ----------
const YT = 'https://www.googleapis.com/youtube/v3';

interface YtVideo {
  id: string;
  title?: string;
  channel?: string;
  publishedAt?: string;
  views: number;
  likes: number;
  comments: number;
  url: string;
}

async function ytVideoStats(ids: string[], key: string): Promise<YtVideo[]> {
  if (!ids.length) return [];
  const body = await getJson(`${YT}/videos?part=snippet,statistics&id=${ids.join(',')}&key=${key}`);
  return (body.items ?? []).map((v: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: v.id,
    title: v.snippet?.title,
    channel: v.snippet?.channelTitle,
    publishedAt: v.snippet?.publishedAt,
    views: Number(v.statistics?.viewCount ?? 0),
    likes: Number(v.statistics?.likeCount ?? 0),
    comments: Number(v.statistics?.commentCount ?? 0),
    url: `https://www.youtube.com/watch?v=${v.id}`,
  }));
}

const youtube_search_videos: Impl = async (input) => {
  const key = need('YOUTUBE_API_KEY');
  const query = str(input.query, 200);
  if (!query) throw new Error('query is required.');
  const order = ['relevance', 'viewCount', 'date'].includes(str(input.order, 20)) ? str(input.order, 20) : 'relevance';
  const max = numIn(input.max_results, 8, 1, 10);
  const search = await getJson(`${YT}/search?part=snippet&type=video&maxResults=${max}&order=${order}&q=${encodeURIComponent(query)}&key=${key}`);
  const ids: string[] = (search.items ?? []).map((i: any) => i.id?.videoId).filter(Boolean); // eslint-disable-line @typescript-eslint/no-explicit-any
  const videos = await ytVideoStats(ids, key);
  return { query, order, count: videos.length, videos, source: 'YouTube Data API v3 (public stats)' };
};

const youtube_channel_stats: Impl = async (input) => {
  const key = need('YOUTUBE_API_KEY');
  let ref = str(input.channel, 200);
  if (!ref) throw new Error('channel is required.');
  const urlHandle = ref.match(/youtube\.com\/(@[\w.-]+)/i);
  const urlId = ref.match(/youtube\.com\/channel\/(UC[\w-]+)/i);
  if (urlHandle) ref = urlHandle[1];
  else if (urlId) ref = urlId[1];

  let lookupUrl: string;
  if (/^UC[\w-]{20,}$/.test(ref)) lookupUrl = `${YT}/channels?part=snippet,statistics,contentDetails&id=${ref}&key=${key}`;
  else if (ref.startsWith('@')) lookupUrl = `${YT}/channels?part=snippet,statistics,contentDetails&forHandle=${encodeURIComponent(ref)}&key=${key}`;
  else {
    const s = await getJson(`${YT}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(ref)}&key=${key}`);
    const id = s.items?.[0]?.id?.channelId;
    if (!id) throw new Error(`No YouTube channel found for "${ref}".`);
    lookupUrl = `${YT}/channels?part=snippet,statistics,contentDetails&id=${id}&key=${key}`;
  }
  const ch = (await getJson(lookupUrl)).items?.[0];
  if (!ch) throw new Error(`No YouTube channel found for "${ref}".`);

  const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
  let recent: YtVideo[] = [];
  if (uploads) {
    const pl = await getJson(`${YT}/playlistItems?part=contentDetails&maxResults=10&playlistId=${uploads}&key=${key}`);
    const ids: string[] = (pl.items ?? []).map((i: any) => i.contentDetails?.videoId).filter(Boolean); // eslint-disable-line @typescript-eslint/no-explicit-any
    recent = await ytVideoStats(ids, key);
  }
  const med = median(recent.map((v) => v.views));
  return {
    channel: ch.snippet?.title,
    id: ch.id,
    url: ch.snippet?.customUrl ? `https://www.youtube.com/${ch.snippet.customUrl}` : `https://www.youtube.com/channel/${ch.id}`,
    subscribers: ch.statistics?.hiddenSubscriberCount ? null : Number(ch.statistics?.subscriberCount ?? 0),
    totalViews: Number(ch.statistics?.viewCount ?? 0),
    videoCount: Number(ch.statistics?.videoCount ?? 0),
    recentUploads: recent,
    medianViewsRecent10: med,
    outliersOver3xMedian: med > 0 ? recent.filter((v) => v.views >= 3 * med).map((v) => ({ title: v.title, views: v.views, multiple: round(v.views / med, 1) })) : [],
    source: 'YouTube Data API v3 (public stats; no private Studio analytics)',
  };
};

// ---------- Facebook ----------
const facebook_page_insights: Impl = async (input) => {
  const pageId = need('FACEBOOK_PAGE_ID');
  const token = need('FACEBOOK_PAGE_ACCESS_TOKEN');
  const ver = process.env.FACEBOOK_GRAPH_VERSION || 'v23.0';
  const days = numIn(input.days, 28, 1, 90);
  const g = `https://graph.facebook.com/${ver}/${pageId}`;
  const t = `access_token=${encodeURIComponent(token)}`;

  const page = await getJson(`${g}?fields=name,followers_count,fan_count,link&${t}`);
  const postsRes = await getJson(
    `${g}/posts?fields=message,created_time,permalink_url,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)&limit=10&${t}`,
  );
  const posts = (postsRes.data ?? []).map((p: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    created: p.created_time,
    url: p.permalink_url,
    text: (p.message ?? '').slice(0, 200),
    reactions: p.reactions?.summary?.total_count ?? 0,
    comments: p.comments?.summary?.total_count ?? 0,
    shares: p.shares?.count ?? 0,
  }));

  // Page insight metrics change often and need extra permissions; treat as best-effort.
  let insights: Record<string, number> | null = null;
  let insightsNote: string | null = null;
  try {
    const since = Math.floor(Date.now() / 1000) - days * 86400;
    const ins = await getJson(`${g}/insights?metric=page_media_view,page_post_engagements,page_follows&period=day&since=${since}&${t}`);
    insights = {};
    for (const m of ins.data ?? []) {
      const vals: number[] = (m.values ?? []).map((v: any) => Number(v.value) || 0); // eslint-disable-line @typescript-eslint/no-explicit-any
      insights[m.name] = m.name === 'page_follows' ? (vals[vals.length - 1] ?? 0) : vals.reduce((a, b) => a + b, 0);
    }
  } catch (e) {
    insightsNote = `Page insights unavailable: ${e instanceof Error ? e.message : String(e)}`;
  }
  return {
    page: page.name,
    followers: page.followers_count ?? null,
    fans: page.fan_count ?? null,
    recentPosts: posts,
    insightsWindowDays: days,
    insights,
    insightsNote,
    source: 'Facebook Graph API',
  };
};

// ---------- Spotify ----------
let spotifyToken: { value: string; exp: number } | null = null;
async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && spotifyToken.exp > Date.now() + 30_000) return spotifyToken.value;
  const id = need('SPOTIFY_CLIENT_ID');
  const secret = need('SPOTIFY_CLIENT_SECRET');
  const body = await getJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  spotifyToken = { value: body.access_token, exp: Date.now() + (Number(body.expires_in) || 3600) * 1000 };
  return spotifyToken.value;
}
const spotify_artist_lookup: Impl = async (input) => {
  const query = str(input.query, 120);
  if (!query) throw new Error('query is required.');
  const token = await getSpotifyToken();
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const s = await getJson(`https://api.spotify.com/v1/search?type=artist&limit=3&q=${encodeURIComponent(query)}`, auth);
  const artists = s.artists?.items ?? [];
  if (!artists.length) return { query, found: false, note: 'No matching artist on Spotify.' };
  const a = artists[0];
  let topTracks: unknown[] = [];
  try {
    const tt = await getJson(`https://api.spotify.com/v1/artists/${a.id}/top-tracks?market=US`, auth);
    topTracks = (tt.tracks ?? []).map((t: any) => ({ name: t.name, popularity: t.popularity, album: t.album?.name, url: t.external_urls?.spotify })); // eslint-disable-line @typescript-eslint/no-explicit-any
  } catch {
    /* top tracks are optional */
  }
  return {
    query,
    found: true,
    artist: { name: a.name, followers: a.followers?.total ?? null, popularity: a.popularity, genres: a.genres ?? [], url: a.external_urls?.spotify },
    otherMatches: artists.slice(1).map((x: any) => ({ name: x.name, followers: x.followers?.total ?? null, popularity: x.popularity })), // eslint-disable-line @typescript-eslint/no-explicit-any
    topTracks,
    source: 'Spotify Web API (public catalog data, not Spotify for Artists)',
  };
};

// ---------- Apple Music / iTunes ----------
const itunes_search: Impl = async (input) => {
  const term = str(input.term, 150);
  if (!term) throw new Error('term is required.');
  const entity = ['musicArtist', 'song', 'album'].includes(str(input.entity, 20)) ? str(input.entity, 20) : 'song';
  const country = /^[A-Za-z]{2}$/.test(str(input.country, 2)) ? str(input.country, 2).toUpperCase() : 'US';
  const limit = numIn(input.limit, 8, 1, 15);
  const body = await getJson(`https://itunes.apple.com/search?media=music&entity=${entity}&country=${country}&limit=${limit}&term=${encodeURIComponent(term)}`);
  const results = (body.results ?? []).map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    artist: r.artistName,
    track: r.trackName,
    album: r.collectionName,
    genre: r.primaryGenreName,
    released: r.releaseDate,
    explicit: r.trackExplicitness,
    url: r.trackViewUrl || r.collectionViewUrl || r.artistLinkUrl,
  }));
  return { term, entity, country, count: results.length, results, source: 'iTunes Search API' };
};

// ---------- Web page audit (SSRF-guarded) ----------
function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:127.') || l.startsWith('::ffff:10.') || l.startsWith('::ffff:192.168.');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
async function assertPublicHttps(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('That is not a valid URL.');
  }
  if (u.protocol !== 'https:') throw new Error('Only https:// URLs can be fetched.');
  const host = u.hostname;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Private addresses cannot be fetched.');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Private addresses cannot be fetched.');
  return u;
}
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const strip = (h: string) => decode(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const fetch_web_page: Impl = async (input) => {
  let url = await assertPublicHttps(str(input.url, 500));
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    res = await http(url.toString(), { redirect: 'manual', headers: { 'User-Agent': 'TheAgencyBot/1.0 (+https://vidvisionsai.pro)', Accept: 'text/html,*/*' } });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      url = await assertPublicHttps(new URL(loc, url).toString());
      continue;
    }
    break;
  }
  if (!res || (res.status >= 300 && res.status < 400)) throw new Error('Too many redirects.');
  if (!res.ok) throw new Error(`The page returned HTTP ${res.status}.`);
  const type = res.headers.get('content-type') || '';
  if (!/text\/html|application\/xhtml/i.test(type)) throw new Error(`Not an HTML page (${type || 'unknown type'}).`);
  const buf = Buffer.from(await res.arrayBuffer()).subarray(0, MAX_PAGE_BYTES);
  const html = buf.toString('utf8');

  const pick = (re: RegExp) => decode((html.match(re)?.[1] ?? '').trim()).slice(0, 300);
  const meta = (name: string) =>
    pick(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i')) ||
    pick(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, 'i'));
  const headings = (tag: string) => [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map((m) => strip(m[1]).slice(0, 140)).filter(Boolean).slice(0, 12);
  const text = strip(html);
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  const host = url.hostname;
  return {
    url: url.toString(),
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
    metaDescription: meta('description'),
    canonical: pick(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i),
    openGraph: { title: meta('og:title'), image: meta('og:image') },
    h1: headings('h1'),
    h2: headings('h2'),
    wordCount: text ? text.split(' ').length : 0,
    images: { total: imgs.length, missingAlt: imgs.filter((i) => !/\balt=["'][^"']+["']/i.test(i)).length },
    links: { total: links.length, internal: links.filter((l) => l.startsWith('/') || l.includes(host)).length },
    hasStructuredData: /application\/ld\+json/i.test(html),
    hasViewportMeta: /<meta[^>]+name=["']viewport["']/i.test(html),
    textExcerpt: text.slice(0, 2500),
    truncated: buf.length >= MAX_PAGE_BYTES,
  };
};

// ---------- pure math ----------
const compute_engagement_rate: Impl = async (input) => {
  const e = Number(input.engagements);
  const r = Number(input.reach);
  if (!(r > 0)) throw new Error('reach must be greater than 0.');
  const rate = (e / r) * 100;
  return { engagements: e, reach: r, engagementRatePct: round(rate, 3), note: 'Benchmarks vary by platform and audience size; compare against your own history.' };
};
const compute_growth_rate: Impl = async (input) => {
  const prev = Number(input.previous);
  const cur = Number(input.current);
  const periods = Math.max(1, Number(input.periods) || 1);
  if (!(prev > 0)) throw new Error('previous must be greater than 0.');
  return {
    previous: prev,
    current: cur,
    absoluteChange: round(cur - prev),
    percentChange: round(((cur - prev) / prev) * 100),
    compoundRatePerPeriodPct: cur > 0 ? round((Math.pow(cur / prev, 1 / periods) - 1) * 100) : null,
    periods,
  };
};
const summarize_series: Impl = async (input) => {
  const v = Array.isArray(input.values) ? input.values.map(Number).filter(Number.isFinite) : [];
  if (v.length < 2) throw new Error('values needs at least 2 numbers.');
  const n = v.length;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const xs = v.map((_, i) => i);
  const xm = (n - 1) / 2;
  const slope = xs.reduce((s, x, i) => s + (x - xm) * (v[i] - mean), 0) / xs.reduce((s, x) => s + (x - xm) ** 2, 0);
  const last = v[n - 1];
  const prev = v[n - 2];
  return {
    count: n,
    mean: round(mean),
    median: round(median(v)),
    min: Math.min(...v),
    max: Math.max(...v),
    latest: last,
    lastStepChange: round(last - prev),
    lastStepChangePct: prev !== 0 ? round(((last - prev) / Math.abs(prev)) * 100) : null,
    trendSlopePerStep: round(slope, 4),
    direction: slope > 0.01 * Math.abs(mean || 1) ? 'rising' : slope < -0.01 * Math.abs(mean || 1) ? 'falling' : 'flat',
  };
};

// ---------- Video editing (Cloudinary) ----------
const cloudinary_list_videos: Impl = async (input) => {
  const cloud = need('CLOUDINARY_CLOUD_NAME');
  const key = need('CLOUDINARY_API_KEY');
  const secret = need('CLOUDINARY_API_SECRET');
  const max = numIn(input.max_results, 15, 1, 30);
  const prefix = str(input.prefix, 200);
  const qs = `max_results=${max}${prefix ? `&prefix=${encodeURIComponent(prefix)}` : ''}`;
  const body = await getJson(`https://api.cloudinary.com/v1_1/${cloud}/resources/video?${qs}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
  });
  const videos = (body.resources ?? []).map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    public_id: r.public_id,
    format: r.format,
    width: r.width,
    height: r.height,
    bytes: r.bytes,
    created_at: r.created_at,
  }));
  return { count: videos.length, videos, source: 'Cloudinary Admin API' };
};

const ASPECTS: Record<string, string> = { '9:16': '9:16', '1:1': '1:1', '4:5': '4:5', '16:9': '16:9' };
const render_video_clip: Impl = async (input) => {
  const cloud = need('CLOUDINARY_CLOUD_NAME');
  const pid = str(input.public_id, 300).replace(/\.(mp4|mov|webm|mkv)$/i, '');
  if (!pid || /[^\w\-./ ]/.test(pid)) throw new Error('public_id looks invalid.');
  const start = Number(input.start_seconds);
  const end = Number(input.end_seconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new Error('end_seconds must be greater than start_seconds (both 0 or more).');
  if (end - start > 90) throw new Error('Clips are limited to 90 seconds.');
  const aspect = ASPECTS[str(input.aspect, 6) || '9:16'];
  if (!aspect) throw new Error('aspect must be 9:16, 1:1, 4:5 or 16:9.');
  const height = aspect === '16:9' ? 1080 : 1920;
  const caption = str(input.caption, 80).replace(/[,/%?#\\]/g, ' ').replace(/\s+/g, ' ').trim();

  const steps = [
    `so_${round(start, 2)},eo_${round(end, 2)}`,
    `ar_${aspect.replace(':', ':')},c_fill,g_auto,h_${height}`,
  ];
  if (caption) steps.push(`co_white,bo_3px_solid_black,l_text:Arial_56_bold:${encodeURIComponent(caption)}`, 'fl_layer_apply,g_south,y_160');
  steps.push('q_auto,f_mp4');
  const url = `https://res.cloudinary.com/${cloud}/video/upload/${steps.join('/')}/${pid.split('/').map(encodeURIComponent).join('/')}.mp4`;

  // Confirm the source exists. Cloudinary renders the cut on first request, so the first play can be slow.
  let verified = false;
  let note = 'Rendered on first play; the first load can take a few seconds.';
  try {
    const res = await http(url, { method: 'HEAD' });
    verified = res.ok;
    if (!res.ok) note = `Cloudinary answered HTTP ${res.status}: check the public_id and that the video exists in this cloud.`;
  } catch {
    note = 'Could not verify the link from the server; open it to confirm.';
  }
  return { url, verified, aspect, startSeconds: start, endSeconds: end, durationSeconds: round(end - start, 2), caption: caption || null, note, source: 'Cloudinary video transformations' };
};

// ---------- approval queue ----------
const queue_for_approval: Impl = async (input, ctx) => {
  const brand = str(input.brand, 30).toLowerCase();
  const platform = str(input.platform, 30).toLowerCase();
  if (!(BRANDS as readonly string[]).includes(brand)) throw new Error(`brand must be one of: ${BRANDS.join(', ')}.`);
  if (!(PLATFORMS as readonly string[]).includes(platform)) throw new Error(`platform must be one of: ${PLATFORMS.join(', ')}.`);
  // Brand isolation: a brand-specific agent may only queue work for its own brand (never silently redirected).
  const own = ctx.agentId.startsWith('v4u_') ? 'visions4u' : ctx.agentId.startsWith('bc_') ? 'build_catalyst' : ctx.agentId.startsWith('sf_') ? 'silverfoxx2u' : null;
  if (own && own !== brand) {
    throw new Error(`Refused: you are a ${own} agent and cannot queue work for ${brand}. Hand it to the agent or the orchestrator that owns ${brand} instead.`);
  }
  const title = str(input.title, 120);
  const content = str(input.content, 5000);
  if (!title || !content) throw new Error('title and content are required.');
  let scheduled: string | null = null;
  const sf = str(input.scheduled_for, 40);
  if (sf) {
    const d = new Date(sf);
    if (!Number.isNaN(d.getTime())) scheduled = d.toISOString();
  }
  const row = {
    status: 'pending',
    brand,
    platform,
    kind: str(input.kind, 30) || 'post',
    title,
    content,
    media_url: str(input.media_url, 500) || null,
    scheduled_for: scheduled,
    rationale: str(input.rationale, 600) || null,
    agent_id: ctx.agentId,
    project_id: ctx.projectId,
  };
  const { data, error } = await getServiceClient().from('agency_approval_queue').insert([row]).select('id').single();
  if (error) {
    if (/does not exist|schema cache|PGRST205|42P01/i.test(`${error.code ?? ''} ${error.message}`)) {
      throw new Error('The approval queue table does not exist yet. Run supabase/migrations/agency_approval_queue.sql in the Supabase SQL editor, then retry.');
    }
    throw new Error(`Could not queue the draft: ${error.message}`);
  }
  // Ping Jevon's phone. Failures are swallowed: the draft is already safely queued.
  await notifyApproval({ brand, platform, title }).catch(() => undefined);
  return { queued: true, id: data?.id, status: 'pending', note: 'Waiting for Jevon to approve in The Agency > Approvals, and his phone was notified. Nothing has been published.' };
};


// ---------- Music API (the owner's Deno music service: YouTube Music, Last.fm, LRCLib) ----------
// Read-only research endpoints only. Audio streaming/proxy endpoints are intentionally not exposed to agents.
const MUSIC_ROUTES: Record<string, { path: string; params: string[] }> = {
  search: { path: '/api/search', params: ['q', 'filter'] },
  suggestions: { path: '/api/search/suggestions', params: ['q'] },
  charts: { path: '/api/charts', params: ['country'] },
  trending: { path: '/api/trending', params: ['country'] },
  moods: { path: '/api/moods', params: [] },
  top_artists: { path: '/api/top/artists', params: ['country'] },
  top_tracks: { path: '/api/top/tracks', params: ['country'] },
  similar: { path: '/api/similar', params: ['title', 'artist'] },
  lyrics: { path: '/api/lyrics', params: ['title', 'artist'] },
  artist_info: { path: '/api/artist/info', params: ['artist'] },
  track_info: { path: '/api/track/info', params: ['title', 'artist'] },
};
const music_api: Impl = async (input) => {
  const base = need('MUSIC_API_BASE_URL').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) throw new Error('MUSIC_API_BASE_URL must start with http(s)://');
  const ep = str(input.endpoint, 30);
  const route = MUSIC_ROUTES[ep];
  if (!route) throw new Error(`endpoint must be one of: ${Object.keys(MUSIC_ROUTES).join(', ')}`);
  const qs = new URLSearchParams();
  for (const k of route.params) { const v = str((input as Record<string, unknown>)[k], 200); if (v) qs.set(k, v); }
  const body = await getJson(`${base}${route.path}${qs.toString() ? `?${qs}` : ''}`);
  const text = JSON.stringify(body);
  return { endpoint: ep, result: text.length > 9000 ? { truncated: true, preview: text.slice(0, 9000) } : body, source: 'Owner music API' };
};

// ---------- doctor (read-only health check) ----------
const KEY_REQUIREMENTS: Record<string, string[]> = {
  youtube_search_videos: ['YOUTUBE_API_KEY'],
  youtube_channel_stats: ['YOUTUBE_API_KEY'],
  facebook_page_insights: ['FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN'],
  spotify_artist_lookup: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'],
  cloudinary_list_videos: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
  render_video_clip: ['CLOUDINARY_CLOUD_NAME'],
  music_api: ['MUSIC_API_BASE_URL'],
};

const agency_doctor: Impl = async (_input, ctx) => {
  const { AGENCY_AGENTS } = await import('./agentRegistry');
  const set = (k: string) => Boolean(process.env[k]);
  const claude = set('ANTHROPIC_API_KEY');
  const open_model = set('OPEN_LLM_API_KEY') || set('GROQ_API_KEY') || set('OPENROUTER_API_KEY');

  const tableOk = async (t: string) => {
    try {
      const { error } = await getServiceClient().from(t).select('*', { head: true, count: 'exact' }).limit(1);
      return error ? `unavailable (${error.message.slice(0, 80)})` : 'ok';
    } catch (e) {
      return `unavailable (${e instanceof Error ? e.message.slice(0, 80) : 'error'})`;
    }
  };
  const [queue, memory] = await Promise.all([tableOk('agency_approval_queue'), tableOk('tubeos_vector_memory')]);

  const me = AGENCY_AGENTS.find((a) => a.id === ctx.agentId);
  const tools = (me?.tools ?? []).filter((t) => t in DATA_TOOLS || t === 'queue_for_approval').map((t) => {
    const missing = (KEY_REQUIREMENTS[t] ?? []).filter((k) => !set(k));
    const ready = t === 'queue_for_approval' ? queue === 'ok' : missing.length === 0;
    return { tool: t, ready, ...(missing.length ? { missing_env: missing } : {}), ...(t === 'queue_for_approval' && queue !== 'ok' ? { problem: `approval queue ${queue}` } : {}) };
  });
  return {
    agent: ctx.agentId,
    models: { claude, open_model, provider_mode: process.env.AGENCY_PROVIDER || 'auto' },
    database: { approval_queue: queue, shared_memory: memory },
    phone_notifications: { web_push: set('VAPID_PRIVATE_KEY') && set('NEXT_PUBLIC_VAPID_PUBLIC_KEY'), ntfy: set('NTFY_TOPIC') },
    your_data_tools: tools,
    guidance: 'Only rely on tools marked ready. Report anything not ready in your deliverable instead of working around it or inventing data.',
  };
};

const content_list_files: Impl = async (input) => {
  const files = await listContent('', numIn(input.max_results, 50, 1, 100));
  return { count: files.length, files };
};
const content_read_file: Impl = async (input) => {
  const name = str(input.name, 300);
  if (!name) throw new Error('name is required.');
  return { ...(await readContent(name, numIn(input.max_chars, 20000, 500, 60000))) };
};

export const DATA_TOOLS: Record<string, Impl> = {
  content_list_files,
  content_read_file,
  agency_doctor,
  youtube_search_videos,
  youtube_channel_stats,
  facebook_page_insights,
  spotify_artist_lookup,
  itunes_search,
  fetch_web_page,
  compute_engagement_rate,
  compute_growth_rate,
  summarize_series,
  cloudinary_list_videos,
  render_video_clip,
  music_api,
  queue_for_approval,
};
