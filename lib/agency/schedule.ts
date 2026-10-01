// lib/agency/schedule.ts (SERVER-ONLY)
// Per-agent autonomous drafting: each agent has its own config, daily quota, planned slots and history.
// State is one JSON file in the private content bucket. Drafts land in Approvals; nothing is published here.
import { getServiceClient } from './serverSupabase';
import { CONTENT_BUCKET, ensureBucket } from './content';
import { executeAgenticAgent } from './agenticRunner';

export type BrandKey = 'visions4u' | 'build_catalyst' | 'silverfoxx2u';
export const TZ = 'America/Chicago';

export interface AgentCfg {
  agentId: string;
  label: string;
  brand: BrandKey;
  enabled: boolean;
  paused: boolean;
  postsPerDay: number; // quota per day (hard cap)
  postsPerWeek: number; // 0 = no weekly cap
  startHour: number; // posting window, local time
  endHour: number;
  minGapHours: number;
  days: number[]; // 0=Sun..6=Sat
  platforms: string[];
  randomize: boolean;
  quietHours: boolean; // never run outside the window
}
export interface HistoryEntry { agentId: string; at: string; day: string; ok: boolean; note: string }
export interface ScheduleState { agents: Record<string, AgentCfg>; history: HistoryEntry[] }

export const BRAND_LABELS: Record<BrandKey, string> = { visions4u: 'Visions4U', build_catalyst: 'Build Catalyst', silverfoxx2u: 'Silverfoxx2u' };
export const ALL_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'];
const FILE = '_system/schedule.json';
const base = { enabled: true, paused: false, postsPerWeek: 0, startHour: 8, endHour: 21, minGapHours: 2, days: [0, 1, 2, 3, 4, 5, 6], randomize: true, quietHours: true };

export const DEFAULT_AGENTS: AgentCfg[] = [
  { ...base, agentId: 'v4u_social_content', label: 'Visions4U Social Content', brand: 'visions4u', postsPerDay: 2, platforms: ['facebook', 'instagram'] },
  { ...base, agentId: 'sf_social_viral', label: 'Silverfoxx2u Social & Viral', brand: 'silverfoxx2u', postsPerDay: 1, platforms: ['tiktok', 'instagram'] },
  { ...base, agentId: 'bc_ai_business_audit', label: 'Build Catalyst Content', brand: 'build_catalyst', postsPerDay: 1, platforms: ['linkedin', 'facebook'], days: [1, 3, 5] },
];

export function defaultState(): ScheduleState {
  return { agents: Object.fromEntries(DEFAULT_AGENTS.map((a) => [a.agentId, a])), history: [] };
}

export async function loadState(): Promise<ScheduleState> {
  try {
    await ensureBucket();
    const { data } = await getServiceClient().storage.from(CONTENT_BUCKET).download(FILE);
    if (!data) return defaultState();
    const saved = JSON.parse(await data.text()) as Partial<ScheduleState>;
    const st = defaultState();
    if (saved.agents) for (const [id, a] of Object.entries(saved.agents)) st.agents[id] = { ...(st.agents[id] || ({} as AgentCfg)), ...a, agentId: id };
    st.history = Array.isArray(saved.history) ? saved.history.slice(-300) : [];
    return st;
  } catch {
    return defaultState();
  }
}

export async function saveState(s: ScheduleState): Promise<void> {
  await ensureBucket();
  s.history = s.history.slice(-300);
  const { error } = await getServiceClient().storage.from(CONTENT_BUCKET).upload(FILE, JSON.stringify(s, null, 2), { upsert: true, contentType: 'application/json' });
  if (error) throw new Error(error.message);
}

const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);

export function sanitizeAgent(input: Partial<AgentCfg>, cur: AgentCfg): AgentCfg {
  const a = { ...cur };
  if (typeof input.enabled === 'boolean') a.enabled = input.enabled;
  if (typeof input.paused === 'boolean') a.paused = input.paused;
  if (typeof input.randomize === 'boolean') a.randomize = input.randomize;
  if (typeof input.quietHours === 'boolean') a.quietHours = input.quietHours;
  a.postsPerDay = num(input.postsPerDay, 0, 10, a.postsPerDay);
  a.postsPerWeek = num(input.postsPerWeek, 0, 70, a.postsPerWeek);
  a.startHour = num(input.startHour, 0, 23, a.startHour);
  a.endHour = num(input.endHour, 1, 24, a.endHour);
  if (a.endHour <= a.startHour) a.endHour = Math.min(24, a.startHour + 1);
  a.minGapHours = num(input.minGapHours, 0, 12, a.minGapHours);
  if (Array.isArray(input.days)) a.days = Array.from(new Set(input.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)));
  if (Array.isArray(input.platforms)) a.platforms = input.platforms.filter((p) => ALL_PLATFORMS.includes(p)).slice(0, 5);
  return a;
}

// ---------- time helpers (local = America/Chicago) ----------
export function localParts(d = new Date(), tz: string = TZ) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(d);
  const g = (t: string) => f.find((p) => p.type === t)?.value || '';
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
  const hour = Number(g('hour')) % 24;
  return { day: `${g('year')}-${g('month')}-${g('day')}`, dow, minutes: hour * 60 + Number(g('minute')) };
}

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

