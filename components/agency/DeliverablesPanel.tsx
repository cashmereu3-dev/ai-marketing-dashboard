'use client';

import React from 'react';
import { Download, Sparkles } from 'lucide-react';
import type { AgentExecutionOutput } from '../../lib/agency/types';

interface Props {
  logs: AgentExecutionOutput[];
  topic: string;
  niche: string;
}

type DeliverableShape = {
  summary?: string;
  deliverable?: Record<string, unknown>;
  recommendations?: string[];
  handoffNotes?: string;
  failed?: boolean;
};

function toMarkdown(logs: AgentExecutionOutput[], topic: string, niche: string): string {
  const lines = [`# The Agency Report`, ``, `**Topic:** ${topic}  `, `**Niche:** ${niche}  `, `**Generated:** ${new Date().toLocaleString()}`, ``];
  let division = '';
  for (const log of logs) {
    const d = log.deliverable as DeliverableShape;
    if (log.division !== division) {
      division = log.division;
      lines.push(`## ${division}`, ``);
    }
    lines.push(`### #${log.agentNumber} ${log.agentName}${log.mode === 'simulated' ? ' (simulated)' : ''}`, ``, d.summary ?? '', ``);
    if (d.deliverable && Object.keys(d.deliverable).length) lines.push('```json', JSON.stringify(d.deliverable, null, 2), '```', ``);
    if (d.recommendations?.length) lines.push(...d.recommendations.map((r) => `- ${r}`), ``);
  }
  return lines.join('\n');
}

export default function DeliverablesPanel({ logs, topic, niche }: Props) {
  const sorted = [...logs].sort((a, b) => a.agentNumber - b.agentNumber);
  const simulated = sorted.some((l) => l.mode === 'simulated');

  const download = () => {
    const blob = new Blob([toMarkdown(sorted, topic, niche)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agency-report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (sorted.length === 0) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
        No deliverables yet. Run an agent or the full team — results appear here.
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/90 border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500" />
            Agent Deliverables
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Topic: &quot;{topic}&quot; | Niche: {niche} | {sorted.length} agent{sorted.length === 1 ? '' : 's'} reported
          </p>
        </div>
        <button
          onClick={download}
          className="flex items-center gap-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" /> Download report (.md)
        </button>
      </div>

      {simulated && (
        <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-900/60 rounded-lg px-3 py-2">
          Some results are simulated — no model was called. Set ANTHROPIC_API_KEY on the server for live agents.
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((log) => {
          const d = log.deliverable as DeliverableShape;
          const hasBody = d.deliverable && Object.keys(d.deliverable).length > 0;
          return (
            <div key={log.agentId} className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-red-400 bg-red-950 border border-red-900 px-2 py-0.5 rounded">#{log.agentNumber}</span>
                <h3 className="text-sm font-bold text-white">{log.agentName}</h3>
                <span className="text-[11px] text-zinc-500 font-mono">{log.division}</span>
                {log.mode === 'simulated' && <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-950/60 border border-amber-900 px-1.5 py-0.5 rounded">simulated</span>}
                {d.failed && <span className="text-[10px] uppercase font-bold text-red-300 bg-red-950/60 border border-red-900 px-1.5 py-0.5 rounded">failed</span>}
              </div>
              {d.summary && <p className="text-xs text-zinc-300 leading-relaxed">{d.summary}</p>}
              {d.recommendations && d.recommendations.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-zinc-400 space-y-0.5">
                  {d.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              {hasBody && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-red-400 font-semibold">View full deliverable</summary>
                  <pre className="mt-2 bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 text-[11px] text-zinc-300 whitespace-pre-wrap overflow-x-auto max-h-96">
                    {JSON.stringify(d.deliverable, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
