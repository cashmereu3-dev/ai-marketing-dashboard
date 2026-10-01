// Static audit of every registered agent: run with `npx tsx tests/audit-agents.ts`. Exits 1 on any problem.
import { AGENCY_AGENTS } from '../lib/agency/agentRegistry';
import { LIVE_TOOL_SCHEMAS } from '../lib/agency/liveTools';
import { DATA_TOOLS } from '../lib/agency/dataTools';
import { AGENCY_TOOLS } from '../lib/agency/toolRegistry';

type Status = 'FUNCTIONAL' | 'NEEDS FIX' | 'UNIMPLEMENTED' | 'DUPLICATE' | 'BROKEN DEPENDENCY';
const rows: { id: string; status: Status; notes: string[] }[] = [];
const seen = new Map<string, number>();
for (const a of AGENCY_AGENTS) {
  const notes: string[] = [];
  let status: Status = 'FUNCTIONAL';
  if (seen.has(a.id)) { status = 'DUPLICATE'; notes.push(`same id as agent #${seen.get(a.id)}`); }
  seen.set(a.id, a.number);
  if (!a.systemPrompt || a.systemPrompt.length < 40) { status = 'UNIMPLEMENTED'; notes.push('no system prompt'); }
  for (const t of a.tools) {
    const schema = LIVE_TOOL_SCHEMAS[t] as { input_schema?: { properties?: object; required?: string[] } } | undefined;
    const impl = DATA_TOOLS[t] || AGENCY_TOOLS[t];
    if (!schema) { /* free-text "skills" are folded into the prompt, not callable tools */ continue; }
    if (!impl) { status = 'BROKEN DEPENDENCY'; notes.push(`tool ${t} has a schema but no implementation`); continue; }
    for (const r of schema.input_schema?.required ?? []) {
      if (!(r in (schema.input_schema?.properties ?? {}))) { status = 'NEEDS FIX'; notes.push(`tool ${t}: required "${r}" is not a defined property`); }
    }
  }
  rows.push({ id: a.id, status, notes });
}
const counts: Record<string, number> = {};
for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
console.log(`${rows.length} agents`, counts);
for (const r of rows.filter((r) => r.status !== 'FUNCTIONAL')) console.log(' -', r.id, r.status, r.notes.join('; '));
process.exit(rows.some((r) => r.status !== 'FUNCTIONAL') ? 1 : 0);
