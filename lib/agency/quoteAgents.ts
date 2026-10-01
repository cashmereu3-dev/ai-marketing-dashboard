// lib/agency/quoteAgents.ts (SERVER-ONLY)
// Wisdom Quote Master (Facebook) and Business Quote Master (LinkedIn): one post per day at 6:00 AM America/Chicago.
// Pipeline: history -> topic rotation -> generate -> quality control -> duplicate check -> publish -> record.
import { getServiceClient } from './serverSupabase';
import { CONTENT_BUCKET, ensureBucket } from './content';
import { callClaude } from './llm';
import { publishApproved, publishLinkedIn, facebookHasPost, facebookEngagement } from './publish';
import { getCredentials } from './linkedin';
import { localParts } from './schedule';

export interface QuoteCfg {
  id: 'wisdom_quote_master' | 'business_quote_master';
  name: string;
  platform: 'facebook' | 'linkedin';
  brand: 'visions4u' | 'build_catalyst';
  enabled: boolean;
  autonomous: boolean; // true: publish without a tap; false: send to Approvals
  time: string; // HH:MM local
  tz: string;
  postsPerDay: number;
  tone: string;
  categories: string[];
}
export interface QuoteEntry {
  id: string; agentId: string; at: string; day: string; platform: string; category: string; topic: string;
  quote: string; attribution: string; source: string; post: string;
  status: 'published' | 'queued' | 'failed' | 'publishing'; externalId?: string; error?: string;
  qc?: { score: number; notes: string }; attempts: number; model?: string;
  engagement?: { likes: number; comments: number; shares: number; at: string };
}
export interface QuoteState { agents: Record<string, QuoteCfg>; history: QuoteEntry[] }

const WISDOM_CATS = ['Wisdom', 'Life lessons', 'Discipline', 'Resilience', 'Perseverance', 'Self-respect', 'Personal growth', 'Emotional intelligence', 'Relationships', 'Forgiveness', 'Patience', 'Purpose', 'Courage', 'Character', 'Integrity', 'Leadership', 'Humility', 'Success', 'Failure', 'Adversity', 'Inner peace', 'Time', 'Human nature', 'Gratitude', 'Accountability', 'Confidence', 'Boundaries', 'Consistency', 'Perspective', 'Spiritual reflection', 'Legacy'];
const BIZ_CATS = ['Entrepreneurship', 'Leadership', 'Strategy', 'Sales', 'Marketing', 'Customer experience', 'Innovation', 'Technology', 'AI', 'Productivity', 'Execution', 'Discipline', 'Business growth', 'Failure and recovery', 'Risk', 'Decision-making', 'Management', 'Team building', 'Hiring', 'Networking', 'Branding', 'Personal branding', 'Customer retention', 'Systems', 'Automation', 'Scaling', 'Cash flow', 'Value creation', 'Competitive advantage', 'Long-term thinking'];

const DEFAULTS: QuoteCfg[] = [
  { id: 'wisdom_quote_master', name: 'Wisdom Quote Master', platform: 'facebook', brand: 'visions4u', enabled: true, autonomous: true, time: '06:00', tz: 'America/Chicago', postsPerDay: 1, categories: WISDOM_CATS,
    tone: 'Wise, timeless, thoughtful, emotionally intelligent, grounded, inspirational without becoming corny. Something a person would stop scrolling to read. No "rise and grind", no fake-deep statements, no cliches, at most one emoji.' },
  { id: 'business_quote_master', name: 'Business Quote Master', platform: 'linkedin', brand: 'build_catalyst', enabled: true, autonomous: true, time: '06:00', tz: 'America/Chicago', postsPerDay: 1, categories: BIZ_CATS,
    tone: 'Strategic, intelligent, entrepreneurial, authoritative, practical, insightful. LinkedIn-native: a strong quote or principle, then 2-5 short paragraphs on the business lesson, an optional practical takeaway, an optional thoughtful question. No engagement bait, no recycled motivational filler.' },
];
const FILE = '_system/quotes.json';

export async function loadQuotes(): Promise<QuoteState> {
  const st: QuoteState = { agents: Object.fromEntries(DEFAULTS.map((d) => [d.id, structuredClone(d)])), history: [] };
  try {
    await ensureBucket();
    const { data } = await getServiceClient().storage.from(CONTENT_BUCKET).download(FILE);
    if (data) {
      const s = JSON.parse(await data.text()) as Partial<QuoteState>;
      for (const [id, a] of Object.entries(s.agents || {})) if (st.agents[id]) st.agents[id] = { ...st.agents[id], ...a, id: id as QuoteCfg['id'], name: st.agents[id].name };
      st.history = Array.isArray(s.history) ? s.history : [];
    }
  } catch { /* defaults */ }
  return st;
}
export async function saveQuotes(s: QuoteState): Promise<void> {
  await ensureBucket();
  s.history = s.history.slice(-400);
  const { error } = await getServiceClient().storage.from(CONTENT_BUCKET).upload(FILE, JSON.stringify(s), { upsert: true, contentType: 'application/json' });
  if (error) throw new Error(error.message);
}

