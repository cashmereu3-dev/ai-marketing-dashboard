import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateCheck, pickCategory, quoteStatus, sanitizeQuoteCfg, type QuoteEntry, type QuoteCfg } from '../lib/agency/quoteAgents';
import { localParts } from '../lib/agency/schedule';

const cfg: QuoteCfg = { id: 'wisdom_quote_master', name: 'W', platform: 'facebook', brand: 'visions4u', enabled: true, autonomous: true, time: '06:00', tz: 'America/Chicago', postsPerDay: 1, tone: 't', categories: ['A', 'B', 'C', 'D'] };
const e = (o: Partial<QuoteEntry>): QuoteEntry => ({ id: 'x', agentId: cfg.id, at: new Date().toISOString(), day: '2026-01-01', platform: 'facebook', category: 'A', topic: 't', quote: 'Patience is the quiet engine of every lasting thing', attribution: 'original', source: 'original', post: 'Patience is the quiet engine of every lasting thing.\nWhat are you building?', status: 'published', attempts: 1, ...o });

test('exact and near duplicates are rejected', () => {
  assert.equal(duplicateCheck({ quote: 'Patience is the quiet engine of every lasting thing', post: 'x y z', attribution: 'original', category: 'B' }, [e({})]).duplicate, true);
  assert.equal(duplicateCheck({ quote: 'Patience is the quiet engine of lasting things', post: 'other words here entirely different', attribution: 'original', category: 'B' }, [e({})]).duplicate, true);
});
test('same category as previous post is rejected, different original passes', () => {
  assert.equal(duplicateCheck({ quote: 'Boundaries are how love stays honest', post: 'Boundaries are how love stays honest. Say the true thing kindly.', attribution: 'original', category: 'A' }, [e({})]).duplicate, true);
  assert.equal(duplicateCheck({ quote: 'Boundaries are how love stays honest', post: 'Boundaries are how love stays honest. Say the true thing kindly.', attribution: 'original', category: 'B' }, [e({})]).duplicate, false);
});
test('category rotation skips recent categories', () => {
  const hist = [e({ category: 'A' }), e({ category: 'B' })];
  for (let i = 0; i < 50; i++) assert.ok(['C', 'D'].includes(pickCategory(cfg, hist, Math.random)));
});
test('6:00 AM Central holds across DST (CDT = UTC-5, CST = UTC-6)', () => {
  const summer = new Date('2026-07-01T11:00:00Z'), winter = new Date('2026-12-01T12:00:00Z');
  assert.equal(localParts(summer, 'America/Chicago').minutes, 360);
  assert.equal(localParts(winter, 'America/Chicago').minutes, 360);
  assert.equal(quoteStatus(cfg, [], new Date('2026-07-01T10:59:00Z')).due, false);
  assert.equal(quoteStatus(cfg, [], new Date('2026-07-01T11:00:00Z')).due, true);
  assert.equal(quoteStatus(cfg, [], new Date('2026-12-01T11:59:00Z')).due, false);
  assert.equal(quoteStatus(cfg, [], new Date('2026-12-01T12:00:00Z')).due, true);
});
test('a published post today means not due again (no double posting)', () => {
  const now = new Date('2026-07-01T14:00:00Z');
  const day = localParts(now, 'America/Chicago').day;
  assert.equal(quoteStatus(cfg, [e({ day, status: 'published' })], now).due, false);
  assert.equal(quoteStatus(cfg, [e({ day, status: 'publishing' })], now).due, false);
});
test('config is sanitized', () => {
  const c = sanitizeQuoteCfg({ time: '25:99', postsPerDay: 99, tz: 'Not/AZone' } as never, cfg);
  assert.equal(c.time, '06:00'); assert.equal(c.postsPerDay, 3); assert.equal(c.tz, 'America/Chicago');
});
