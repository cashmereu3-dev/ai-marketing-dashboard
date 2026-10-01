// Drafts N posts for each brand agent right now (into Approvals). Usage: npx tsx scripts/draft-today.ts 5
import { readFileSync } from 'node:fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/[^\x20-\x7e]/g, ''); }
const n = Number(process.argv[2] || 5);
(async () => {
  const { loadState, runAgentOnce } = await import('../lib/agency/schedule');
  const st = await loadState();
  const out = await Promise.all(Object.values(st.agents).map(async (a) => {
    let ok = 0; const notes: string[] = [];
    for (let i = 0; i < n; i++) { const r = await runAgentOnce(a, i); if (r.ok) ok++; else notes.push(r.note); console.log(`${a.label} ${i + 1}/${n}: ${r.note}`); }
    return `${a.label}: ${ok}/${n} drafted${notes.length ? ' (' + notes[0] + ')' : ''}`;
  }));
  console.log('\n' + out.join('\n'));
})();