export function sanitizeQuoteCfg(p: Partial<QuoteCfg>, cur: QuoteCfg): QuoteCfg {
  const a = { ...cur };
  if (typeof p.enabled === 'boolean') a.enabled = p.enabled;
  if (typeof p.autonomous === 'boolean') a.autonomous = p.autonomous;
  if (typeof p.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)) a.time = p.time;
  if (typeof p.tz === 'string') { try { new Intl.DateTimeFormat('en', { timeZone: p.tz }); a.tz = p.tz; } catch { /* ignore */ } }
  if (typeof p.postsPerDay === 'number') a.postsPerDay = Math.min(3, Math.max(1, Math.round(p.postsPerDay)));
  if (typeof p.tone === 'string' && p.tone.trim()) a.tone = p.tone.trim().slice(0, 800);
  if (Array.isArray(p.categories)) { const c = p.categories.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 60)).slice(0, 60); if (c.length) a.categories = c; }
  if (p.platform === 'facebook' || p.platform === 'linkedin') a.platform = p.platform;
  return a;
}

// ---------- text helpers ----------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s: string) => new Set(norm(s).split(' ').filter((w) => w.length > 3));
function jaccard(a: string, b: string) { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let i = 0; for (const w of A) if (B.has(w)) i++; return i / (A.size + B.size - i); }
const opening = (s: string) => norm(s.split(/[.!?\n]/)[0] || '').split(' ').slice(0, 7).join(' ');

export function duplicateCheck(c: { quote: string; post: string; attribution: string; category: string }, hist: QuoteEntry[], now = Date.now()): { duplicate: boolean; reason: string } {
  const prior = hist.filter((h) => h.status !== 'failed').slice(-120);
  for (const h of prior) {
    if (norm(h.quote) === norm(c.quote)) return { duplicate: true, reason: 'Same quote as a previous post.' };
    if (jaccard(h.quote, c.quote) > 0.55) return { duplicate: true, reason: 'Near-duplicate quote.' };
    if (jaccard(h.post, c.post) > 0.45) return { duplicate: true, reason: 'Post text too similar to an earlier post.' };
    if (opening(h.post) && opening(h.post) === opening(c.post)) return { duplicate: true, reason: 'Same opening sentence as an earlier post.' };
    if (c.attribution && c.attribution !== 'original' && h.attribution === c.attribution && now - new Date(h.at).getTime() < 30 * 86400_000) return { duplicate: true, reason: `Same author (${c.attribution}) used in the last 30 days.` };
  }
  const last = prior.at(-1);
  if (last && last.category === c.category) return { duplicate: true, reason: "Same category as the previous post." };
  return { duplicate: false, reason: 'No duplicates found.' };
}

/** Rotation: skip the last ~10 categories used, then weight by average engagement when data exists. */
export function pickCategory(cfg: QuoteCfg, hist: QuoteEntry[], rand = Math.random): string {
  const mine = hist.filter((h) => h.agentId === cfg.id && h.status !== 'failed');
  const recent = new Set(mine.slice(-Math.min(10, Math.floor(cfg.categories.length / 2))).map((h) => h.category));
  let pool = cfg.categories.filter((c) => !recent.has(c));
  if (!pool.length) pool = cfg.categories.filter((c) => c !== mine.at(-1)?.category);
  if (!pool.length) pool = cfg.categories;
  const score = (cat: string) => {
    const e = mine.filter((h) => h.category === cat && h.engagement);
    if (!e.length) return 1;
    const avg = e.reduce((s, h) => s + (h.engagement!.likes + 3 * h.engagement!.comments + 5 * h.engagement!.shares), 0) / e.length;
    return 1 + Math.min(2, avg / 10); // better-performing topics are up to 3x as likely; never zero
  };
  const w = pool.map(score), total = w.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[0];
}

