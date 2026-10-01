// lib/agency/agenticRunner.ts
/**
 * The Agency agent runtime (SERVER-ONLY — reads ANTHROPIC_API_KEY / GEMINI_API_KEY, never import from client code).
 *
 * Live mode runs a genuine tool-use loop per agent:
 *   model reasons -> calls tools (real computations, web search, shared memory, delegation)
 *   -> sees results -> iterates -> submits a structured deliverable.
 * Simulated mode (no API key) keeps the old canned output so the UI still works, and says so.
 */
import { AGENCY_AGENTS } from './agentRegistry';
import { AGENCY_TOOLS } from './toolRegistry';
import { DATA_TOOLS } from './dataTools';
import { getServiceClient } from './serverSupabase';
import {
  callClaude,
  isLiveAvailable,
  DEFAULT_MODEL,
  LLMError,
  type ContentBlock,
  type LLMMessage,
  type LLMTool,
} from './llm';
import {
  LIVE_TOOL_SCHEMAS,
  LIVE_TOOL_NAMES,
  WEB_SEARCH_TOOL,
  WEB_SEARCH_DIVISIONS,
  READ_MEMORY_TOOL,
  WRITE_MEMORY_TOOL,
  DELEGATE_TOOL,
  SUBMIT_TOOL,
  validateToolInput,
} from './liveTools';
import type { AgentExecutionOutput, ToolInvocation, AgencyAgent } from './types';

export type { AgentExecutionOutput } from './types';

