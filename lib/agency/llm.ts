// lib/agency/llm.ts
// Model client for The Agency (plain fetch — no SDK dependency). Server-only.
// Providers: Claude (ANTHROPIC_API_KEY) and a free open-source model through any OpenAI-compatible endpoint
// (default: Groq serving Llama; also works with OpenRouter free models, Together, a self-hosted vLLM, etc.).
//   OPEN_LLM_API_KEY, OPEN_LLM_BASE_URL (default https://api.groq.com/openai/v1), OPEN_LLM_MODEL (default llama-3.3-70b-versatile)
//   AGENCY_PROVIDER = auto (default) | anthropic | open
//   auto: Claude first; if Claude fails (rate limit, outage, billing) and an open-model key exists, retry there.
// The runner speaks Anthropic's message format; open-model calls are translated here so agents work the same on either.
// Note: Claude's built-in web_search is Anthropic-only; on the open model agents run without it.

const API_URL = 'https://api.anthropic.com/v1/messages';
export const DEFAULT_MODEL = process.env.AGENCY_MODEL || process.env.TUBEOS_MODEL || 'claude-sonnet-5-5';

export type ContentBlock = { type: string; [key: string]: unknown };

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface LLMTool {
  name: string;
  type?: string; // present for Anthropic server tools such as web_search
  description?: string;
  input_schema?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LLMResponse {
  content: ContentBlock[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

export type FailureKind = 'TRANSIENT_PROVIDER_ERROR' | 'AUTH_ERROR' | 'INVALID_REQUEST' | 'TIMEOUT' | 'MODEL_ERROR' | 'APPLICATION_ERROR';

export class LLMError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
  }
  get kind(): FailureKind {
    if (this.status === 504 || this.status === 408) return 'TIMEOUT';
    if (this.status === 401 || this.status === 403) return 'AUTH_ERROR';
    if (this.status === 400 || this.status === 404 || this.status === 422) return 'INVALID_REQUEST';
    if (this.status === 429 || this.status === 529 || this.status >= 500) return 'TRANSIENT_PROVIDER_ERROR';
    return 'MODEL_ERROR';
  }
  get retryable(): boolean {
    return this.kind === 'TRANSIENT_PROVIDER_ERROR' || this.kind === 'TIMEOUT';
  }
}

/** Per-request ceiling so a stalled provider can never hang an agent. */
export const REQUEST_TIMEOUT_MS = Number(process.env.AGENCY_REQUEST_TIMEOUT_MS) || 45_000;
const MAX_ATTEMPTS = 4;

async function timedFetch(url: string, init: RequestInit, label: string): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new LLMError(504, `${label} did not respond within ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s.`);
    throw new LLMError(503, `${label} connection failed: ${e instanceof Error ? e.message : 'network error'}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Exponential backoff with jitter: ~1s, 2s, 4s (capped), only for transient failures. */
function backoff(attempt: number): Promise<void> {
  return sleep(Math.min(8000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 400));
}

export const OPEN_MODEL = process.env.OPEN_LLM_MODEL || 'llama-3.3-70b-versatile';
const openBase = () => (process.env.OPEN_LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
function openKey(): string | undefined {
  return process.env.OPEN_LLM_API_KEY || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY || undefined;
}

/** Real Anthropic keys start with "sk-ant-"; a placeholder would only 401 and waste time on every call. */
function looksLikeAnthropicKey(k?: string): boolean {
  return Boolean(k && /^sk-ant-/.test(k.trim()));
}

export function isLiveAvailable(): boolean {
  return Boolean(looksLikeAnthropicKey(process.env.ANTHROPIC_API_KEY) || openKey());
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface LLMCallParams {
  system: string;
  messages: LLMMessage[];
  tools: LLMTool[];
  maxTokens?: number;
  model?: string;
}

// Entry point used by the agent runner (name kept for compatibility): routes to Claude or the open model.
export async function callClaude(params: LLMCallParams): Promise<LLMResponse> {
  const mode = (process.env.AGENCY_PROVIDER || 'auto').toLowerCase();
  const hasClaude = looksLikeAnthropicKey(process.env.ANTHROPIC_API_KEY);
  const hasOpen = Boolean(openKey());

  if (mode === 'open') return callOpen(params);
  if (mode === 'anthropic') return callAnthropic(params);
  if (!hasClaude && hasOpen) return callOpen(params);
  if (!hasClaude) throw new LLMError(500, 'No AI key set: add ANTHROPIC_API_KEY and/or OPEN_LLM_API_KEY on the server.');
  try {
    return await callAnthropic(params);
  } catch (err) {
    // Fall back to the open model on outages / rate limits / billing / auth. A 400 is a request bug, handled by the runner.
    if (hasOpen && err instanceof LLMError && err.status !== 400) return callOpen(params);
    throw err;
  }
}

function stripForAnthropic(messages: LLMMessage[]): LLMMessage[] {
  return messages.map((m) =>
    typeof m.content === 'string'
      ? m
      : { ...m, content: m.content.map((b) => { const { thought_signature: _t, ...rest } = b as ContentBlock; void _t; return rest; }) },
  );
}

async function callAnthropic(params: LLMCallParams): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new LLMError(500, 'ANTHROPIC_API_KEY is not set on the server.');

  const body = JSON.stringify({
    model: params.model || DEFAULT_MODEL,
    max_tokens: params.maxTokens ?? 2500,
    system: params.system,
    messages: stripForAnthropic(params.messages),
    ...(params.tools.length ? { tools: params.tools } : {}),
  });

  let lastErr: LLMError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await timedFetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body,
      }, 'Anthropic');
      if (res.ok) return (await res.json()) as LLMResponse;
      lastErr = new LLMError(res.status, `Anthropic API ${res.status}: ${(await res.text()).slice(0, 600)}`);
    } catch (e) {
      if (!(e instanceof LLMError)) throw e;
      lastErr = e;
    }
    if (!lastErr.retryable) break;
    if (attempt < MAX_ATTEMPTS - 1) await backoff(attempt);
  }
  throw lastErr as LLMError;
}

// ───────────────────────── Open-source model (OpenAI-compatible) ─────────────────────────

type Json = Record<string, unknown>;

function toOpenMessages(system: string, messages: LLMMessage[]): Json[] {
  const out: Json[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    if (m.role === 'assistant') {
      const text = m.content.filter((b) => b.type === 'text').map((b) => String(b.text ?? '')).join('\n');
      const calls = m.content.filter((b) => b.type === 'tool_use').map((b) => ({ id: String(b.id), type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      out.push({ role: 'assistant', content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      const text = m.content.filter((b) => b.type === 'text').map((b) => String(b.text ?? '')).join('\n');
      for (const b of m.content) if (b.type === 'tool_result') out.push({ role: 'tool', tool_call_id: String(b.tool_use_id), content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) });
      if (text) out.push({ role: 'user', content: text });
    }
  }
  return out;
}

async function callOpen(params: LLMCallParams): Promise<LLMResponse> {
  const apiKey = openKey();
  if (!apiKey) throw new LLMError(500, 'OPEN_LLM_API_KEY is not set on the server.');
  const tools = params.tools.filter((t) => t.input_schema).map((t) => ({ type: 'function', function: { name: t.name, description: t.description ?? '', parameters: t.input_schema } }));
  const body = JSON.stringify({
    model: process.env.OPEN_LLM_MODEL || OPEN_MODEL,
    messages: toOpenMessages(params.system, params.messages),
    max_tokens: params.maxTokens ?? 2500,
    ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
  });
  let lastErr: LLMError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await timedFetch(`${openBase()}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body }, 'Open model');
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        const ch = data.choices?.[0];
        if (!ch?.message) throw new LLMError(502, 'The open model returned no message.');
        const content: ContentBlock[] = [];
        if (ch.message.content) content.push({ type: 'text', text: ch.message.content });
        for (const tc of ch.message.tool_calls ?? []) {
          let input: Json = {};
          try { input = JSON.parse(tc.function.arguments || '{}') as Json; } catch { /* leave empty; the tool reports missing args */ }
          content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
        }
        return { content, stop_reason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : ch.finish_reason === 'length' ? 'max_tokens' : 'end_turn', usage: { input_tokens: data.usage?.prompt_tokens ?? 0, output_tokens: data.usage?.completion_tokens ?? 0 } };
      }
      lastErr = new LLMError(res.status, `Open model API ${res.status}: ${(await res.text()).slice(0, 600)}`);
    } catch (e) {
      if (!(e instanceof LLMError)) throw e;
      lastErr = e;
    }
    if (!lastErr.retryable) break;
    if (attempt < MAX_ATTEMPTS - 1) await backoff(attempt);
  }
  throw lastErr as LLMError;
}