// ---------- LLM steps ----------
async function ask(system: string, user: string): Promise<{ text: string; model?: string }> {
  const r = await callClaude({ system, messages: [{ role: 'user', content: user }], tools: [], maxTokens: 1500 });
  const text = r.content.filter((b) => b.type === 'text').map((b) => String(b.text ?? '')).join('\n');
  return { text };
}
function parseJson<T>(t: string): T | null {
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

interface Candidate { quote: string; attribution: string; source: string; post: string; topic: string }

const RULES = `ABSOLUTE RULES
- NEVER fabricate a quotation or attribute words to a real person unless you are highly confident the exact wording is authentically documented. Default to an ORIGINAL statement with attribution "original". If you attribute, give the source work. Proverbs/scripture/public-domain: only if you are certain of the wording.
- Never use fake quotes attributed to famous people (Einstein, Jobs, Angelou, Aurelius, MLK, Buffett, etc.).
- No false facts, statistics or invented anecdotes. No hashtag spam (max 3 hashtags, LinkedIn only), no engagement bait ("like if you agree", "tag a friend").`;

async function generate(cfg: QuoteCfg, category: string, hist: QuoteEntry[], avoid: string, originalOnly: boolean): Promise<Candidate | null> {
  const recent = hist.filter((h) => h.agentId === cfg.id).slice(-12).map((h) => `- [${h.category}] ${h.quote}`).join('\n') || '(none yet)';
  const fmt = cfg.platform === 'facebook'
    ? 'Facebook format: the quote first, then optionally a short reflection that expands (not repeats) it, then optionally one thought-provoking question. Vary the presentation. Keep it under 900 characters.'
    : 'LinkedIn format: a powerful quote or principle as the hook, then 2-5 short paragraphs on the business lesson, optionally one practical takeaway and a thoughtful question. Short lines, white space. Under 1400 characters.';
  const sys = `You are ${cfg.name}. ${cfg.tone}\n${RULES}\n${originalOnly ? 'This time write an ORIGINAL statement only (attribution "original").\n' : ''}Return ONLY JSON: {"quote": "...", "attribution": "original" or "Name, Source", "source": "where it is documented, or original", "post": "the full ready-to-publish post text including the quote", "topic": "2-5 word subject"}`;
  const user = `Today's category: ${category}.\n${fmt}\nRecent posts (do NOT repeat their ideas, wording, structure or openings):\n${recent}\n${avoid ? `The previous attempt was rejected: ${avoid}\n` : ''}Write today's post.`;
  const { text } = await ask(sys, user);
  const j = parseJson<Candidate>(text);
  if (!j || !j.quote || !j.post) return null;
  return { quote: String(j.quote).trim(), attribution: String(j.attribution || 'original').trim() || 'original', source: String(j.source || 'original'), post: String(j.post).trim(), topic: String(j.topic || category).slice(0, 60) };
}

interface QC { score: number; attributionVerified: boolean; tooGeneric: boolean; similarToRecent: boolean; spammy: boolean; grammar: boolean; notes: string; polished?: string }
async function qualityControl(cfg: QuoteCfg, c: Candidate, hist: QuoteEntry[]): Promise<QC> {
  const recent = hist.filter((h) => h.agentId === cfg.id).slice(-15).map((h) => `- ${h.quote}`).join('\n') || '(none)';
  const sys = `You are a strict editor and fact-checker for ${cfg.platform} content. Return ONLY JSON: {"score": 1-10, "attributionVerified": bool, "tooGeneric": bool, "similarToRecent": bool, "spammy": bool, "grammar": bool, "notes": "one or two sentences", "polished": "the post with improved hook, line breaks and clarity, same meaning (omit if no improvement)"}. attributionVerified must be true ONLY if attribution is "original" or you are certain the exact quote is genuinely documented from that person/source. Score below 7 if generic, cliche, long-winded, spammy, or not valuable.`;
  const { text } = await ask(sys, `Post:\n${c.post}\n\nQuote: ${c.quote}\nAttribution: ${c.attribution} (${c.source})\n\nRecent posts:\n${recent}`);
  const q = parseJson<QC>(text);
  return q || { score: 0, attributionVerified: false, tooGeneric: false, similarToRecent: false, spammy: false, grammar: true, notes: 'Quality control returned no usable verdict.' };
}

export interface RunReport {
  ok: boolean; test: boolean; category?: string; candidate?: Candidate; qc?: QC; duplicate?: { duplicate: boolean; reason: string };
  platform: string; intendedTime: string; status: string; error?: string; attempts: number; entry?: QuoteEntry;
}

export async function produce(cfg: QuoteCfg, hist: QuoteEntry[]): Promise<Pick<RunReport, 'category' | 'candidate' | 'qc' | 'duplicate' | 'attempts' | 'error'> & { cand?: Candidate }> {
  let avoid = '', originalOnly = false, last: ReturnType<typeof Object> = {};
  const category = pickCategory(cfg, hist);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const cand = await generate(cfg, category, hist, avoid, originalOnly);
    if (!cand) { avoid = 'The reply was not valid JSON.'; continue; }
    const qc = await qualityControl(cfg, cand, hist);
    if (cand.attribution.toLowerCase() !== 'original' && !qc.attributionVerified) { originalOnly = true; avoid = 'Attribution could not be verified; write an original statement.'; last = { category, candidate: cand, qc, attempts: attempt, error: avoid }; continue; }
    if (qc.score < 7 || qc.tooGeneric || qc.similarToRecent || qc.spammy || !qc.grammar) { avoid = `Quality control: ${qc.notes}`; last = { category, candidate: cand, qc, attempts: attempt, error: avoid }; continue; }
    if (qc.polished && qc.polished.length > 20 && qc.polished.length < 2500 && qc.polished.includes(cand.quote.slice(0, 20))) cand.post = qc.polished;
    const dup = duplicateCheck({ quote: cand.quote, post: cand.post, attribution: cand.attribution, category }, hist);
    if (dup.duplicate) { avoid = dup.reason; last = { category, candidate: cand, qc, duplicate: dup, attempts: attempt, error: avoid }; continue; }
    return { category, candidate: cand, cand, qc, duplicate: dup, attempts: attempt };
  }
  return { ...(last as object), attempts: 3, error: `No post passed quality control and duplicate checks: ${(last as { error?: string }).error || 'unknown'}` } as ReturnType<typeof produce> extends Promise<infer R> ? R : never;
}

