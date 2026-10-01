"use client";
// Creator pitch demo: runs a small set of real agents for one creator and assembles a shareable report.
import React, { useState } from "react";
import { Loader2, Copy, Check, Play } from "lucide-react";
import { runAgent } from "@/lib/agency/client";

const STEPS = [
  { id: "niche_outlier_scout", title: "Outlier videos in your niche", goal: (c: string, n: string) => `Find 3 to 5 outlier videos in the niche "${n}" (compare to creator ${c}). Use real YouTube data and explain why each outperformed.` },
  { id: "content_gap_identifier", title: "Content gaps you can own", goal: (c: string, n: string) => `For creator ${c} in the niche "${n}", find topics audiences want that are underserved. Give 5 specific gaps.` },
  { id: "viral_concept_synthesizer", title: "Video concepts to make next", goal: (c: string, n: string) => `Give 5 concrete video concepts for ${c} (niche "${n}"), each with a working title, hook, and why it should work.` },
  { id: "title_ctr_optimizer", title: "Title and thumbnail ideas", goal: (c: string, n: string) => `For the top video concepts for ${c} in "${n}", write 3 title options each and a thumbnail idea.` },
  { id: "shorts_hook_extractor", title: "Shorts hooks", goal: (c: string, n: string) => `Write 5 Shorts hooks (first 3 seconds) for ${c} in "${n}".` },
] as const;

interface Section { title: string; text: string; error?: boolean }

function render(d: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof d.summary === "string" && d.summary) parts.push(d.summary);
  const body = d.deliverable;
  if (typeof body === "string" && body) parts.push(body);
  else if (body && typeof body === "object" && Object.keys(body as object).length) parts.push(JSON.stringify(body, null, 2));
  if (Array.isArray(d.recommendations) && d.recommendations.length) parts.push(d.recommendations.map((r) => `• ${r}`).join("\n"));
  return parts.join("\n\n") || "(no output)";
}

export default function CreatorReport() {
  const [creator, setCreator] = useState("");
  const [niche, setNiche] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [running, setRunning] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const start = async () => {
    const c = creator.trim(), n = niche.trim();
    if (!c || !n || running !== null) return;
    setSections([]);
    const out: Section[] = [];
    for (let i = 0; i < STEPS.length; i++) {
      setRunning(i);
      try {
        const r = await runAgent(STEPS[i].id, STEPS[i].goal(c, n).slice(0, 1900), { niche: n });
        out.push({ title: STEPS[i].title, text: render(r.deliverable) });
      } catch (e) {
        out.push({ title: STEPS[i].title, text: e instanceof Error ? e.message : "This step failed.", error: true });
      }
      setSections([...out]);
    }
    setRunning(null);
  };

  const copy = async () => {
    const text = `Creator growth report for ${creator} (${niche})\n\n` + sections.filter((s) => !s.error).map((s) => `## ${s.title}\n${s.text}`).join("\n\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Creator growth report</h1>
        <p className="text-sm text-zinc-400 mt-1">Run five real agents for one creator and get a report you can send as a pitch. Takes a few minutes.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="Creator or channel (e.g. @handle)" className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-white" />
        <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Niche (e.g. home gym equipment)" className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-white" />
      </div>
      <button onClick={start} disabled={running !== null || !creator.trim() || !niche.trim()} className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
        {running !== null ? <><Loader2 className="w-4 h-4 animate-spin" /> Step {running + 1} of {STEPS.length}: {STEPS[running].title}…</> : <><Play className="w-4 h-4" /> Build the report</>}
      </button>
      {sections.map((s) => (
        <div key={s.title} className={`rounded-2xl border p-4 ${s.error ? "border-red-900 bg-red-950/40" : "border-zinc-800 bg-zinc-900/60"}`}>
          <h2 className="text-sm font-bold text-white mb-2">{s.title}</h2>
          <pre className={`whitespace-pre-wrap break-words text-sm font-sans ${s.error ? "text-red-300" : "text-zinc-200"}`}>{s.text}</pre>
        </div>
      ))}
      {sections.length > 0 && running === null && (
        <button onClick={copy} className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
          {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy report</>}
        </button>
      )}
    </div>
  );
}
