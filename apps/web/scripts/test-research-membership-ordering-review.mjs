// Synthetic ordering contract only. No provider, database or Production I/O.
import assert from 'node:assert/strict';
import { classifyResearchSubscriptionOrder } from '../src/lib/research-membership-ordering-review.js';

const oldAt = '2026-11-01T12:00:00.000Z';
const oldEnd = '2026-12-01T00:00:00.000Z';
const fresh = {
  eventKey: 'lemon-squeezy:sub-new',
  appliedEventKey: 'lemon-squeezy:sub-prior',
  objectType: 'subscriptions',
  occurredAt: '2026-11-02T12:00:00.000Z',
  appliedSubscriptionOccurredAt: oldAt,
  nextState: 'active',
  existingPeriodEnd: oldEnd,
  nextPeriodEnd: '2027-01-01T00:00:00.000Z',
  verifiedCurrentSubscriptionSnapshot: true,
};
const check = (name, patch, expected) => {
  const result = classifyResearchSubscriptionOrder({ ...fresh, ...patch });
  assert.equal(result.disposition, expected, name);
  assert.equal(result.canMutate, false, name + ': offline classification may not mutate access');
  assert.equal(Object.isFrozen(result), true, name + ': immutable decision');
};
check('O1 old payment failure subscription object', {
  occurredAt: '2026-10-30T12:00:00.000Z', nextState: 'past_due',
}, 'stale_ignored');
check('O4 old scheduled cancellation', {
  occurredAt: '2026-10-30T12:00:00.000Z', nextState: 'cancel_scheduled',
  nextPeriodEnd: '2026-11-15T00:00:00.000Z',
}, 'stale_ignored');
check('equal timestamp, different key', { occurredAt: oldAt }, 'ordering_conflict');
check('equal timestamp, same last key requires ledger duplicate verification', {
  occurredAt: oldAt, eventKey: fresh.appliedEventKey,
}, 'ordering_conflict');
check('verified newer renewal candidate only', {}, 'candidate_for_atomic_review');
check('verified newer legitimate payment failure candidate only', {
  nextState: 'past_due',
}, 'candidate_for_atomic_review');
check('verified newer terminal state candidate only', {
  nextState: 'refunded',
}, 'candidate_for_atomic_review');
for (const kind of ['subscription_payment_failed','subscription_payment_recovered','subscription_payment_refunded']) {
  check('invoice ' + kind + ' cannot independently mutate access', {
    objectType: 'subscription-invoices',
    occurredAt: '2027-02-02T00:00:00.000Z',
    nextState: kind === 'subscription_payment_refunded' ? 'refunded' : 'active',
  }, 'pending_reconciliation');
}
check('newer but unverified provider snapshot', {
  verifiedCurrentSubscriptionSnapshot: false,
}, 'pending_reconciliation');
check('null applied watermark cannot authorize first subscriber', {
  appliedSubscriptionOccurredAt: null,
}, 'pending_reconciliation');
check('missing signed timestamp cannot authorize', {
  occurredAt: null,
}, 'pending_reconciliation');
check('invalid ISO timestamp cannot authorize', {
  occurredAt: 'yesterday',
}, 'pending_reconciliation');
check('missing active paid period end', {
  nextPeriodEnd: null,
}, 'pending_reconciliation');
check('unverified old paid period', {
  existingPeriodEnd: 'not-a-time',
}, 'pending_reconciliation');
check('shortened renewed paid period', {
  nextPeriodEnd: '2026-11-15T00:00:00.000Z',
}, 'pending_reconciliation');
check('equal paid period may be candidate, not authorized', {
  nextPeriodEnd: oldEnd,
}, 'candidate_for_atomic_review');
for (const invalid of [{ eventKey: '' }, { objectType: 'orders' }]) {
  assert.throws(() => classifyResearchSubscriptionOrder({ ...fresh, ...invalid }), TypeError);
}
console.log('Research Membership ordering REVIEW-ONLY synthetic contract passed (no database-concurrency proof).');
