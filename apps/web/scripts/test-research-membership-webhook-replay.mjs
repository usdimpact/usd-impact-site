import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { buildResearchMembershipMutationPlan } from '../src/lib/research-membership-event-adapter.js';
import { normalizeResearchMembershipLifecycleEvent } from '../src/lib/research-membership-runtime.js';
import { prepareLemonSqueezyResearchMembershipTransition } from '../src/lib/lemon-squeezy-research-membership-adapter.js';
import { processResearchMembershipWebhook, publicResearchMembershipWebhookError } from '../src/lib/research-membership-webhook-handler.js';

// All credentials and identities below are inert, in-memory fixtures. fetchImpl
// never opens a socket; it models only the existing PostgREST/RPC interface.
const accountId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const environment = {
  VERCEL_ENV: 'preview',
  RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_MODE: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET: 'offline-only-replay-test-signing-key',
  LEMON_SQUEEZY_RESEARCH_TEST_STORE_ID: '42',
  LEMON_SQUEEZY_RESEARCH_TEST_PRODUCT_ID: '99',
  LEMON_SQUEEZY_RESEARCH_TEST_MONTHLY_VARIANT_ID: '314',
  LEMON_SQUEEZY_RESEARCH_TEST_ANNUAL_VARIANT_ID: '315',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_offline_only_not_a_real_key',
};
const base = {
  id: subscriptionId, accountId, productId: 'research-membership',
  provider: 'lemon-squeezy', providerSubscriptionId: 'sub_fixture', state: 'active',
  currentPeriodStart: '2026-09-01T00:00:00.000Z',
  currentPeriodEnd: '2026-10-01T00:00:00.000Z', cancelAtPeriodEnd: false,
};
const payload = () => ({
  meta: { event_name: 'subscription_updated', custom_data: { usd_impact_account_id: accountId } },
  data: { type: 'subscriptions', id: 'sub_fixture', attributes: {
    store_id: 42, product_id: 99, variant_id: 314, test_mode: true,
    status: 'active', cancelled: false, ends_at: null,
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:01.000Z',
    renews_at: '2026-11-01T00:00:00.000Z',
  } },
});
function signed(value, subscription = base) {
  const rawBody = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  const secret = environment.LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET;
  return { rawBody, signature: crypto.createHmac('sha256', secret).update(rawBody).digest('hex'),
    secret, existingSubscription: subscription, expectedStoreId: 42,
    expectedProductId: 99, expectedVariantIds: [314, 315], expectedTestMode: true };
}
function archived(value = payload(), subscription = base) {
  const plan = prepareLemonSqueezyResearchMembershipTransition(signed(value, subscription));
  const e = plan.eventInsert;
  return {
    event_key: plan.eventKey, subscription_id: subscriptionId, account_id: accountId,
    product_id: 'research-membership', provider_event_id: e.providerEventId,
    from_state: e.fromState, to_state: e.toState, reason: e.reason,
    actor_type: 'provider_webhook', occurred_at: e.occurredAt, metadata: { ...e.metadata },
  };
}
function fixture({ state = 'active', rows = [], ledgerReplies, rpcReply, subscriptionReply } = {}) {
  const originalLibrary = Object.freeze({ product_id: 'read-the-dollar-first-guided-interactive-edition', state: 'active' });
  const ctx = { current: { ...base, state }, rows: structuredClone(rows), calls: [], writes: [], ledgerReads: 0, library: originalLibrary };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
  ctx.fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    assert.equal(u.origin, environment.SUPABASE_URL, 'only the scoped mock database is permitted');
    assert.equal(init.headers.apikey, environment.SUPABASE_SECRET_KEY);
    ctx.calls.push({ path: u.pathname, method: init.method || 'GET' });
    if (u.pathname === '/rest/v1/subscriptions') {
      assert.equal(init.method || 'GET', 'GET');
      assert.equal(u.searchParams.get('provider'), 'eq.lemon-squeezy');
      assert.equal(u.searchParams.get('product_id'), 'eq.research-membership');
      assert.equal(u.searchParams.get('provider_subscription_id'), 'eq.sub_fixture');
      if (subscriptionReply) return subscriptionReply(ctx, json);
      const s = ctx.current;
      return json([{ id: s.id, account_id: s.accountId, product_id: s.productId,
        provider: s.provider, provider_subscription_id: s.providerSubscriptionId, state: s.state,
        current_period_start: s.currentPeriodStart, current_period_end: s.currentPeriodEnd,
        cancel_at_period_end: s.cancelAtPeriodEnd }]);
    }
    if (u.pathname === '/rest/v1/subscription_events') {
      assert.equal(init.method || 'GET', 'GET');
      assert.equal(u.searchParams.get('limit'), '2');
      assert.equal(u.searchParams.has('account_id'), false, 'do not hide key collisions with an account filter');
      assert.equal(u.searchParams.has('subscription_id'), false, 'do not hide key collisions with a subscription filter');
      const key = u.searchParams.get('event_key');
      assert.ok(key?.startsWith('eq.lemon-squeezy:'));
      ctx.ledgerReads += 1;
      if (ledgerReplies) return ledgerReplies(ctx, json, key.slice(3));
      return json(ctx.rows.filter((r) => r.event_key === key.slice(3)));
    }
    assert.equal(u.pathname, '/rest/v1/rpc/apply_research_membership_transition', 'no other surface may be accessed');
    assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    assert.equal(body.p_subscription_id, subscriptionId);
    assert.equal(body.p_expected_provider, 'lemon-squeezy');
    assert.equal(body.p_expected_provider_subscription_id, 'sub_fixture');
    if (rpcReply) return rpcReply(ctx, json, body);
    if (ctx.rows.some((r) => r.event_key === body.p_event_key)) return json({ action: 'duplicate', event_key: body.p_event_key });
    if (body.p_expected_from_state !== ctx.current.state) return json({ code: 'P0001', message: 'subscription state drift' }, 400);
    ctx.writes.push(body);
    ctx.current.state = body.p_to_state;
    ctx.current.currentPeriodStart = body.p_current_period_start;
    ctx.current.currentPeriodEnd = body.p_current_period_end;
    ctx.rows.push({ event_key: body.p_event_key, subscription_id: subscriptionId, account_id: accountId,
      product_id: 'research-membership', provider_event_id: body.p_provider_event_id,
      from_state: body.p_expected_from_state, to_state: body.p_to_state, reason: body.p_reason,
      actor_type: 'provider_webhook', occurred_at: body.p_occurred_at, metadata: body.p_metadata });
    return json({ action: 'applied', event_key: body.p_event_key });
  };
  ctx.run = (value = payload(), overrides = {}) => processResearchMembershipWebhook({
    ...signed(value), environment, fetchImpl: ctx.fetchImpl, ...overrides,
  });
  ctx.assertReadOnly = () => {
    assert.equal(ctx.writes.length, 0);
    assert.ok(ctx.calls.every((c) => c.method === 'GET'));
    assert.equal(ctx.library, originalLibrary);
  };
  return ctx;
}
const canonicalEvent = {
  provider: 'lemon-squeezy', providerEventId: 'evt_fixture', providerSubscriptionId: 'sub_fixture',
  eventType: 'subscription.renewed', occurredAt: '2026-10-01T00:00:01.000Z',
  currentPeriodStart: '2026-10-01T00:00:00.000Z', currentPeriodEnd: '2026-11-01T00:00:00.000Z',
};
const canonicalKey = 'lemon-squeezy:evt_fixture';
for (const state of ['active', 'past_due', 'cancel_scheduled', 'disputed', 'cancelled', 'refunded', 'charged_back']) {
  await test(`canonical processed renewal after ${state}`, () => {
    const plan = buildResearchMembershipMutationPlan({ providerEvent: canonicalEvent,
      existingSubscription: { ...base, state }, processedEventKeys: [canonicalKey] });
    assert.equal(plan.action, 'duplicate');
    assert.equal(plan.subscriptionPatch, null);
    assert.equal(plan.entitlementPatch, null);
    assert.equal(plan.eventInsert, null);
  });
}
for (const state of ['cancelled', 'refunded', 'charged_back']) {
  await test(`new canonical renewal after ${state} remains rejected`, () => {
    assert.throws(() => buildResearchMembershipMutationPlan({ providerEvent: canonicalEvent,
      existingSubscription: { ...base, state } }), { code: 'RESEARCH_MEMBERSHIP_INVALID_TRANSITION' });
    assert.throws(() => normalizeResearchMembershipLifecycleEvent({ ...canonicalEvent, accountId, currentState: state }),
      { code: 'RESEARCH_MEMBERSHIP_INVALID_TRANSITION' });
  });
}
for (const state of ['active', 'past_due', 'cancel_scheduled', 'disputed', 'cancelled', 'refunded', 'charged_back']) {
  await test(`persisted renewal replay after ${state} is a read-only duplicate`, async () => {
    const ctx = fixture({ state, rows: [archived()] });
    const before = structuredClone(ctx.current);
    assert.equal((await ctx.run()).action, 'duplicate');
    ctx.assertReadOnly();
    assert.equal(ctx.ledgerReads, 1);
    assert.deepEqual(ctx.current, before);
  });
}
await test('initial event is persisted once; replay after terminal transition never calls RPC', async () => {
  const ctx = fixture();
  assert.equal((await ctx.run()).action, 'applied');
  assert.equal(ctx.writes.length, 1);
  assert.match(ctx.rows[0].metadata.replayFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(ctx.rows[0].metadata.replayFingerprintVersion, 1);
  ctx.current.state = 'cancelled';
  const rpcCalls = ctx.calls.filter((c) => c.method === 'POST').length;
  assert.equal((await ctx.run()).action, 'duplicate');
  assert.equal(ctx.calls.filter((c) => c.method === 'POST').length, rpcCalls);
  assert.equal(ctx.writes.length, 1);
  assert.equal(ctx.current.state, 'cancelled');
});
await test('existing pre-fingerprint ledger row matches only its stored evidence', async () => {
  const row = archived();
  delete row.metadata.replayFingerprint;
  delete row.metadata.replayFingerprintVersion;
  const ctx = fixture({ state: 'cancelled', rows: [row] });
  assert.equal((await ctx.run()).action, 'duplicate');
  ctx.assertReadOnly();
});
for (const state of ['cancelled', 'refunded', 'charged_back']) {
  await test(`genuinely new webhook after ${state} stays rejected`, async () => {
    const ctx = fixture({ state });
    await assert.rejects(() => ctx.run(), { code: 'RESEARCH_MEMBERSHIP_INVALID_TRANSITION' });
    ctx.assertReadOnly();
  });
}
for (const [field, bad] of [
  ['subscription_id', '33333333-3333-4333-8333-333333333333'],
  ['account_id', '33333333-3333-4333-8333-333333333333'], ['product_id', 'library-pass'],
  ['provider_event_id', 'wrong-event'], ['reason', 'subscription.payment_failed'],
  ['actor_type', 'admin'], ['to_state', 'past_due'], ['from_state', 'refunded'],
  ['occurred_at', '2026-10-02T00:00:00.000Z'],
]) {
  await test(`persisted ${field} mismatch is not acknowledged`, async () => {
    const row = archived(); row[field] = bad;
    const ctx = fixture({ state: 'cancelled', rows: [row] });
    await assert.rejects(() => ctx.run(), { code: 'RESEARCH_WEBHOOK_REPLAY_CONFLICT', status: 409 });
    ctx.assertReadOnly();
  });
}
for (const field of ['lemonEventName', 'lemonDataType', 'lemonDataId', 'lemonStatus', 'lemonBillingReason', 'testMode']) {
  await test(`persisted metadata ${field} mismatch is rejected`, async () => {
    const row = archived(); row.metadata[field] = 'wrong';
    const ctx = fixture({ state: 'cancelled', rows: [row] });
    await assert.rejects(() => ctx.run(), { code: 'RESEARCH_WEBHOOK_REPLAY_CONFLICT' });
    ctx.assertReadOnly();
  });
}
for (const edit of ['period', 'trusted-variant', 'created-at']) {
  await test(`same event identity with changed ${edit} conflicts with fingerprint`, async () => {
    const value = payload();
    if (edit === 'period') value.data.attributes.renews_at = '2026-12-01T00:00:00.000Z';
    if (edit === 'trusted-variant') value.data.attributes.variant_id = 315;
    if (edit === 'created-at') value.data.attributes.created_at = '2026-09-02T00:00:00.000Z';
    const ctx = fixture({ state: 'cancelled', rows: [archived()] });
    await assert.rejects(() => ctx.run(value), { code: 'RESEARCH_WEBHOOK_REPLAY_CONFLICT' });
    ctx.assertReadOnly();
  });
}
await test('equivalent signed JSON formatting and unrelated delivery fields are not conflicts', async () => {
  const value = payload(); value.data.attributes.urls = { customer_portal: 'https://example.invalid/new-delivery-link' };
  const ctx = fixture({ state: 'cancelled', rows: [archived()] });
  assert.equal((await ctx.run(JSON.stringify(value, null, 2))).action, 'duplicate');
  ctx.assertReadOnly();
});
for (const [label, mutate] of [
  ['store', (v) => { v.data.attributes.store_id = 43; }],
  ['product', (v) => { v.data.attributes.product_id = 100; }],
  ['variant', (v) => { v.data.attributes.variant_id = 999; }],
  ['mode', (v) => { v.data.attributes.test_mode = false; }],
  ['account', (v) => { v.meta.custom_data.usd_impact_account_id = '33333333-3333-4333-8333-333333333333'; }],
  ['unsupported-event', (v) => { v.meta.event_name = 'subscription_payment_refunded'; }],
  ['event-object-mismatch', (v) => { v.meta.event_name = 'subscription_payment_failed'; }],
  ['array-attributes', (v) => { v.data.attributes = []; }],
]) {
  await test(`invalid signed ${label} cannot use duplicate fast path`, async () => {
    const value = payload(); mutate(value);
    const ctx = fixture({ rows: [archived()] });
    await assert.rejects(() => ctx.run(value));
    assert.equal(ctx.ledgerReads, 0);
    ctx.assertReadOnly();
  });
}
await test('signature rejection occurs before any database access', async () => {
  const ctx = fixture();
  await assert.rejects(() => ctx.run(payload(), { signature: '0'.repeat(64) }), { code: 'RESEARCH_WEBHOOK_SIGNATURE_INVALID' });
  assert.equal(ctx.calls.length, 0);
});
await test('invalid JSON, missing object and excessive body reject before any database access', async () => {
  for (const value of ['{', '{}', 'x'.repeat(1024 * 1024 + 1)]) {
    const ctx = fixture(); await assert.rejects(() => ctx.run(value)); assert.equal(ctx.calls.length, 0);
  }
});
for (const body of [null, {}, [{}, {}]]) {
  await test(`malformed or ambiguous ledger result ${JSON.stringify(body)} fails closed`, async () => {
    const ctx = fixture({ ledgerReplies: (_c, json) => json(body) });
    await assert.rejects(() => ctx.run()); ctx.assertReadOnly();
  });
}
await test('ledger read error is not treated as event absence', async () => {
  const ctx = fixture({ ledgerReplies: (_c, json) => json({ message: 'internal details' }, 503) });
  await assert.rejects(() => ctx.run(), (error) => {
    assert.equal(error.code, 'RESEARCH_WEBHOOK_EVENT_LOOKUP_FAILED');
    assert.equal(publicResearchMembershipWebhookError(error).status, 502);
    assert.doesNotMatch(JSON.stringify(publicResearchMembershipWebhookError(error)), /internal details/);
    return true;
  }); ctx.assertReadOnly();
});
await test('ambiguous subscription and Library Pass bindings reject before ledger lookup', async () => {
  for (const body of [[], [{}, {}], [{ id: subscriptionId, account_id: accountId, product_id: 'library-pass', provider: 'lemon-squeezy', provider_subscription_id: 'sub_fixture' }]]) {
    const ctx = fixture({ subscriptionReply: (_c, json) => json(body) });
    await assert.rejects(() => ctx.run()); assert.equal(ctx.ledgerReads, 0); ctx.assertReadOnly();
  }
});
await test('concurrent matching RPC duplicate is validated against committed evidence', async () => {
  const ctx = fixture({ rpcReply: (c, json) => { c.rows.push(archived()); return json({ action: 'duplicate' }); } });
  assert.equal((await ctx.run()).action, 'duplicate');
  assert.equal(ctx.ledgerReads, 2); assert.equal(ctx.writes.length, 0);
  assert.equal(ctx.calls.filter((c) => c.method === 'POST').length, 1);
});
await test('concurrent conflicting RPC duplicate is rejected after persisted comparison', async () => {
  const ctx = fixture({ rpcReply: (c, json) => {
    const row = archived(); row.metadata.replayFingerprint = '0'.repeat(64); c.rows.push(row);
    return json({ action: 'duplicate' });
  } });
  await assert.rejects(() => ctx.run(), { code: 'RESEARCH_WEBHOOK_REPLAY_CONFLICT' });
  assert.equal(ctx.writes.length, 0);
});
await test('RPC duplicate without persisted evidence is not acknowledged', async () => {
  const ctx = fixture({ rpcReply: (_c, json) => json({ action: 'duplicate' }) });
  await assert.rejects(() => ctx.run(), { code: 'RESEARCH_WEBHOOK_REPLAY_CONFLICT' });
  assert.equal(ctx.writes.length, 0);
});
await test('terminal-state validation race performs one read recheck, never replays a write', async () => {
  const ctx = fixture({ state: 'cancelled', ledgerReplies: (c, json) => json(c.ledgerReads === 1 ? [] : [archived()]) });
  assert.equal((await ctx.run()).action, 'duplicate');
  assert.equal(ctx.ledgerReads, 2); ctx.assertReadOnly();
});
await test('uncertain RPC result is reconciled by a read, without a second RPC', async () => {
  const ctx = fixture({ rpcReply: (c) => { c.rows.push(archived()); throw new Error('connection interrupted'); } });
  assert.equal((await ctx.run()).action, 'duplicate');
  assert.equal(ctx.calls.filter((c) => c.method === 'POST').length, 1);
  assert.equal(ctx.writes.length, 0);
});
await test('unrelated RPC failure remains an error when no committed matching event exists', async () => {
  const ctx = fixture({ rpcReply: (_c, json) => json({ code: 'P0001', message: 'subscription state drift' }, 400) });
  await assert.rejects(() => ctx.run(), { code: 'P0001' });
  assert.equal(ctx.calls.filter((c) => c.method === 'POST').length, 1);
});
await test('Production approval and Preview database isolation remain mandatory', async () => {
  for (const override of [{ VERCEL_ENV: 'production' }, { SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co' }, { RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'false' }, { LEMON_SQUEEZY_RESEARCH_TEST_MODE: 'false' }]) {
    const ctx = fixture();
    await assert.rejects(() => ctx.run(payload(), { environment: { ...environment, ...override } }));
    assert.equal(ctx.calls.length, 0);
  }
});
for (const [label, subscription, providerEvent] of [
  ['provider', base, { ...canonicalEvent, provider: 'other-provider' }],
  ['subscription', base, { ...canonicalEvent, providerSubscriptionId: 'sub_other' }],
  ['product', { ...base, productId: 'library-pass' }, canonicalEvent],
  ['account', { ...base, accountId: 'invalid' }, canonicalEvent],
  ['state', { ...base, state: 'unknown' }, canonicalEvent],
  ['timestamp', base, { ...canonicalEvent, occurredAt: 'invalid' }],
  ['metadata', base, { ...canonicalEvent, metadata: [] }],
  ['period', base, { ...canonicalEvent, currentPeriodEnd: '2026-09-01T00:00:00.000Z' }],
]) {
  await test(`known canonical event key does not bypass ${label} validation`, () => {
    assert.throws(() => buildResearchMembershipMutationPlan({ existingSubscription: subscription,
      providerEvent, processedEventKeys: [canonicalKey, 'other-provider:evt_fixture'] }));
  });
}
for (const metadataEdit of [
  (m) => { m.replayFingerprintVersion = 2; },
  (m) => { m.replayFingerprint = null; },
  (m) => { delete m.replayFingerprintVersion; },
  (m) => { delete m.replayFingerprint; },
]) {
  await test('malformed new fingerprint evidence cannot fall back to legacy acceptance', async () => {
    const row = archived(); metadataEdit(row.metadata);
    const ctx = fixture({ state: 'cancelled', rows: [row] });
    await assert.rejects(() => ctx.run(), { code: 'RESEARCH_WEBHOOK_REPLAY_CONFLICT' }); ctx.assertReadOnly();
  });
}
for (const [eventName, fromState, attributes] of [
  ['subscription_created', 'pending', {}],
  ['subscription_cancelled', 'active', { status: 'cancelled', cancelled: true, renews_at: null, ends_at: '2026-11-01T00:00:00.000Z' }],
  ['subscription_resumed', 'cancel_scheduled', {}],
  ['subscription_expired', 'cancel_scheduled', { status: 'expired', cancelled: true, renews_at: null, ends_at: '2026-11-01T00:00:00.000Z' }],
  ['subscription_payment_failed', 'active', { status: 'pending' }],
  ['subscription_payment_recovered', 'past_due', { status: 'paid' }],
  ['subscription_payment_success', 'past_due', { status: 'paid' }],
]) {
  for (const legacy of [false, true]) {
    await test(`${legacy ? 'legacy' : 'fingerprinted'} ${eventName} replay after cancellation`, async () => {
      const value = payload(); value.meta.event_name = eventName;
      Object.assign(value.data.attributes, attributes);
      if (eventName.startsWith('subscription_payment_')) {
        value.data.type = 'subscription-invoices'; value.data.id = 'invoice_fixture';
        value.data.attributes.subscription_id = 'sub_fixture'; value.data.attributes.billing_reason = 'renewal';
      }
      const row = archived(value, { ...base, state: fromState });
      if (legacy) { delete row.metadata.replayFingerprint; delete row.metadata.replayFingerprintVersion; }
      const ctx = fixture({ state: 'cancelled', rows: [row] });
      assert.equal((await ctx.run(value)).action, 'duplicate'); ctx.assertReadOnly();
    });
  }
}
await test('ordinary payment success remains ignored, without persisting a fake renewal', async () => {
  const value = payload(); value.meta.event_name = 'subscription_payment_success';
  value.data.type = 'subscription-invoices'; value.data.id = 'invoice_fixture';
  value.data.attributes.subscription_id = 'sub_fixture'; value.data.attributes.status = 'paid';
  const ctx = fixture(); assert.equal((await ctx.run(value)).action, 'ignored'); ctx.assertReadOnly();
});
await test('legacy evidence missing required fields is rejected rather than guessed', async () => {
  const row = archived(); row.metadata = { lemonEventName: 'subscription_updated' };
  const ctx = fixture({ state: 'cancelled', rows: [row] });
  await assert.rejects(() => ctx.run(), { code: 'RESEARCH_WEBHOOK_REPLAY_CONFLICT' }); ctx.assertReadOnly();
});
await test('later billing periods do not contaminate duplicate classification', async () => {
  const ctx = fixture({ state: 'cancelled', rows: [archived()] });
  ctx.current.currentPeriodStart = '2027-05-01T00:00:00.000Z';
  ctx.current.currentPeriodEnd = '2027-06-01T00:00:00.000Z';
  assert.equal((await ctx.run()).action, 'duplicate'); ctx.assertReadOnly();
});
