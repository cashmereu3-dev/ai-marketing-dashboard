// Deterministic provider-failure tests (no network). Run: npx tsx --test tests/llm.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AGENCY_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'test-key';
process.env.AGENCY_REQUEST_TIMEOUT_MS = '80';

const realFetch = globalThis.fetch;
const params = { system: 's', messages: [{ role: 'user' as const, content: 'hi' }], tools: [] };
const ok = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hello' }] }, finishReason: 'STOP' }], usageMetadata: {} }), { status: 200 });
const err = (status: number) => new Response(JSON.stringify({ error: { message: 'x' } }), { status });

test('503 is retried with backoff and then succeeds', async () => {
  const { callClaude } = await import('../lib/agency/llm');
  let calls = 0;
  globalThis.fetch = (async () => (++calls < 3 ? err(503) : ok())) as typeof fetch;
  const r = await callClaude(params);
  assert.equal(calls, 3);
  assert.equal(r.content[0].text, 'hello');
});

test('persistent 503 gives up after a sane maximum and is classified transient', async () => {
  const { callClaude, LLMError } = await import('../lib/agency/llm');
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return err(503); }) as typeof fetch;
  await assert.rejects(callClaude(params), (e: unknown) => e instanceof LLMError && e.kind === 'TRANSIENT_PROVIDER_ERROR' && e.retryable);
  assert.equal(calls, 4);
});

test('a stalled provider times out instead of hanging', async () => {
  const { callClaude, LLMError } = await import('../lib/agency/llm');
  globalThis.fetch = ((_u: unknown, init?: RequestInit) => new Promise((_res, rej) => {
    init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  })) as typeof fetch;
  await assert.rejects(callClaude(params), (e: unknown) => e instanceof LLMError && e.kind === 'TIMEOUT');
});

test('a 400 is permanent and is not retried', async () => {
  const { callClaude, LLMError } = await import('../lib/agency/llm');
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return err(400); }) as typeof fetch;
  await assert.rejects(callClaude(params), (e: unknown) => e instanceof LLMError && e.kind === 'INVALID_REQUEST' && !e.retryable);
  assert.equal(calls, 1);
});

test('tool schemas keep a property named "title" (regression for the Gemini 400)', async () => {
  const { callClaude } = await import('../lib/agency/llm');
  let sent: any;
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => { sent = JSON.parse(String(init?.body)); return ok(); }) as typeof fetch;
  await callClaude({ ...params, tools: [{ name: 't', input_schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } }] });
  const p = sent.tools[0].functionDeclarations[0].parameters;
  assert.ok('title' in p.properties);
  assert.deepEqual(p.required, ['title']);
});

test.after(() => { globalThis.fetch = realFetch; });