/** Planned slot times today, in minutes after local midnight. */
export function planSlots(a: AgentCfg, day: string): number[] {
  const n = a.postsPerDay;
  if (n <= 0) return [];
  const lo = a.startHour * 60, hi = a.endHour * 60, span = hi - lo, seg = span / n;
  const r = rng(`${day}|${a.agentId}`);
  return Array.from({ length: n }, (_, i) => Math.round(lo + i * seg + (a.randomize ? r() * Math.max(0, seg - 5) : 0)));
}

export type Status = { state: 'due' | 'waiting' | 'quota' | 'weekly-quota' | 'off' | 'paused' | 'outside-window' | 'retry-later' | 'not-today'; next?: string; doneToday: number; slots: string[] };
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function agentStatus(a: AgentCfg, history: HistoryEntry[], now = new Date()): Status {
  const { day, dow, minutes } = localParts(now);
  const slots = planSlots(a, day);
  const mine = history.filter((h) => h.agentId === a.agentId);
  const todayOk = mine.filter((h) => h.day === day && h.ok);
  const doneToday = todayOk.length;
  const out = (state: Status['state'], next?: string): Status => ({ state, next, doneToday, slots: slots.map(hhmm) });
  if (!a.enabled) return out('off');
  if (a.paused) return out('paused');
  if (!a.days.includes(dow)) return out('not-today', 'next posting day');
  if (doneToday >= a.postsPerDay) return out('quota', 'tomorrow');
  if (a.postsPerWeek > 0) {
    const weekAgo = now.getTime() - 7 * 86400_000;
    if (mine.filter((h) => h.ok && new Date(h.at).getTime() > weekAgo).length >= a.postsPerWeek) return out('weekly-quota', 'when the 7-day count drops');
  }
  if (a.quietHours && (minutes < a.startHour * 60 || minutes >= a.endHour * 60)) return out('outside-window', `${hhmm(a.startHour * 60)} tomorrow`);
  const lastOk = todayOk.at(-1);
  if (lastOk && now.getTime() - new Date(lastOk.at).getTime() < a.minGapHours * 3600_000) return out('waiting', 'minimum gap');
  const failsToday = mine.filter((h) => h.day === day && !h.ok);
  if (failsToday.length >= 3) return out('retry-later', 'tomorrow (3 failures today)');
  const lastFail = failsToday.at(-1);
  if (lastFail && now.getTime() - new Date(lastFail.at).getTime() < 30 * 60_000) return out('retry-later', '30 min after last failure');
  const slot = slots[doneToday];
  if (slot !== undefined && minutes < slot) return out('waiting', hhmm(slot));
  return out('due');
}

/** Runs the agent once: drafts ONE post into the approval queue. */
export async function runAgentOnce(a: AgentCfg, doneToday: number): Promise<{ ok: boolean; note: string }> {
  const label = BRAND_LABELS[a.brand];
  const platform = a.platforms.length ? a.platforms[doneToday % a.platforms.length] : 'facebook';
  const today = new Date().toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
  const goal =
    `Today is ${today}. Draft exactly 1 new ${platform} post for ${label}. ` +
    `First call content_list_files and read relevant notes for voice and real material. Use read_memory to avoid repeating recent posts. ` +
    `Only state facts from the content library or clearly general ones; never invent prices, offers or testimonials. ` +
    `Call queue_for_approval once (brand="${a.brand}", platform="${platform}", a short title, the exact ready-to-post text, a one-line rationale). Then call submit_deliverable.`;
  try {
    const out = await executeAgenticAgent(a.agentId, goal.slice(0, 1900), {});
    const queued = out.toolsInvoked.filter((t) => t.toolName === 'queue_for_approval' && !t.error).length;
    return queued > 0 ? { ok: true, note: `${platform} draft sent to Approvals.` } : { ok: false, note: 'The agent finished but queued no draft.' };
  } catch (e) {
    return { ok: false, note: e instanceof Error ? e.message.slice(0, 200) : 'Run failed.' };
  }
}

export function record(st: ScheduleState, agentId: string, r: { ok: boolean; note: string }) {
  st.history.push({ agentId, at: new Date().toISOString(), day: localParts().day, ok: r.ok, note: r.note });
}

/** One planner pass: runs every agent that is due (independently, in parallel). */
export async function tick(): Promise<Record<string, string>> {
  const st = await loadState();
  const res: Record<string, string> = {};
  const due = Object.values(st.agents).filter((a) => {
    const s = agentStatus(a, st.history);
    res[a.agentId] = s.state + (s.next ? ` (${s.next})` : '');
    return s.state === 'due';
  });
  await Promise.all(
    due.map(async (a) => {
      const r = await runAgentOnce(a, agentStatus(a, st.history).doneToday);
      record(st, a.agentId, r);
      res[a.agentId] = r.note;
    }),
  );
  if (due.length) await saveState(st).catch(() => undefined);
  return res;
}
