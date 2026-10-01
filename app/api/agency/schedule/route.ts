// app/api/agency/schedule/route.ts: owner-only per-agent schedule control.
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/agency/auth';
import { loadState, saveState, sanitizeAgent, agentStatus, runAgentOnce, record, type AgentCfg } from '@/lib/agency/schedule';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function view() {
  const st = await loadState();
  return {
    cronConfigured: Boolean(process.env.CRON_SECRET),
    agents: Object.values(st.agents).map((a) => ({ cfg: a, status: agentStatus(a, st.history), last: st.history.filter((h) => h.agentId === a.agentId).at(-1) || null })),
  };
}

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await view());
}

// PUT { agentId, patch }  |  POST { action: 'run'|'pause'|'resume'|'stop', agentId } ('stop' also accepts agentId:'all')
export async function PUT(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = (await req.json().catch(() => ({}))) as { agentId?: string; patch?: Partial<AgentCfg> };
  const st = await loadState();
  const cur = b.agentId ? st.agents[b.agentId] : undefined;
  if (!cur) return NextResponse.json({ error: 'Unknown agent.' }, { status: 400 });
  st.agents[cur.agentId] = sanitizeAgent(b.patch || {}, cur);
  await saveState(st);
  return NextResponse.json(await view());
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = (await req.json().catch(() => ({}))) as { action?: string; agentId?: string };
  const st = await loadState();
  let message = '';
  if (b.action === 'stop' && b.agentId === 'all') {
    for (const a of Object.values(st.agents)) a.paused = true;
    message = 'Everything paused.';
  } else {
    const a = b.agentId ? st.agents[b.agentId] : undefined;
    if (!a) return NextResponse.json({ error: 'Unknown agent.' }, { status: 400 });
    if (b.action === 'pause' || b.action === 'stop') a.paused = true;
    else if (b.action === 'resume') a.paused = false;
    else if (b.action === 'run') {
      const s = agentStatus({ ...a, enabled: true, paused: false }, st.history);
      if (s.doneToday >= a.postsPerDay) return NextResponse.json({ error: 'Daily quota reached.', ...(await view()) }, { status: 409 });
      const r = await runAgentOnce(a, s.doneToday);
      record(st, a.agentId, r);
      message = r.note;
    } else return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }
  await saveState(st);
  return NextResponse.json({ message, ...(await view()) });
}
