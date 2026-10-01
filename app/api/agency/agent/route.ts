// app/api/agency/agent/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/agency/auth';
import { executeAgenticAgent } from '@/lib/agency/agenticRunner';
import { LLMError } from '@/lib/agency/llm';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { agentId?: unknown; goal?: unknown; sharedContext?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const agentId = typeof body.agentId === 'string' ? body.agentId : '';
  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  if (!agentId) return NextResponse.json({ error: 'agentId is required.' }, { status: 400 });
  if (!goal || goal.length > 2000) return NextResponse.json({ error: 'goal is required (max 2000 characters).' }, { status: 400 });
  const shared = body.sharedContext && typeof body.sharedContext === 'object' && !Array.isArray(body.sharedContext) ? (body.sharedContext as Record<string, unknown>) : {};

  try {
    const out = await executeAgenticAgent(agentId, goal, shared);
    return NextResponse.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent run failed.';
    console.error('[agent]', agentId, err instanceof LLMError ? err.kind : 'APPLICATION_ERROR', message.slice(0, 300));
    if (err instanceof LLMError) {
      // 504 = timed out, 503 = provider temporarily unavailable (already retried with backoff), 502 = other provider error.
      const status = err.kind === 'TIMEOUT' ? 504 : err.kind === 'TRANSIENT_PROVIDER_ERROR' ? 503 : 502;
      return NextResponse.json({ error: message, code: err.kind, retryable: err.retryable }, { status });
    }
    const status = message.startsWith('Unknown agent') ? 404 : 500;
    return NextResponse.json({ error: message, code: 'APPLICATION_ERROR', retryable: false }, { status });
  }
}
