"use client";
// Agent Operations Center: per-agent posting frequency, windows, quotas, pause/resume, run now, emergency stop.
import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Pause, OctagonX } from "lucide-react";
import { authFetch } from "@/lib/agency/authFetch";

interface Cfg { agentId: string; label: string; brand: string; enabled: boolean; paused: boolean; postsPerDay: number; postsPerWeek: number; startHour: number; endHour: number; minGapHours: number; days: number[]; platforms: string[]; randomize: boolean; quietHours: boolean }
interface Row { cfg: Cfg; status: { state: string; next?: string; doneToday: number; slots: string[] }; last: { at: string; ok: boolean; note: string } | null }
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "linkedin"];
const hour = (h: number) => `${((h + 11) % 12) + 1}${h % 24 < 12 || h === 24 ? " AM" : " PM"}`;
const inp = "bg-background border border-border rounded px-2 py-1 text-sm w-full";

export default function AgentOps() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cron, setCron] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState("");

  const apply = (d: { agents?: Row[]; cronConfigured?: boolean; message?: string; error?: string }) => {
    if (d.agents) setRows(d.agents);
    if (typeof d.cronConfigured === "boolean") setCron(d.cronConfigured);
    setMsg(d.error || d.message || "");
  };
  const load = useCallback(async () => {
    try { apply(await (await authFetch("/api/agency/schedule")).json()); } catch { setMsg("Could not load."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const patch = async (agentId: string, p: Partial<Cfg>) => {
    setRows((r) => r.map((x) => (x.cfg.agentId === agentId ? { ...x, cfg: { ...x.cfg, ...p } } : x)));
    try { apply(await (await authFetch("/api/agency/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId, patch: p }) })).json()); } catch { setMsg("Save failed."); }
  };
  const act = async (action: string, agentId: string) => {
    setBusy(agentId + action); setMsg(action === "run" ? "Agent is drafting... this takes 1-2 minutes." : "");
    try { apply(await (await authFetch("/api/agency/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, agentId }) })).json()); } catch { setMsg("Request failed."); }
    setBusy("");
  };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Operations</h1>
          <p className="text-sm text-gray-400">Control how often each agent drafts posts. Drafts go to Approvals; nothing posts until you approve.</p>
        </div>
        <button onClick={() => act("stop", "all")} className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"><OctagonX className="h-4 w-4" />Emergency stop</button>
      </div>
      {!cron && <p className="rounded border border-yellow-600 bg-yellow-900/30 p-3 text-sm text-yellow-200">Automatic runs are off until the CRON_SECRET is deployed. Run now works.</p>}
      {msg && <p className="text-sm text-gray-300">{msg}</p>}
      {!rows.length && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
      {rows.map(({ cfg: c, status: s, last }) => (
        <div key={c.agentId} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-white">{c.label}</p>
              <p className="text-xs text-gray-400">{s.doneToday}/{c.postsPerDay} today · {s.state.replace("-", " ")}{s.next ? ` (${s.next})` : ""}{s.slots.length ? ` · plan ${s.slots.join(", ")}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm text-gray-300"><input type="checkbox" checked={c.enabled} onChange={(e) => patch(c.agentId, { enabled: e.target.checked })} />Autonomous</label>
              <button onClick={() => act(c.paused ? "resume" : "pause", c.agentId)} className="rounded border border-border px-2 py-1 text-sm text-gray-200">{c.paused ? <Play className="inline h-4 w-4" /> : <Pause className="inline h-4 w-4" />} {c.paused ? "Resume" : "Pause"}</button>
              <button disabled={!!busy} onClick={() => act("run", c.agentId)} className="rounded bg-accent px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">{busy === c.agentId + "run" ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Run now"}</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5 text-xs text-gray-400">
            <label>Posts / day<input className={inp} type="number" min={0} max={10} value={c.postsPerDay} onChange={(e) => patch(c.agentId, { postsPerDay: Number(e.target.value) })} /></label>
            <label>Posts / week cap (0 = none)<input className={inp} type="number" min={0} max={70} value={c.postsPerWeek} onChange={(e) => patch(c.agentId, { postsPerWeek: Number(e.target.value) })} /></label>
            <label>From<select className={inp} value={c.startHour} onChange={(e) => patch(c.agentId, { startHour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hour(h)}</option>)}</select></label>
            <label>To<select className={inp} value={c.endHour} onChange={(e) => patch(c.agentId, { endHour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{hour(h)}</option>)}</select></label>
            <label>Min gap (hours)<input className={inp} type="number" min={0} max={12} value={c.minGapHours} onChange={(e) => patch(c.agentId, { minGapHours: Number(e.target.value) })} /></label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {DAYS.map((d, i) => <button key={d} onClick={() => patch(c.agentId, { days: toggle(c.days, i) })} className={`rounded px-2 py-1 ${c.days.includes(i) ? "bg-accent text-white" : "bg-background text-gray-400 border border-border"}`}>{d}</button>)}
            <span className="mx-1 text-gray-600">|</span>
            {PLATFORMS.map((p) => <button key={p} onClick={() => patch(c.agentId, { platforms: toggle(c.platforms, p) })} className={`rounded px-2 py-1 ${c.platforms.includes(p) ? "bg-accent text-white" : "bg-background text-gray-400 border border-border"}`}>{p}</button>)}
            <label className="ml-2 flex items-center gap-1 text-gray-300"><input type="checkbox" checked={c.randomize} onChange={(e) => patch(c.agentId, { randomize: e.target.checked })} />Randomize times</label>
          </div>
          {last && <p className="text-xs text-gray-500">Last run {new Date(last.at).toLocaleString()}: {last.ok ? "OK" : "failed"}. {last.note}</p>}
        </div>
      ))}
      <p className="text-xs text-gray-500">Times are Central. Sign-in is required; all settings are saved automatically.</p>
    </div>
  );
}
