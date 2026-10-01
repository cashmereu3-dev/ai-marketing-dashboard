// app/api/agency/approvals/route.ts
// List and decide the drafts agents have queued. Deciding only records Jevon's choice;
// it never publishes anything by itself.
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/agency/auth';
import { getServiceClient } from '@/lib/agency/serverSupabase';

export const runtime = 'nodejs';

const STATUSES = ['pending', 'approved', 'rejected', 'published'];
const MISSING = /does not exist|schema cache|PGRST205|42P01/i;

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const status = new URL(req.url).searchParams.get('status') || 'pending';
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });

  const { data, error } = await getServiceClient()
    .from('agency_approval_queue')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    if (MISSING.test(`${error.code ?? ''} ${error.message}`)) {
      return NextResponse.json({ error: 'The approval queue table is not set up yet. Run supabase/migrations/agency_approval_queue.sql in the Supabase SQL editor.', setupNeeded: true }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function PATCH(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { id?: unknown; status?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id : '';
  const status = typeof body.status === 'string' ? body.status : '';
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  if (!['approved', 'rejected'].includes(status)) return NextResponse.json({ error: 'status must be approved or rejected.' }, { status: 400 });
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null;

  const { data, error } = await getServiceClient()
    .from('agency_approval_queue')
    .update({ status, decided_at: new Date().toISOString(), decision_note: note })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, status')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'That item is no longer pending.' }, { status: 409 });
  return NextResponse.json(data);
}