function intended(cfg: QuoteCfg): string {
  return `${cfg.time} ${cfg.tz} daily`;
}

/** Test mode: produces and checks a post, publishes nothing, records nothing. */
export async function testRun(cfg: QuoteCfg, hist: QuoteEntry[]): Promise<RunReport> {
  try {
    const p = await produce(cfg, hist);
    return { ok: !p.error, test: true, category: p.category, candidate: p.candidate, qc: p.qc, duplicate: p.duplicate, platform: cfg.platform, intendedTime: intended(cfg), status: p.error ? 'would not publish' : 'would publish', error: p.error, attempts: p.attempts };
  } catch (e) {
    return { ok: false, test: true, platform: cfg.platform, intendedTime: intended(cfg), status: 'error', error: e instanceof Error ? e.message : 'Test failed', attempts: 0 };
  }
}

async function queueForApproval(cfg: QuoteCfg, e: QuoteEntry, why: string): Promise<boolean> {
  const { error } = await getServiceClient().from('agency_approval_queue').insert([{ brand: cfg.brand, platform: cfg.platform, kind: 'post', title: `${cfg.name}: ${e.topic}`.slice(0, 100), content: e.post, rationale: why.slice(0, 400), agent_id: cfg.id }]);
  return !error;
}

/** Live run: produce, publish (or queue), record. Idempotent per local day via the 'publishing' marker. */
export async function liveRun(cfg: QuoteCfg, st: QuoteState): Promise<RunReport> {
  const { day } = localParts(new Date(), cfg.tz);
  const rep = (o: Partial<RunReport>): RunReport => ({ ok: false, test: false, platform: cfg.platform, intendedTime: intended(cfg), status: 'failed', attempts: 0, ...o });
  let p;
  try { p = await produce(cfg, st.history); } catch (e) {
    const msg = e instanceof Error ? e.message : 'Generation failed';
    st.history.push({ id: crypto.randomUUID(), agentId: cfg.id, at: new Date().toISOString(), day, platform: cfg.platform, category: '', topic: '', quote: '', attribution: '', source: '', post: '', status: 'failed', error: msg, attempts: 0 });
    return rep({ error: msg });
  }
  if (!p.cand) {
    st.history.push({ id: crypto.randomUUID(), agentId: cfg.id, at: new Date().toISOString(), day, platform: cfg.platform, category: p.category || '', topic: '', quote: '', attribution: '', source: '', post: '', status: 'failed', error: p.error, attempts: p.attempts });
    return rep({ category: p.category, candidate: p.candidate, qc: p.qc, duplicate: p.duplicate, error: p.error, attempts: p.attempts });
  }
  const c = p.cand;
  const entry: QuoteEntry = { id: crypto.randomUUID(), agentId: cfg.id, at: new Date().toISOString(), day, platform: cfg.platform, category: p.category!, topic: c.topic, quote: c.quote, attribution: c.attribution, source: c.source, post: c.post, status: 'publishing', qc: p.qc ? { score: p.qc.score, notes: p.qc.notes } : undefined, attempts: p.attempts };
  st.history.push(entry);
  await saveQuotes(st); // marker first: a crash mid-publish can never trigger a second post

  if (!cfg.autonomous) {
    entry.status = (await queueForApproval(cfg, entry, 'Autonomous mode is off.')) ? 'queued' : 'failed';
    if (entry.status === 'failed') entry.error = 'Could not write to the approval queue.';
    return rep({ ok: entry.status === 'queued', category: entry.category, candidate: c, qc: p.qc, duplicate: p.duplicate, status: entry.status, attempts: p.attempts, entry, error: entry.error });
  }

  let result: Awaited<ReturnType<typeof publishLinkedIn>> | undefined;
  if (cfg.platform === 'linkedin') {
    const cred = await getCredentials(); // resolves + caches the member ID from the token automatically
    result = cred.ok ? await publishLinkedIn(entry.post, cred.creds) : { published: false, reason: cred.reason };
  } else {
    result = await publishApproved({ id: entry.id, platform: 'facebook', title: entry.topic, content: entry.post, media_url: null, scheduled_for: null });
    if (!result.published) {
      const existing = await facebookHasPost(entry.post); // verify before any retry: did Facebook actually accept it?
      if (existing) result = { published: true, externalId: existing, scheduled: false };
      else { await new Promise((r) => setTimeout(r, 4000)); result = await publishApproved({ id: entry.id, platform: 'facebook', title: entry.topic, content: entry.post, media_url: null, scheduled_for: null }); }
    }
  }
  if (result.published) { entry.status = 'published'; entry.externalId = result.externalId; }
  else {
    // Never silent: record the exact error and route the finished post to Approvals so it is not lost.
    entry.error = result.reason;
    const q = await queueForApproval(cfg, entry, `Automatic publishing failed: ${result.reason}`.slice(0, 400));
    entry.status = q ? 'queued' : 'failed';
    if (!q) entry.error += ' (also could not write to the approval queue)';
  }
  return rep({ ok: entry.status === 'published', category: entry.category, candidate: c, qc: p.qc, duplicate: p.duplicate, status: entry.status, attempts: p.attempts, entry, error: entry.error });
}

