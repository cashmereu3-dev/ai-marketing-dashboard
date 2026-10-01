"use client";
// Talk to any of the agents. Each reply is a real agent run (tools included); nothing is simulated.
import React, { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { AGENCY_AGENTS } from "@/lib/agency/agentRegistry";
import { runAgent } from "@/lib/agency/client";

interface Msg { role: "me" | "agent" | "error"; text: string; tools?: string[]; ms?: number }
const KEY = (id: string) => `agency-chat-${id}`;

function load(id: string): Msg[] {
  try { return JSON.parse(localStorage.getItem(KEY(id)) || "[]") as Msg[]; } catch { return []; }
}
function save(id: string, m: Msg[]) {
  try { localStorage.setItem(KEY(id), JSON.stringify(m.slice(-40))); } catch { /* storage unavailable */ }
}

function render(d: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof d.summary === "string" && d.summary) parts.push(d.summary);
  const body = d.deliverable;
  if (body && typeof body === "object" && Object.keys(body as object).length) parts.push(JSON.stringify(body, null, 2));
  else if (typeof body === "string" && body) parts.push(body);
  if (Array.isArray(d.recommendations) && d.recommendations.length) parts.push("Recommendations:\n" + d.recommendations.map((r) => `• ${r}`).join("\n"));
  if (typeof d.handoffNotes === "string" && d.handoffNotes) parts.push(d.handoffNotes);
  return parts.join("\n\n") || "(The agent returned nothing.)";
}

export default function AgentChat() {
  const [agentId, setAgentId] = useState("tube_orchestrator");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const agent = AGENCY_AGENTS.find((a) => a.id === agentId) ?? AGENCY_AGENTS[0];

  useEffect(() => { setMsgs(load(agentId)); }, [agentId]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => {
    if (!busy) return setSecs(0);
    const t = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    const history = msgs.filter((m) => m.role !== "error").slice(-6).map((m) => `${m.role === "me" ? "Jevon" : agent.name}: ${m.text.slice(0, 350)}`).join("\n");
    const goal = (history ? `Conversation so far:\n${history}\n\nJevon now says: ${message}` : message).slice(-1950);
    const next: Msg[] = [...msgs, { role: "me", text: message }];
    setMsgs(next); save(agentId, next); setText(""); setBusy(true);
    try {
      const out = await runAgent(agentId, goal, {});
      const done: Msg[] = [...next, { role: "agent", text: render(out.deliverable), tools: out.toolsInvoked.map((t) => t.toolName), ms: out.executionDurationMs }];
      setMsgs(done); save(agentId, done);
    } catch (e) {
      const failed: Msg[] = [...next, { role: "error", text: e instanceof Error ? e.message : "The agent could not answer." }];
      setMsgs(failed); save(agentId, failed);
    } finally { setBusy(false); }
  };

  const divisions = Array.from(new Set(AGENCY_AGENTS.map((a) => a.division)));

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-6rem)]">
      <div className="mb-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Talk to your agents</h1>
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          disabled={busy}
          className="mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
        >
          {divisions.map((d) => (
            <optgroup key={d} label={d}>
              {AGENCY_AGENTS.filter((a) => a.division === d).map((a) => (
                <option key={a.id} value={a.id}>{a.number === 1 ? "★ " : ""}{a.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="text-xs text-zinc-400 mt-1">{agent.role}{agent.number === 1 ? " Ask anything: it can hand work to the right specialist." : ""}</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
        {msgs.length === 0 && <p className="text-sm text-zinc-500 p-2">Say something to {agent.name}. Example: &ldquo;Read my content library and draft a Facebook post for Visions4U.&rdquo;</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "me" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.role === "me" ? "bg-red-600 text-white" : m.role === "error" ? "bg-red-950/60 border border-red-900 text-red-300" : "bg-zinc-800 text-zinc-100"}`}>
              {m.text}
              {m.role === "agent" && (m.tools?.length || m.ms) ? (
                <div className="mt-2 text-[11px] text-zinc-400">
                  {m.tools?.length ? `Used: ${Array.from(new Set(m.tools)).join(", ")} · ` : ""}{m.ms ? `${Math.round(m.ms / 1000)}s` : ""}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="w-4 h-4 animate-spin" /> {agent.name} is working… {secs}s (stops automatically at 4 min)</div>}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${agent.name}…`}
          maxLength={1500}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-red-500"
        />
        <button type="submit" disabled={busy || !text.trim()} className="px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 cursor-pointer" aria-label="Send">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