const MAX_TOOL_RESULT_CHARS = 6000;
const MAX_CONTEXT_CHARS = 20000;
const MAX_CONTEXT_PER_AGENT = 500;
const MAX_DELEGATIONS = 3;
const TOOL_TIMEOUT_MS = 30_000;
/** Whole-run budget: must finish inside the route's maxDuration (300s) with room to respond. */
const RUN_BUDGET_MS = 240_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function clip(value: unknown, max: number): string {
  let s: string;
  try {
    s = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    s = String(value);
  }
  if (s === undefined) s = '';
  return s.length > max ? `${s.slice(0, max)}…[truncated]` : s;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function buildTeamContext(shared: Record<string, unknown>): string {
  const prior = shared.priorDeliverables;
  if (!prior || typeof prior !== 'object') return '(none yet — you are working first or on your own)';
  const parts: string[] = [];
  let used = 0;
  for (const [id, val] of Object.entries(prior as Record<string, unknown>)) {
    const name = AGENCY_AGENTS.find((a) => a.id === id)?.name ?? id;
    const block = `## ${name}\n${clip(val, MAX_CONTEXT_PER_AGENT)}`;
    if (used + block.length > MAX_CONTEXT_CHARS) break;
    parts.push(block);
    used += block.length;
  }
  return parts.length ? parts.join('\n\n') : '(none yet — you are working first or on your own)';
}

function humanize(tool: string): string {
  return tool.replace(/_/g, ' ');
}

function buildSystemPrompt(agent: AgencyAgent): string {
  const selfSkills = agent.tools.filter((t) => !LIVE_TOOL_NAMES.has(t) && !['read_vector_memory', 'write_vector_memory', 'delegate_to_subagent'].includes(t));
  return `${agent.systemPrompt}

You are agent #${agent.number}, "${agent.name}" (${agent.role}), in the ${agent.division} division of The Agency — a team of ${AGENCY_AGENTS.length} agents across YouTube growth, Visions4U, Build Catalyst, and Silverfoxx2u. Work autonomously toward the goal.

How to work:
- Decide what you need to know, then use your tools when they add real information or exact calculations. Use web_search (when available) for current facts.
- Never invent statistics, view counts, competitor data, or sources. If you lack data, say so and clearly label any estimate as an estimate.
- These skills are yours to perform directly in your reasoning and deliverable (no tool exists for them): ${selfSkills.length ? selfSkills.map(humanize).join(', ') : 'none'}.
- Operating rules (follow them every run):
  1. Doctor first. If your task depends on external data, or any tool errors, call agency_doctor before anything else and trust it over assumptions. Only use tools it marks ready.
  2. Read tool descriptions and errors literally. "Not configured", "refused" or "does not exist" means stop using that path: report it in your deliverable. Never retry in a loop, never substitute made-up or sample data.
  3. Never silently redirect. Use the exact brand, platform, account and project the task names. If it is ambiguous, or a tool refuses because it belongs to another brand, say so and hand it off; do not default to a different target.
  4. Stay in your lane. One brand per draft, never mix brands or accounts, and do not touch other teams' work; hand work over through delegation or the approval queue.
  5. Use the one documented tool for a job instead of improvising around it, and look at what a tool returned before the next step.
  6. Nothing is published by you. Anything meant for the public goes through queue_for_approval and waits for Jevon.
- Build on your teammates' work where it is relevant (see team context in the task).
- When finished, call submit_deliverable exactly once with concrete, directly usable work. Do not end without submitting.`;
}

function buildTools(agent: AgencyAgent, opts: { allowDelegate: boolean; webSearch: boolean }): LLMTool[] {
  const tools: LLMTool[] = [];
  for (const t of agent.tools) if (LIVE_TOOL_SCHEMAS[t]) tools.push(LIVE_TOOL_SCHEMAS[t]);
  if (opts.webSearch) tools.push(WEB_SEARCH_TOOL);
  tools.push(READ_MEMORY_TOOL, WRITE_MEMORY_TOOL);
  if (opts.allowDelegate) tools.push(DELEGATE_TOOL);
  tools.push(SUBMIT_TOOL);
  return tools;
}

interface LoopEnv {
  projectId: string;
  agentId: string;
  delegate?: (agentId: string, task: string) => Promise<Record<string, unknown>>;
}

function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function executeTool(name: string, input: Record<string, unknown>, env: LoopEnv): Promise<Record<string, unknown>> {
  if (name === 'read_memory') {
    const query = typeof input.query === 'string' ? input.query.trim().slice(0, 200) : '';
    if (!query) throw new Error('read_memory needs a non-empty "query".');
    const { data, error } = await getServiceClient()
      .from('tubeos_vector_memory')
      .select('agent_id, content, created_at')
      .eq('project_id', env.projectId)
      .ilike('content', `%${escapeLike(query)}%`)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw new Error(`Memory unavailable: ${error.message}`);
    return { matches: (data ?? []).map((r) => ({ agent: r.agent_id, content: clip(r.content, 800), at: r.created_at })) };
  }

  if (name === 'write_memory') {
    const content = typeof input.content === 'string' ? input.content.trim().slice(0, 2000) : '';
    if (!content) throw new Error('write_memory needs non-empty "content".');
    const { error } = await getServiceClient().from('tubeos_vector_memory').insert([
      { project_id: env.projectId, agent_id: env.agentId, content, metadata: { source: 'write_memory' }, created_at: new Date().toISOString() },
    ]);
    if (error) throw new Error(`Memory unavailable: ${error.message}`);
    return { saved: true };
  }

  if (name === 'delegate_to_subagent') {
    if (!env.delegate) throw new Error('Delegation is not available to this agent.');
    const id = typeof input.agent_id === 'string' ? input.agent_id : '';
    const task = typeof input.task === 'string' ? input.task : '';
    if (!id || !task) throw new Error('delegate_to_subagent needs "agent_id" and "task".');
    return env.delegate(id, task);
  }

  const schema = LIVE_TOOL_SCHEMAS[name];
  const dataImpl = DATA_TOOLS[name];
  if (schema && dataImpl) {
    const badData = validateToolInput(schema, input);
    if (badData) throw new Error(badData);
    return dataImpl(input, { agentId: env.agentId, projectId: env.projectId });
  }
  const impl = AGENCY_TOOLS[name];
  if (!schema || !impl) throw new Error(`Unknown tool "${name}".`);
  const bad = validateToolInput(schema, input);
  if (bad) throw new Error(bad);
  return impl(input);
}

interface LoopResult {
  submitted: { summary: string; deliverable: Record<string, unknown>; recommendations: string[]; handoffNotes: string } | null;
  fallbackText: string;
  thoughtProcess: string[];
  toolsInvoked: ToolInvocation[];
  steps: number;
  usage: { inputTokens: number; outputTokens: number };
}

async function runAgentLoop(
  agent: AgencyAgent,
  goal: string,
  shared: Record<string, unknown>,
  opts: { maxSteps: number; allowDelegate: boolean; depth: number },
): Promise<LoopResult> {
  const niche = typeof shared.niche === 'string' ? shared.niche : 'general';
  const projectId = typeof shared.projectId === 'string' ? shared.projectId : 'tubeos-global';
  let webSearch = WEB_SEARCH_DIVISIONS.has(agent.division);
  let delegations = 0;

  const env: LoopEnv = {
    projectId,
    agentId: agent.id,
    delegate: opts.allowDelegate
      ? async (id, task) => {
          if (delegations >= MAX_DELEGATIONS) throw new Error(`Delegation limit (${MAX_DELEGATIONS}) reached.`);
          const sub = AGENCY_AGENTS.find((a) => a.id === id);
          if (!sub) throw new Error(`Unknown agent "${id}".`);
          if (sub.id === agent.id || sub.number === 1) throw new Error('Cannot delegate to the orchestrator.');
          delegations++;
          const r = await runAgentLoop(sub, task, shared, { maxSteps: 4, allowDelegate: false, depth: opts.depth + 1 });
          return {
            agent: sub.name,
            summary: r.submitted?.summary ?? clip(r.fallbackText, 600),
            deliverable: r.submitted?.deliverable ?? {},
            toolsUsed: r.toolsInvoked.map((t) => t.toolName),
          };
        }
      : undefined,
  };

  const system = buildSystemPrompt(agent);
  const messages: LLMMessage[] = [
    {
      role: 'user',
      content: `Goal: ${goal}\nNiche: ${niche}\n\nTeam context (prior agent work, truncated):\n${buildTeamContext(shared)}`,
    },
  ];

  const thoughtProcess: string[] = [];
  const toolsInvoked: ToolInvocation[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let submitted: LoopResult['submitted'] = null;
  let fallbackText = '';
  let steps = 0;

  const deadline = (opts as { deadline?: number }).deadline ?? Date.now() + RUN_BUDGET_MS;
  for (let step = 0; step < opts.maxSteps; step++) {
    if (Date.now() > deadline) throw new LLMError(504, `Agent run exceeded its ${Math.round(RUN_BUDGET_MS / 1000)}s budget and was stopped.`);
    steps++;
    let resp;
    try {
      resp = await callClaude({ system, messages, tools: buildTools(agent, { allowDelegate: opts.allowDelegate, webSearch }) });
    } catch (err) {
      // Web search may not be enabled for this API org — retry once without it.
      if (err instanceof LLMError && err.status === 400 && webSearch && /web_search|tool/i.test(err.message)) {
        webSearch = false;
        thoughtProcess.push('Web search is unavailable for this API key; continuing without it.');
        resp = await callClaude({ system, messages, tools: buildTools(agent, { allowDelegate: opts.allowDelegate, webSearch }) });
      } else {
        throw err;
      }
    }

    usage.inputTokens += resp.usage?.input_tokens ?? 0;
    usage.outputTokens += resp.usage?.output_tokens ?? 0;
    messages.push({ role: 'assistant', content: resp.content });

    for (const block of resp.content) {
      if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
        thoughtProcess.push(block.text.trim().slice(0, 1500));
        fallbackText = block.text.trim();
      }
      if (block.type === 'server_tool_use' && block.name === 'web_search') {
        const q = (block.input as { query?: string } | undefined)?.query ?? '';
        toolsInvoked.push({ toolName: 'web_search', args: { query: q }, result: { status: 'searched' } });
        thoughtProcess.push(`Searching the web: "${q}"`);
      }
    }

    if (resp.stop_reason === 'pause_turn') continue; // server tool still running — resume as-is

    const toolUses = resp.content.filter((b): b is ContentBlock & { id: string; name: string; input: Record<string, unknown> } => b.type === 'tool_use');
    if (toolUses.length === 0) break; // model ended its turn without submitting

    const results: ContentBlock[] = [];
    for (const tu of toolUses) {
      if (tu.name === 'submit_deliverable') {
        const inp = tu.input ?? {};
        submitted = {
          summary: typeof inp.summary === 'string' ? inp.summary : '',
          deliverable: inp.deliverable && typeof inp.deliverable === 'object' ? (inp.deliverable as Record<string, unknown>) : {},
          recommendations: Array.isArray(inp.recommendations) ? inp.recommendations.filter((r): r is string => typeof r === 'string') : [],
          handoffNotes: typeof inp.handoff_notes === 'string' ? inp.handoff_notes : '',
        };
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Deliverable received.' });
        continue;
      }
      const started = Date.now();
      try {
        const out = await withTimeout(executeTool(tu.name, tu.input ?? {}, env), TOOL_TIMEOUT_MS, `Tool ${tu.name}`);
        toolsInvoked.push({ toolName: tu.name, args: tu.input, result: out, durationMs: Date.now() - started });
        thoughtProcess.push(`Called ${tu.name}(${clip(tu.input, 200)})`);
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: clip(out, MAX_TOOL_RESULT_CHARS) });
      } catch (err) {
        const msg = errMessage(err);
        toolsInvoked.push({ toolName: tu.name, args: tu.input, result: { error: msg }, durationMs: Date.now() - started, error: true });
        thoughtProcess.push(`Tool ${tu.name} failed: ${msg}`);
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: `Error: ${msg}`, is_error: true });
      }
    }

    if (submitted) break;
    if (step === opts.maxSteps - 2) {
      results.push({ type: 'text', text: 'You are almost out of steps. Call submit_deliverable now with your best work.' });
    }
    messages.push({ role: 'user', content: results });
  }

  return { submitted, fallbackText, thoughtProcess, toolsInvoked, steps, usage };
}

