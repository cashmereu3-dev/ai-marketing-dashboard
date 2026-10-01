// Deterministic provider-failure tests (no network). Run: npx tsx --test tests/llm.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AGENCY_PROVIDER = 'open';
process.env.OPEN_LLM_API_KEY = 'test-key';
process.env.AGENCY_REQUEST_TIMEOUT_MS = '80';

const realFetch = globalThis.fetch;
const params = { system: 's', messages: [{ role: 'user' as const, content: 'hi' }], tools: [] };
const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }], usage: {} }), { status: 200 });
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

test('a placeholder Anthropic key is ignored (goes straight to the open model)', async () => {
  process.env.AGENCY_PROVIDER = 'auto';
  process.env.ANTHROPIC_API_KEY = 'apikey_placeholder';
  const { callClaude } = await import('../lib/agency/llm');
  const urls: string[] = [];
  globalThis.fetch = (async (u: unknown) => { urls.push(String(u)); return ok(); }) as typeof fetch;
  await callClaude(params);
  assert.ok(urls.every((u) => u.includes('/chat/completions')));
  process.env.AGENCY_PROVIDER = 'open'; delete process.env.ANTHROPIC_API_KEY;
});

test('Claude outage falls back to the open model', async () => {
  process.env.AGENCY_PROVIDER = 'auto';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  const { callClaude } = await import('../lib/agency/llm');
  globalThis.fetch = (async (u: unknown) => (String(u).includes('anthropic.com') ? err(529) : ok())) as typeof fetch;
  const r = await callClaude(params);
  assert.equal(r.content[0].text, 'hello');
  process.env.AGENCY_PROVIDER = 'open'; delete process.env.ANTHROPIC_API_KEY;
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

test('tool calls round-trip: tools are sent, tool_calls come back as tool_use, results are sent as tool messages', async () => {
  const { callClaude } = await import('../lib/agency/llm');
  let sent: any;
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 'c1', function: { name: 't', arguments: '{"title":"x"}' } }] }, finish_reason: 'tool_calls' }], usage: {} }), { status: 200 });
  }) as typeof fetch;
  const r = await callClaude({ ...params, tools: [{ name: 't', input_schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } }] });
  assert.equal(sent.tools[0].function.name, 't');
  assert.equal(r.stop_reason, 'tool_use');
  assert.deepEqual(r.content[0].input, { title: 'x' });
  await callClaude({ ...params, messages: [...params.messages, { role: 'assistant', content: r.content }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'done' }] }] });
  assert.ok(sent.messages.some((m: any) => m.role === 'tool' && m.tool_call_id === 'c1'));
});

test.after(() => { globalThis.fetch = realFetch; });
