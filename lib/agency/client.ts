// lib/agency/client.ts
// Browser-side helpers: call the protected /api/agency/agent route with the user's Supabase session.
import { supabase } from '../supabase';
import { AGENCY_AGENTS } from './agentRegistry';
import type { AgentExecutionOutput } from './types';

export type { AgentExecutionOutput } from './types';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class AgentRunError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function runAgent(agentId: string, goal: string, sharedContext: Record<string, unknown> = {}): Promise<AgentExecutionOutput> {
  const res = await fetch('/api/agency/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ agentId, goal, sharedContext }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AgentRunError(res.status, (body as { error?: string }).error || `Agent run failed (${res.status}).`);
  }
  return (await res.json()) as AgentExecutionOutput;
}

function summarize(out: AgentExecutionOutput): string {
  const d = out.deliverable as { summary?: string; deliverable?: unknown };
  const body = d.deliverable && Object.keys(d.deliverable as object).length ? JSON.stringify(d.deliverable) : '';
  return `${d.summary ?? ''} ${body}`.trim().slice(0, 600);
}

/**
 * Runs the specialists (all of them, or just one division) in order (each sees earlier agents' work), then the Executive
 * Orchestrator last to synthesize. One request per agent keeps each call within serverless limits.
 */
export function getTeamAgents(division?: string): typeof AGENCY_AGENTS {
  const scoped = !division || division === 'All' ? AGENCY_AGENTS : AGENCY_AGENTS.filter((a) => a.division === division);
  const orchestrator = AGENCY_AGENTS.find((a) => a.number === 1);
  const specialists = scoped.filter((a) => a.number !== 1);
  return orchestrator ? [...specialists, orchestrator] : specialists;
}

export async function runEntireTeam(
  topic: string,
  niche: string,
  onAgentComplete?: (result: AgentExecutionOutput, index: number, total: number) => void,
  shouldStop?: () => boolean,
  division?: string,
): Promise<AgentExecutionOutput[]> {
  const ordered = getTeamAgents(division);
  const projectId = `agency-${Date.now()}`;
  const priorDeliverables: Record<string, string> = {};
  const results: AgentExecutionOutput[] = [];

  for (let i = 0; i < ordered.length; i++) {
    if (shouldStop?.()) break;
    const agent = ordered[i];
    let out: AgentExecutionOutput;
    try {
      out = await runAgent(agent.id, topic, { topic, niche, projectId, priorDeliverables });
    } catch (err) {
      if (err instanceof AgentRunError && (err.status === 401 || err.status === 403)) throw err; // stop the whole run
      const message = err instanceof Error ? err.message : 'Agent run failed.';
      out = {
        agentId: agent.id,
        agentName: agent.name,
        agentNumber: agent.number,
        division: agent.division,
        thoughtProcess: [`Run failed: ${message}`],
        toolsInvoked: [],
        deliverable: { agent: agent.name, summary: `Failed: ${message}`, deliverable: {}, recommendations: [], failed: true },
        executionDurationMs: 0,
        timestamp: new Date().toISOString(),
        mode: 'live',
      };
    }
    results.push(out);
    if (!(out.deliverable as { failed?: boolean }).failed) priorDeliverables[agent.id] = summarize(out);
    onAgentComplete?.(out, i + 1, ordered.length);
  }
  return results;
}
