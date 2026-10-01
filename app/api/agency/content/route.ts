// app/api/agency/content/route.ts
// Owner-only: list the content library and mint signed upload URLs (files go straight to storage).
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/agency/auth';
import { getServiceClient } from '@/lib/agency/serverSupabase';
import { CONTENT_BUCKET, ensureBucket, listContent } from '@/lib/agency/content';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json({ files: await listContent() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not list files.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const raw = typeof body.name === 'string' ? body.name : '';
  const safe = raw.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(-120);
  if (!safe) return NextResponse.json({ error: 'File name is required.' }, { status: 400 });
  const path = `${Date.now()}_${safe}`;
  try {
    await ensureBucket();
    const { data, error } = await getServiceClient().storage.from(CONTENT_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? 'Could not prepare the upload.');
    return NextResponse.json({ path, token: data.token });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not prepare the upload.' }, { status: 500 });
  }
}
