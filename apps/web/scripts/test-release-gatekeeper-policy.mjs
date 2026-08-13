import assert from 'node:assert/strict';
import { evaluateReleaseGatekeeper } from './release-gatekeeper-policy.mjs';

const head = 'a'.repeat(40);
const greenQuality = { status: 'completed', conclusion: 'success' };
const verifiedGates = {
  vercelProductionEnvironment: true,
  commerceProviderLive: true,
  paddleLive: true,
  productionDataPlane: true,
  checkoutClosed: true,
  protectedProduction: true,
};

const openDraft = {
  state: 'open',
  draft: true,
  merged: false,
  merged_at: null,
  base: { ref: 'main' },
  head: { sha: head },
};

const merged = {
  state: 'closed',
  draft: false,
  merged: true,
  merged_at: '2026-08-13T00:00:00Z',
  base: { ref: 'main' },
  head: { sha: head },
};

const evaluate = (overrides = {}) => evaluateReleaseGatekeeper({
  mode: 'production-promotion',
  pr: openDraft,
  expectedHead: head,
  quality: greenQuality,
  gates: verifiedGates,
  ...overrides,
});

assert.equal(evaluate().approved, true, 'Production promotion should approve with exact-head non-commerce gates verified');
assert.equal(
  evaluate({ gates: { ...verifiedGates, commerceProviderLive: false, paddleLive: false } }).approved,
  true,
  'Production promotion must not depend on live commerce-provider approval while checkout is CLOSED',
);

for (const [key, message] of [
  ['vercelProductionEnvironment', 'Vercel Production environment gate is not verified'],
  ['productionDataPlane', 'Production data-plane gate is not verified'],
  ['checkoutClosed', 'Checkout CLOSED gate is not verified'],
]) {
  const result = evaluate({ gates: { ...verifiedGates, [key]: false } });
  assert.equal(result.approved, false, `${key} must fail closed`);
  assert.ok(result.failures.includes(message));
}

assert.equal(evaluate({ expectedHead: 'b'.repeat(40) }).approved, false, 'Head mismatch must block approval');
assert.equal(
  evaluate({ quality: { status: 'completed', conclusion: 'failure' } }).approved,
  false,
  'Failed exact-head quality must block approval',
);
assert.equal(evaluate({ quality: null }).approved, false, 'Missing exact-head quality must block approval');
assert.equal(
  evaluate({ pr: { ...openDraft, draft: false } }).approved,
  false,
  'Production promotion requires Draft PR state',
);
assert.equal(
  evaluate({ pr: merged }).approved,
  false,
  'Production promotion must not approve an already merged PR',
);

const checkoutApproved = evaluate({
  mode: 'checkout-enable',
  pr: merged,
  gates: verifiedGates,
});
assert.equal(checkoutApproved.approved, true, 'Checkout approval requires merged PR, live provider, and protected Production verification');

const checkoutWithoutProvider = evaluate({
  mode: 'checkout-enable',
  pr: merged,
  gates: { ...verifiedGates, commerceProviderLive: false, paddleLive: false },
});
assert.equal(checkoutWithoutProvider.approved, false, 'Checkout approval must fail without a verified live commerce provider');
assert.ok(checkoutWithoutProvider.failures.includes('Live commerce-provider gate is not verified'));

const paddleBackwardCompatibility = evaluate({
  mode: 'checkout-enable',
  pr: merged,
  gates: { ...verifiedGates, commerceProviderLive: undefined, paddleLive: true },
});
assert.equal(paddleBackwardCompatibility.approved, true, 'Existing Paddle evidence remains accepted during provider-neutral migration');

const checkoutWithoutProtected = evaluate({
  mode: 'checkout-enable',
  pr: merged,
  gates: { ...verifiedGates, protectedProduction: false },
});
assert.equal(checkoutWithoutProtected.approved, false, 'Checkout approval must fail without protected Production verification');
assert.ok(
  checkoutWithoutProtected.failures.includes('Protected Production verification is required before checkout approval'),
);

assert.equal(
  evaluate({ mode: 'checkout-enable', pr: openDraft }).approved,
  false,
  'Checkout approval must not approve before merge',
);
assert.equal(
  evaluate({ mode: 'unsupported' }).approved,
  false,
  'Unknown approval modes must fail closed',
);

console.log('Release gatekeeper provider-neutral fail-closed policy tests passed.');
