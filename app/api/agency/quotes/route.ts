import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/agency/auth';
import { loadQuotes, saveQuotes, sanitizeQuoteCfg, quoteStatus, testRun, liveRun, refreshEngagement } from '@/lib/agency/quoteAgents';
import { linkedinConfigured } from '@/lib/agency/publish';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function view(refresh = false) {
  const st = await loadQuotes();
  if (refresh && (await refreshEngagement(st))) await saveQuotes(st).catch(() => undefined);
  return {
    linkedinConnected: linkedinConfigured(), facebookConnected: Boolean(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN), cronConfigured: Boolean(process.env.CRON_SECRET),
    agents: Object.values(st.agents).map((cfg) => {
      const mine = st.history.filter((h) => h.agentId === cfg.id);
      const eng = mine.filter((h) => h.engagement);
      return {
        cfg, status: quoteStatus(cfg, st.history),
        published: mine.filter((h) => h.status === 'published').length, queued: mine.filter((h) => h.status === 'queued').length, failed: mine.filter((h) => h.status === 'failed').length,
        engagement: { likes: eng.reduce((s, h) => s + h.engagement!.likes, 0), comments: eng.reduce((s, h) => s + h.engagement!.comments, 0), shares: eng.reduce((s, h) => s + h.engagement!.shares, 0) },
        last: mine.at(-1) || null, recent: mine.slice(-5).reverse(),
      };
    }),
  };
}

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await view(true));
}

export async function PUT(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = (await req.json().catch(() => ({}))) as { id?: string; patch?: Record<string, unknown> };
  const st = await loadQuotes();
  const cur = b.id ? st.agents[b.id] : undefined;
  if (!cur) return NextResponse.json({ error: 'Unknown agent.' }, { status: 400 });
  st.agents[cur.id] = sanitizeQuoteCfg((b.patch || {}) as never, cur);
  await saveQuotes(st);
  return NextResponse.json(await view());
}

// POST { id, action: 'test' | 'run' }  test never publishes or records; run publishes now (counts as today's post)
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = (await req.json().catch(() => ({}))) as { id?: string; action?: string };
  const st = await loadQuotes();
  const cfg = b.id ? st.agents[b.id] : undefined;
  if (!cfg) return NextResponse.json({ error: 'Unknown agent.' }, { status: 400 });
  if (b.action === 'test') return NextResponse.json({ report: await testRun(cfg, st.history) });
  if (b.action === 'run') {
    const s = quoteStatus({ ...cfg, enabled: true }, st.history);
    if (s.doneToday >= cfg.postsPerDay) return NextResponse.json({ error: 'Today\'s post is already done. Use Test to preview a new one.' }, { status: 409 });
    const report = await liveRun(cfg, st);
    await saveQuotes(st).catch(() => undefined);
    return NextResponse.json({ report, ...(await view()) });
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
