// lib/agency/llm.ts
// Model client for The Agency (plain fetch — no SDK dependency). Server-only.
// Providers: Claude (ANTHROPIC_API_KEY) and Google Gemini (GEMINI_API_KEY or GOOGLE_API_KEY).
// All agents share both keys. The runner speaks Anthropic's message format; Gemini calls are
// translated to/from it here so agents work identically on either provider.
//   AGENCY_PROVIDER = auto (default) | anthropic | gemini
//   auto: Claude first; if Claude fails (rate limit, outage, billing) and a Gemini key exists, retry on Gemini.
// Note: Claude's built-in web_search is Anthropic-only; on Gemini agents run without it.

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

export class LLMError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
  }
}

export const GEMINI_MODEL = process.env.AGENCY_GEMINI_MODEL || 'gemini-3.8-flash';

function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function isLiveAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || geminiKey());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LLMCallParams {
  system: string;
  messages: LLMMessage[];
  tools: LLMTool[];
  maxTokens?: number;
  model?: string;
}

// Entry point used by the agent runner (name kept for compatibility): routes to Claude or Gemini.
export async function callClaude(params: LLMCallParams): Promise<LLMResponse> {
  const mode = (process.env.AGENCY_PROVIDER || 'auto').toLowerCase();
  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasGemini = Boolean(geminiKey());

  if (mode === 'gemini') return callGemini(params);
  if (mode === 'anthropic') return callAnthropic(params);
  if (!hasClaude && hasGemini) return callGemini(params);
  if (!hasClaude) throw new LLMError(500, 'No AI key set: add ANTHROPIC_API_KEY and/or GEMINI_API_KEY on the server.');
  try {
    return await callAnthropic(params);
  } catch (err) {
    // Fall back to Gemini on outages / rate limits / billing / auth. A 400 is a request bug (or web_search
    // not enabled), which the runner handles itself, so it is not retried here.
    if (hasGemini && err instanceof LLMError && err.status !== 400) return callGemini(params);
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
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });
    if (res.ok) return (await res.json()) as LLMResponse;

    const text = (await res.text()).slice(0, 600);
    lastErr = new LLMError(res.status, `Anthropic API ${res.status}: ${text}`);
    const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
    if (!retryable) break;
    await sleep(1000 * 2 ** attempt);
  }
  throw lastErr as LLMError;
}

// ───────────────────────── Google Gemini ─────────────────────────

type Json = Record<string, unknown>;

// Gemini accepts an OpenAPI-style subset of JSON Schema; drop what it rejects.
function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== 'object') return node;
  const out: Json = {};
  for (const [k, v] of Object.entries(node as Json)) {
    if (['additionalProperties', '$schema', '$id', '$ref', 'default', 'examples', 'title'].includes(k)) continue;
    if (k === 'type' && Array.isArray(v)) {
      const t = v.find((x) => x !== 'null');
      out.type = t ?? 'string';
      if (v.includes('null')) out.nullable = true;
      continue;
    }
    if (k === 'enum' && Array.isArray(v)) { out.enum = v.map(String); continue; }
    out[k] = toGeminiSchema(v);
  }
  return out;
}

function toGeminiContents(messages: LLMMessage[]): Json[] {
  const nameById = new Map<string, string>();
  const contents: Json[] = [];
  for (const m of messages) {
    if (typeof m.content === 'string') {
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
      continue;
    }
    const parts: Json[] = [];
    for (const b of m.content) {
      if (b.type === 'text' && typeof b.text === 'string') {
        if (b.text) parts.push({ text: b.text });
      } else if (b.type === 'tool_use') {
        nameById.set(String(b.id), String(b.name));
        const part: Json = { functionCall: { name: b.name, args: (b.input as Json) ?? {} } };
        if (typeof b.thought_signature === 'string') part.thoughtSignature = b.thought_signature;
        parts.push(part);
      } else if (b.type === 'tool_result') {
        const name = nameById.get(String(b.tool_use_id)) ?? 'tool';
        const raw = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
        parts.push({ functionResponse: { name, response: b.is_error ? { error: raw } : { result: raw } } });
      }
      // server_tool_use / web_search_tool_result blocks are Anthropic-only and are skipped.
    }
    if (parts.length) contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts });
  }
  return contents;
}

async function callGemini(params: LLMCallParams): Promise<LLMResponse> {
  const apiKey = geminiKey();
  if (!apiKey) throw new LLMError(500, 'GEMINI_API_KEY is not set on the server.');
  const model = process.env.AGENCY_GEMINI_MODEL || GEMINI_MODEL;

  const declarations = params.tools
    .filter((t) => t.input_schema) // server tools (web_search) have no schema and are Claude-only
    .map((t) => ({ name: t.name, description: t.description ?? '', parameters: toGeminiSchema(t.input_schema) }));

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: params.system }] },
    contents: toGeminiContents(params.messages),
    ...(declarations.length ? { tools: [{ functionDeclarations: declarations }] } : {}),
    generationConfig: { maxOutputTokens: params.maxTokens ?? 2500 },
  });

  let lastErr: LLMError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body,
    });
    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: Json[] }; finishReason?: string }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        promptFeedback?: { blockReason?: string };
      };
      const cand = data.candidates?.[0];
      if (!cand) throw new LLMError(502, `Gemini returned no candidates${data.promptFeedback?.blockReason ? ` (blocked: ${data.promptFeedback.blockReason})` : ''}.`);
      const content: ContentBlock[] = [];
      let n = 0;
      for (const part of cand.content?.parts ?? []) {
        if (typeof part.text === 'string' && part.thought !== true) {
          content.push({ type: 'text', text: part.text });
        } else if (part.functionCall && typeof part.functionCall === 'object') {
          const fc = part.functionCall as { name: string; args?: Json };
          const block: ContentBlock = { type: 'tool_use', id: `gem_${Date.now().toString(36)}_${n++}`, name: fc.name, input: fc.args ?? {} };
          if (typeof part.thoughtSignature === 'string') block.thought_signature = part.thoughtSignature;
          content.push(block);
        }
      }
      return {
        content,
        stop_reason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : cand.finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn',
        usage: { input_tokens: data.usageMetadata?.promptTokenCount ?? 0, output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0 },
      };
    }
    const text = (await res.text()).slice(0, 600);
    lastErr = new LLMError(res.status, `Gemini API ${res.status}: ${text}`);
    if (!(res.status === 429 || res.status >= 500)) break;
    await sleep(1000 * 2 ** attempt);
  }
  throw lastErr as LLMError;
}
