// lib/agency/content.ts (SERVER-ONLY)
// The shared content library: a private Supabase Storage bucket the owner uploads to
// and the agents read from.
import { getServiceClient } from './serverSupabase';

export const CONTENT_BUCKET = 'agency-content';

export async function ensureBucket(): Promise<void> {
  const sb = getServiceClient();
  const { data } = await sb.storage.listBuckets();
  if (!data?.some((b) => b.name === CONTENT_BUCKET)) {
    const { error } = await sb.storage.createBucket(CONTENT_BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
  }
}

export interface ContentFile {
  name: string;
  size: number | null;
  type: string | null;
  updated: string | null;
}

export async function listContent(prefix = '', max = 100): Promise<ContentFile[]> {
  await ensureBucket();
  const out: ContentFile[] = [];
  const walk = async (dir: string): Promise<void> => {
    const { data, error } = await getServiceClient()
      .storage.from(CONTENT_BUCKET)
      .list(dir, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw new Error(error.message);
    for (const f of data ?? []) {
      if (out.length >= max) return;
      const name = dir ? `${dir}/${f.name}` : f.name;
      if (f.id) {
        out.push({
          name,
          size: (f.metadata as { size?: number } | null)?.size ?? null,
          type: (f.metadata as { mimetype?: string } | null)?.mimetype ?? null,
          updated: f.updated_at ?? null,
        });
      } else {
        await walk(name);
      }
    }
  };
  await walk(prefix);
  return out;
}

const TEXTY = /^text\/|json|csv|markdown|xml/;

export async function readContent(name: string, maxChars = 20000) {
  const sb = getServiceClient().storage.from(CONTENT_BUCKET);
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const isText = ['txt', 'md', 'csv', 'json', 'html', 'xml', 'srt', 'vtt'].includes(ext);
  if (isText) {
    const { data, error } = await sb.download(name);
    if (error || !data) throw new Error(error?.message ?? 'Could not read that file.');
    const text = await data.text();
    return { name, truncated: text.length > maxChars, content: text.slice(0, maxChars) };
  }
  const { data, error } = await sb.createSignedUrl(name, 60 * 60 * 24 * 7);
  if (error || !data) throw new Error(error?.message ?? 'Could not link that file.');
  return { name, note: 'Media/binary file: its contents cannot be read as text. Use this link (valid 7 days) to reference it.', url: data.signedUrl, texty: TEXTY.test(ext) };
}