// ---------- scheduling ----------
export function quoteStatus(cfg: QuoteCfg, hist: QuoteEntry[], now = new Date()) {
  const { day, minutes } = localParts(now, cfg.tz);
  const [h, m] = cfg.time.split(':').map(Number);
  const mine = hist.filter((x) => x.agentId === cfg.id);
  const today = mine.filter((x) => x.day === day);
  const done = today.filter((x) => x.status === 'published' || x.status === 'queued' || x.status === 'publishing').length;
  const fails = today.filter((x) => x.status === 'failed').length;
  const lastFail = today.filter((x) => x.status === 'failed').at(-1);
  const recentFail = lastFail ? now.getTime() - new Date(lastFail.at).getTime() < 30 * 60_000 : false;
  const due = cfg.enabled && done < cfg.postsPerDay && fails < 3 && !recentFail && minutes >= h * 60 + m;
  return { due, doneToday: done, failsToday: fails, next: done >= cfg.postsPerDay ? `tomorrow ${cfg.time}` : minutes < h * 60 + m ? `today ${cfg.time}` : due ? 'now' : 'retry pending' };
}

export async function runDueQuotes(): Promise<Record<string, string>> {
  const st = await loadQuotes();
  const out: Record<string, string> = {};
  const jobs = Object.values(st.agents).filter((a) => { const s = quoteStatus(a, st.history); out[a.id] = s.due ? 'running' : `idle (${s.next})`; return s.due; });
  await Promise.all(jobs.map(async (a) => { const r = await liveRun(a, st); out[a.id] = `${r.status}${r.error ? ': ' + r.error : ''}`; }));
  if (jobs.length) await saveQuotes(st).catch(() => undefined);
  return out;
}

/** Analytics hook: pulls Facebook engagement for recent published posts. */
export async function refreshEngagement(st: QuoteState): Promise<number> {
  let n = 0;
  for (const h of st.history.slice(-30)) {
    if (h.platform !== 'facebook' || h.status !== 'published' || !h.externalId) continue;
    if (h.engagement && Date.now() - new Date(h.engagement.at).getTime() < 6 * 3600_000) continue;
    const e = await facebookEngagement(h.externalId);
    if (e) { h.engagement = { ...e, at: new Date().toISOString() }; n++; }
  }
  return n;
}
