import test from 'node:test';
import assert from 'node:assert/strict';
process.env.CRON_SECRET = 'unit-test-secret';
import { resolveIdentity, validTokenShape, checkState, makeState, explain } from '../lib/agency/linkedin';
import { publishLinkedIn } from '../lib/agency/publish';

const real = globalThis.fetch;
const j = (status: number, body: object, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

test('member ID is resolved from /v2/userinfo', async () => {
  globalThis.fetch = (async () => j(200, { sub: 'abc123XYZ', name: 'Jevon A' })) as typeof fetch;
  const r = await resolveIdentity('t'.repeat(30));
  assert.equal(r.ok, true); assert.equal(r.urn, 'urn:li:person:abc123XYZ'); assert.equal(r.name, 'Jevon A');
});
test('falls back to /v2/me when userinfo is not permitted', async () => {
  globalThis.fetch = (async (u: unknown) => (String(u).includes('userinfo') ? j(403, { message: 'denied' }) : j(200, { id: 'mem42abc' }))) as typeof fetch;
  assert.equal((await resolveIdentity('t'.repeat(30))).urn, 'urn:li:person:mem42abc');
});
test('403 on both endpoints names the exact missing scopes', async () => {
  globalThis.fetch = (async () => j(403, { message: 'Not enough permissions' })) as typeof fetch;
  const r = await resolveIdentity('t'.repeat(30));
  assert.equal(r.ok, false); assert.match(r.advice!, /openid profile w_member_social/);
});
test('401 is reported as expired/invalid token', async () => {
  globalThis.fetch = (async () => j(401, { message: 'Invalid access token' })) as typeof fetch;
  assert.match((await resolveIdentity('t'.repeat(30))).advice!, /expired|invalid/i);
});
test('input that is a shell command or multiline is rejected before saving', () => {
  assert.equal(validTokenShape('cd ~/Downloads/"my team" && bash scripts/x.sh'), false);
  assert.equal(validTokenShape('abc\ndef'.padEnd(40, 'x')), false);
  assert.equal(validTokenShape('AQX'.padEnd(120, 'a')), true);
});
test('OAuth state is verified and expires', () => {
  assert.equal(checkState(makeState()), true);
  assert.equal(checkState('zz.' + 'a'.repeat(32)), false);
  assert.equal(checkState(null), false);
});
test('publish returns the exact LinkedIn error on failure and the post id on success', async () => {
  globalThis.fetch = (async () => j(422, { message: 'Author urn invalid' })) as typeof fetch;
  const bad = await publishLinkedIn('hi', { token: 't', urn: 'urn:li:person:x' });
  assert.equal(bad.published, false); assert.match((bad as { reason: string }).reason, /LinkedIn 422: Author urn invalid/);
  globalThis.fetch = (async () => j(201, {}, { 'x-restli-id': 'urn:li:share:123' })) as typeof fetch;
  const good = await publishLinkedIn('hi', { token: 't', urn: 'urn:li:person:x' });
  assert.equal(good.published, true);
});
test('explain handles unreachable network', () => assert.match(explain([{ endpoint: '/v2/me', status: 0, message: '' }]), /could not be reached/));
test.after(() => { globalThis.fetch = real; });