async function persist(agent: AgencyAgent, goal: string, shared: Record<string, unknown>, deliverable: Record<string, unknown>, startedAt: number, toolNames: string[]) {
  try {
    const db = getServiceClient();
    const projectId = typeof shared.projectId === 'string' ? shared.projectId : 'tubeos-global';
    await db.from('tubeos_executions').insert([
      {
        project_id: projectId,
        agent_id: agent.id,
        input_payload: { goal, niche: shared.niche ?? null },
        output_payload: deliverable,
        status: 'completed',
        started_at: new Date(startedAt).toISOString(),
        completed_at: new Date().toISOString(),
      },
    ]);
    await db.from('tubeos_vector_memory').insert([
      {
        project_id: projectId,
        agent_id: agent.id,
        content: `${agent.name}: ${clip(deliverable, 1500)}`,
        metadata: { division: agent.division, toolsUsed: toolNames },
        created_at: new Date().toISOString(),
      },
    ]);
  } catch {
    // Persistence is best-effort; never fail the run over it.
  }
}

async function runLiveAgent(agent: AgencyAgent, goal: string, shared: Record<string, unknown>): Promise<AgentExecutionOutput> {
  const startedAt = Date.now();
  // The orchestrator delegates when working alone; when the team has already run it synthesizes instead.
  const hasTeamWork = Boolean(shared.priorDeliverables && Object.keys(shared.priorDeliverables as object).length);
  const isOrchestrator = agent.number === 1;
  const allowDelegate = isOrchestrator && !hasTeamWork;
  const maxSteps = isOrchestrator ? 8 : 6;

  const r = await runAgentLoop(agent, goal, shared, { maxSteps, allowDelegate, depth: 0 });

  const deliverable: Record<string, unknown> = r.submitted
    ? {
        agent: agent.name,
        role: agent.role,
        summary: r.submitted.summary,
        deliverable: r.submitted.deliverable,
        recommendations: r.submitted.recommendations,
        handoffNotes: r.submitted.handoffNotes,
      }
    : {
        agent: agent.name,
        role: agent.role,
        summary: r.fallbackText || 'The agent ended without submitting a deliverable.',
        deliverable: {},
        recommendations: [],
        note: 'Agent did not call submit_deliverable; showing its last message.',
      };

  await persist(agent, goal, shared, deliverable, startedAt, r.toolsInvoked.map((t) => t.toolName));

  return {
    agentId: agent.id,
    agentName: agent.name,
    agentNumber: agent.number,
    division: agent.division,
    thoughtProcess: r.thoughtProcess,
    toolsInvoked: r.toolsInvoked,
    deliverable,
    executionDurationMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
    mode: 'live',
    model: DEFAULT_MODEL,
    steps: r.steps,
    usage: r.usage,
  };
}

