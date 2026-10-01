"use client";
// Dashboard for Wisdom Quote Master (Facebook) and Business Quote Master (LinkedIn).
import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { authFetch } from "@/lib/agency/authFetch";

interface Cfg { id: string; name: string; platform: string; enabled: boolean; autonomous: boolean; time: string; tz: string; postsPerDay: number; tone: string; categories: string[] }
interface Entry { at: string; status: string; category: string; quote: string; post: string; attribution: string; error?: string; externalId?: string; qc?: { score: number; notes: string } }
interface Row { cfg: Cfg; status: { doneToday: number; failsToday: number; next: string }; published: number; queued: number; failed: number; engagement: { likes: number; comments: number; shares: number }; last: Entry | null; recent: Entry[] }
interface Report { ok: boolean; test: boolean; category?: string; candidate?: { quote: string; post: string; attribution: string; source: string; topic: string }; qc?: { score: number; notes: string; attributionVerified: boolean }; duplicate?: { duplicate: boolean; reason: string }; platform: string; intendedTime: string; status: string; error?: string; attempts: number }
const inp = "bg-background border border-border rounded px-2 py-1 text-sm";

export default function QuoteAgents() {
  const [rows, setRows] = useState<Row[]>([]);
  const [li, setLi] = useState<{ connected: boolean; member: string | null; problem: string | null; source: string | null; expiresAt: string | null; requiredScopes: string; oauthAvailable: boolean } | null>(null);
  const [tok, setTok] = useState("");
  const [fb, setFb] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [openTone, setOpenTone] = useState<string>("");

  const apply = (d: { agents?: Row[]; linkedin?: NonNullable<typeof li>; facebookConnected?: boolean; error?: string }) => {
    if (d.agents) setRows(d.agents);
    if (d.linkedin) setLi(d.linkedin);
    if (typeof d.facebookConnected === "boolean") setFb(d.facebookConnected);
    if (d.error) setMsg(d.error);
  };
  const load = useCallback(async () => { try { apply(await (await authFetch("/api/agency/quotes")).json()); } catch { setMsg("Could not load."); } }, []);
  useEffect(() => { void load(); }, [load]);

  const liCall = async (body: Record<string, unknown>) => {
    setBusy("li"); setMsg("");
    try {
      const d = await (await authFetch("/api/agency/linkedin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
      if (d.url) { window.location.assign(d.url); return; }
      if (d.connected !== undefined) setLi(d);
      setMsg(d.error || (d.ok ? "LinkedIn connected." : ""));
      if (d.ok) setTok("");
    } catch { setMsg("Request failed."); }
    setBusy("");
  };

  const patch = async (id: string, p: Partial<Cfg>) => {
    setRows((r) => r.map((x) => (x.cfg.id === id ? { ...x, cfg: { ...x.cfg, ...p } } : x)));
    try { apply(await (await authFetch("/api/agency/quotes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, patch: p }) })).json()); } catch { setMsg("Save failed."); }
  };
  const act = async (id: string, action: "test" | "run") => {
    setBusy(id + action); setMsg(action === "test" ? "Writing a test post (nothing is published)..." : "Writing and publishing...");
    try {
      const d = await (await authFetch("/api/agency/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) })).json();
      if (d.report) setReports((r) => ({ ...r, [id]: d.report }));
      apply(d); if (!d.error) setMsg("");
    } catch { setMsg("Request failed."); }
    setBusy("");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Quote Agents</h1>
        <p className="text-sm text-gray-400">One quality post a day, 6:00 AM Central. Posts are checked for quality, duplicates and unverifiable attributions before they go out.</p>
      </div>
      {!fb && <p className="rounded border border-yellow-600 bg-yellow-900/30 p-3 text-sm text-yellow-200">Facebook is not connected on the server.</p>}
      {li && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
          <p className="font-semibold text-white">LinkedIn: {li.connected ? `connected${li.member ? " as " + li.member : ""}` : "not connected"}</p>
          {li.connected && <p className="text-xs text-gray-400">Posting automatically{li.expiresAt ? ` · token expires ${li.expiresAt.slice(0, 10)}` : ""}.</p>}
          {!li.connected && li.problem && <p className="text-xs text-yellow-200">{li.problem} Until it is fixed, the Business Quote Master saves its daily post to Approvals.</p>}
          {!li.connected && (
            <div className="flex flex-wrap items-center gap-2">
              <button disabled={busy === "li" || !li.oauthAvailable} onClick={() => liCall({ action: "oauth" })} className="rounded bg-accent px-3 py-1 font-semibold text-white disabled:opacity-40">Connect with LinkedIn</button>
              <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); void liCall({ action: "token", token: tok.trim() }); }} className="flex items-center gap-2">
                <input type="password" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="or paste an access token" className={`${inp} w-64`} />
                <button disabled={busy === "li" || tok.trim().length < 20} className="rounded border border-border px-3 py-1 text-gray-200 disabled:opacity-40">Verify &amp; save</button>
              </form>
            </div>
          )}
          {!li.connected && !li.oauthAvailable && <p className="text-xs text-gray-500">One-click connect needs the LinkedIn app credentials on the server. A pasted token is verified with LinkedIn first and never saved if invalid.</p>}
        </div>
      )}
      {msg && <p className="text-sm text-gray-300">{msg}</p>}
      {!rows.length && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
      {rows.map(({ cfg: c, status: s, published, queued, failed, engagement: e, last, recent }) => {
        const r = reports[c.id];
        return (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-white">{c.name} <span className="text-xs font-normal text-gray-400">· {c.platform} · {c.postsPerDay}/day · {c.time} {c.tz}</span></p>
                <p className="text-xs text-gray-400">{s.doneToday}/{c.postsPerDay} today · next: {s.next} · {published} published · {queued} in approvals · {failed} failed · {e.likes} likes, {e.comments} comments, {e.shares} shares</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
                <label className="flex items-center gap-1"><input type="checkbox" checked={c.enabled} onChange={(x) => patch(c.id, { enabled: x.target.checked })} />On</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={c.autonomous} onChange={(x) => patch(c.id, { autonomous: x.target.checked })} />Autonomous</label>
                <button disabled={!!busy} onClick={() => act(c.id, "test")} className="rounded border border-border px-3 py-1 disabled:opacity-50">{busy === c.id + "test" ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Test (no posting)"}</button>
                <button disabled={!!busy} onClick={() => act(c.id, "run")} className="rounded bg-accent px-3 py-1 font-semibold text-white disabled:opacity-50">{busy === c.id + "run" ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Post now"}</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
              <label>Time <input className={inp} type="time" value={c.time} onChange={(x) => x.target.value && patch(c.id, { time: x.target.value })} /></label>
              <label>Timezone <input className={inp} defaultValue={c.tz} onBlur={(x) => x.target.value !== c.tz && patch(c.id, { tz: x.target.value })} /></label>
              <label>Per day <input className={`${inp} w-16`} type="number" min={1} max={3} value={c.postsPerDay} onChange={(x) => patch(c.id, { postsPerDay: Number(x.target.value) })} /></label>
              <button className="underline" onClick={() => setOpenTone(openTone === c.id ? "" : c.id)}>Tone &amp; categories</button>
            </div>
            {openTone === c.id && (
              <div className="space-y-2 text-xs text-gray-400">
                <label className="block">Tone<textarea className={`${inp} w-full`} rows={3} defaultValue={c.tone} onBlur={(x) => x.target.value !== c.tone && patch(c.id, { tone: x.target.value })} /></label>
                <label className="block">Categories (comma separated)<textarea className={`${inp} w-full`} rows={3} defaultValue={c.categories.join(", ")} onBlur={(x) => patch(c.id, { categories: x.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></label>
              </div>
            )}
            {r && (
              <div className="rounded border border-border bg-background p-3 text-sm text-gray-200 space-y-1">
                <p className="text-xs text-gray-400">{r.test ? "TEST (not published)" : "LIVE RUN"} · {r.status} · {r.platform} · {r.intendedTime} · attempts {r.attempts}{r.category ? ` · category ${r.category}` : ""}</p>
                {r.candidate && <><p className="font-semibold">&ldquo;{r.candidate.quote}&rdquo; <span className="font-normal text-gray-400">({r.candidate.attribution}; {r.candidate.source})</span></p><pre className="whitespace-pre-wrap font-sans">{r.candidate.post}</pre></>}
                {r.qc && <p className="text-xs text-gray-400">Quality {r.qc.score}/10, attribution {r.qc.attributionVerified ? "verified" : "unverified"}. {r.qc.notes}</p>}
                {r.duplicate && <p className="text-xs text-gray-400">Duplicate check: {r.duplicate.reason}</p>}
                {r.error && <p className="text-xs text-red-300">{r.error}</p>}
              </div>
            )}
            {last && <p className="text-xs text-gray-500">Last: {new Date(last.at).toLocaleString()} · {last.status}{last.error ? ` · ${last.error}` : ""}</p>}
            {recent.filter((x) => x.post).length > 0 && (
              <details className="text-xs text-gray-400"><summary className="cursor-pointer">Recent posts</summary>
                {recent.filter((x) => x.post).map((x) => <div key={x.at} className="mt-2 border-t border-border pt-2"><p>{new Date(x.at).toLocaleString()} · {x.category} · {x.status}</p><pre className="whitespace-pre-wrap font-sans text-gray-300">{x.post}</pre></div>)}
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
