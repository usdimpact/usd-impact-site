import assert from 'node:assert/strict';
import {
  PAID_PRODUCT_ID,
  ENTITLEMENT_STATES,
  authorizePaidAccess,
} from '../src/lib/paid-access.js';
import { decidePaidRouteAccess } from '../src/lib/paid-route.js';
import {
  FREE_CORE_PUBLIC_RELEASE_COMMITTED,
  NEW_LIBRARY_PASS_SALES_PAUSED,
  LEARNING_OFFER_MODE_KEY,
  resolveLearningOfferCommercePolicyForRelease,
} from '../src/lib/learning-offer-commerce-policy.js';

const now = Date.UTC(2026, 10, 2, 12, 0, 0);
const start = new Date(now - 86400000).toISOString();
const original = Object.freeze({
  id: 'synthetic-purchased-library-1',
  accountId: 'synthetic-purchaser-1',
  productId: PAID_PRODUCT_ID,
  state: ENTITLEMENT_STATES.ACTIVE,
  startsAt: start,
  endsAt: null,
  version: 1,
  updatedAt: start,
});
const baseline = JSON.stringify(original);
const url = 'https://preview.example/guided-edition/chapter-1/';

assert.equal(FREE_CORE_PUBLIC_RELEASE_COMMITTED, false, 'Free protected media release remains uncommitted.');
assert.equal(NEW_LIBRARY_PASS_SALES_PAUSED, true, 'New sales pause must preserve historic access.');
const cases = [
  [{}, false],
  [{ [LEARNING_OFFER_MODE_KEY]: 'legacy' }, false],
  [{ [LEARNING_OFFER_MODE_KEY]: 'free' }, false],
  [{ [LEARNING_OFFER_MODE_KEY]: 'paid' }, false],
  [{}, true],
  [{ [LEARNING_OFFER_MODE_KEY]: 'legacy' }, true],
  [{ [LEARNING_OFFER_MODE_KEY]: 'free' }, true],
  [{ [LEARNING_OFFER_MODE_KEY]: 'paid' }, true],
  [{ [LEARNING_OFFER_MODE_KEY]: 'BROKEN' }, true],
];

for (const [environment, freeCommitted] of cases) {
  const policy = resolveLearningOfferCommercePolicyForRelease(environment, freeCommitted);
  assert.equal(typeof policy.allowNewLibraryCheckout, 'boolean');
  const purchaser = authorizePaidAccess(original, PAID_PRODUCT_ID, now);
  assert.equal(purchaser.allowed, true, 'Already-purchased entitlement must not depend on offer policy.');
  assert.deepEqual(
    decidePaidRouteAccess({
      requestUrl: url,
      hasSession: true,
      accessState: { allowed: purchaser.allowed, reason: purchaser.reason },
    }),
    { action: 'allow', reason: 'active', location: null },
  );
  const stranger = authorizePaidAccess(null, PAID_PRODUCT_ID, now);
  assert.equal(stranger.allowed, false);
  const denied = decidePaidRouteAccess({
    requestUrl: url,
    hasSession: true,
    accessState: { allowed: false, reason: stranger.reason },
  });
  assert.equal(denied.action, 'redirect', 'Missing entitlement still denies protected legacy content.');
  assert.equal(new URL(denied.location).pathname, '/account/access-required/');
  const anonymous = decidePaidRouteAccess({ requestUrl: url, hasSession: false, accessState: null });
  assert.equal(anonymous.action, 'redirect');
  assert.equal(new URL(anonymous.location).pathname, '/account/sign-in/');
  for (const state of [
    ENTITLEMENT_STATES.REFUNDED,
    ENTITLEMENT_STATES.REVOKED,
    ENTITLEMENT_STATES.SUSPENDED,
    ENTITLEMENT_STATES.ACCOUNT_DELETED,
  ]) {
    assert.equal(authorizePaidAccess({ ...original, state }, PAID_PRODUCT_ID, now).allowed, false);
  }
  assert.equal(JSON.stringify(original), baseline, 'No legacy entitlement mutation permitted.');
}

console.log('Synthetic legacy-buyer entitlement and protected-route policy invariants passed.');