/** Old canned behavior, kept only as an offline fallback and labelled as such. */
async function runSimulatedAgent(agent: AgencyAgent, goal: string, shared: Record<string, unknown>, notice: string): Promise<AgentExecutionOutput> {
  const startedAt = Date.now();
  const thoughtProcess = [`[simulated] Goal: "${goal}" for ${agent.name} (${agent.division}).`, `[simulated] Bound tools: ${agent.tools.join(', ')}.`];
  const toolsInvoked: ToolInvocation[] = [];
  for (const toolName of agent.tools) {
    const impl = AGENCY_TOOLS[toolName];
    if (!impl) continue;
    try {
      const args = { topic: goal, title: goal, niche: (shared.niche as string) || 'General', scriptText: goal, sceneCount: 5, monthlyViews: 500000, rpm: 7.2, hoursSincePublish: 48, views: 100000, voiceoverText: goal, minuteMarker: 3 };
      const result = await impl(args);
      toolsInvoked.push({ toolName, result });
    } catch {
      // ignore tool failures in simulated mode
    }
  }
  return {
    agentId: agent.id,
    agentName: agent.name,
    agentNumber: agent.number,
    division: agent.division,
    thoughtProcess,
    toolsInvoked,
    deliverable: {
      agent: agent.name,
      role: agent.role,
      summary: `Simulated output for "${goal}". No model was called.`,
      deliverable: toolsInvoked.length ? toolsInvoked[0].result : {},
      recommendations: [],
    },
    executionDurationMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
    mode: 'simulated',
    notice,
  };
}

export async function executeAgenticAgent(
  agentId: string,
  userGoal: string,
  sharedContext: Record<string, unknown> = {},
  opts: { live?: boolean } = {},
): Promise<AgentExecutionOutput> {
  const agent = AGENCY_AGENTS.find((a) => a.id === agentId);
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);
  if (opts.live !== false && isLiveAvailable()) return runLiveAgent(agent, userGoal, sharedContext);
  return runSimulatedAgent(agent, userGoal, sharedContext, 'Simulated run: no AI key (ANTHROPIC_API_KEY or GEMINI_API_KEY) is set on the server, so no model was called.');
}
