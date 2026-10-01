'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../../lib/agency/authFetch';
import { CheckCircle2, XCircle, RefreshCw, Inbox } from 'lucide-react';

interface QueueItem {
  id: string;
  created_at: string;
  brand: string;
  platform: string;
  kind: string;
  title: string;
  content: string;
  media_url: string | null;
  scheduled_for: string | null;
  rationale: string | null;
  agent_id: string;
}

export default function ApprovalQueuePanel() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/agency/approvals?status=pending');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || `Could not load the queue (${res.status}).`);
      setItems((body as { items: QueueItem[] }).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Keep the list fresh while the screen is open, and when you come back to the app.
    const timer = setInterval(load, 30000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    setBusyId(id);
    setError(null);
    try {
      const res = await authFetch('/api/agency/approvals', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || 'Could not save your decision.');
      setItems((prev) => prev.filter((i) => i.id !== id));
      const note = (body as { publishNote?: string }).publishNote;
      if (status === 'approved' && note) setError(note);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your decision.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">
          Drafts the agents prepared. Approving posts Facebook drafts for you (other platforms stay approved for you to post).
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-50 cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-zinc-500 text-sm">
          <Inbox className="w-8 h-8" />
          Nothing waiting for approval.
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase">
              <span className="px-2 py-0.5 rounded bg-red-950/60 border border-red-900/50 text-red-400">{item.brand.replace('_', ' ')}</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{item.platform}</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">{item.kind}</span>
              {item.scheduled_for && <span className="text-zinc-500 normal-case font-medium">Suggested: {new Date(item.scheduled_for).toLocaleString()}</span>}
            </div>
            <h4 className="text-white font-bold">{item.title}</h4>
            <pre className="whitespace-pre-wrap text-sm text-zinc-200 bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 font-sans">{item.content}</pre>
            {item.media_url && (
              <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 underline break-all">
                {item.media_url}
              </a>
            )}
            {item.rationale && <p className="text-xs text-zinc-400">Why: {item.rationale}</p>}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-1">
              <span className="text-[11px] text-zinc-500">From {item.agent_id} · {new Date(item.created_at).toLocaleString()}</span>
              <div className="flex gap-2">
                <button onClick={() => decide(item.id, 'rejected')} disabled={busyId === item.id} className="inline-flex items-center justify-center gap-1.5 px-4 py-3 md:py-1.5 rounded-xl md:rounded-lg text-sm md:text-xs font-bold bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white disabled:opacity-50 cursor-pointer flex-1 md:flex-none">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <button onClick={() => decide(item.id, 'approved')} disabled={busyId === item.id} className="inline-flex items-center justify-center gap-1.5 px-4 py-3 md:py-1.5 rounded-xl md:rounded-lg text-sm md:text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer flex-1 md:flex-none">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
