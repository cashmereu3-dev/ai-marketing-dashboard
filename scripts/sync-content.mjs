// Syncs a folder on this computer to the agents' private content library (Supabase Storage).
// Usage: node scripts/sync-content.mjs [folder] [--watch]
// Default folder: ~/Documents/The Agency   (created if missing). Keys are read from .env.local, never printed.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const env = {};
for (const l of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/[^\x21-\x7E]/g, '');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = 'agency-content';
const args = process.argv.slice(2);
const watch = args.includes('--watch');
const folder = args.find((a) => !a.startsWith('--')) || join(homedir(), 'Documents', 'The Agency');
const TYPES = { '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.json': 'application/json', '.html': 'text/html', '.srt': 'text/plain', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const safeKey = (rel) => rel.split(sep).map((p) => p.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_')).join('/');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.')) return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
async function ensureBucket() {
  const { data } = await sb.storage.listBuckets();
  if (!data?.some((b) => b.name === BUCKET)) await sb.storage.createBucket(BUCKET, { public: false });
}
async function remoteIndex(prefix = '') {
  const out = new Map();
  const { data } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000 });
  for (const f of data ?? []) {
    const name = prefix ? `${prefix}/${f.name}` : f.name;
    if (f.id) out.set(name, f.metadata?.size ?? -1);
    else for (const [k, v] of await remoteIndex(name)) out.set(k, v);
  }
  return out;
}
async function once() {
  if (!existsSync(folder)) { mkdirSync(folder, { recursive: true }); console.log(`Created folder: ${folder}`); }
  await ensureBucket();
  const remote = await remoteIndex();
  let up = 0, skip = 0, fail = 0;
  for (const file of walk(folder)) {
    const key = safeKey(relative(folder, file));
    const size = statSync(file).size;
    if (remote.get(key) === size) { skip++; continue; }
    const { error } = await sb.storage.from(BUCKET).upload(key, readFileSync(file), { upsert: true, contentType: TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
    if (error) { fail++; console.log(`  FAILED ${key}: ${error.message}`); } else { up++; console.log(`  uploaded ${key}`); }
  }
  console.log(`[${new Date().toLocaleTimeString()}] ${folder}: ${up} uploaded, ${skip} unchanged, ${fail} failed`);
}
console.log(`Watching: ${folder}${watch ? ' (checks every 60s; Ctrl+C to stop)' : ''}`);
await once();
if (watch) setInterval(() => once().catch((e) => console.log('sync error:', e.message)), 60000);
