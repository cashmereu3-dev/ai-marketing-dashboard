// lib/agency/llm.ts
// Minimal Anthropic Messages API client (plain fetch — no SDK dependency). Server-only.

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

export function isLiveAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callClaude(params: {
  system: string;
  messages: LLMMessage[];
  tools: LLMTool[];
  maxTokens?: number;
  model?: string;
}): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new LLMError(500, 'ANTHROPIC_API_KEY is not set on the server.');

  const body = JSON.stringify({
    model: params.model || DEFAULT_MODEL,
    max_tokens: params.maxTokens ?? 2500,
    system: params.system,
    messages: params.messages,
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
