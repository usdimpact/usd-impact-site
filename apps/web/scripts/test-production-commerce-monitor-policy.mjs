import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FREE_CORE_PUBLIC_RELEASE_COMMITTED, NEW_LIBRARY_PASS_SALES_PAUSED } from '../src/lib/learning-offer-commerce-policy.js';
import { LIBRARY_SALES_PAUSED_MESSAGE, libraryPassCommerceMonitorFailures } from './production-commerce-monitor-policy.mjs';

// Offline only: synthetic public response, no provider credentials, fetch or
// payment calls. Source-committed pause remains the authoritative expectation.
const sourcePaused = NEW_LIBRARY_PASS_SALES_PAUSED || FREE_CORE_PUBLIC_RELEASE_COMMITTED;
assert.equal(sourcePaused, true, 'The current approved source enforces a new-Library-sales stop.');
const paused = Object.freeze({
  state: 'blocked',
  checkoutEnabled: false,
  message: LIBRARY_SALES_PAUSED_MESSAGE,
});
assert.deepEqual(libraryPassCommerceMonitorFailures(paused, sourcePaused), []);

const invalidPaused = [
  [{ ...paused, state: 'active' }, /must remain blocked/],
  [{ ...paused, state: 'error' }, /must remain blocked/],
  [{ ...paused, checkoutEnabled: true }, /remain disabled/],
  [{ ...paused, checkoutEnabled: undefined }, /remain disabled/],
  [{ ...paused, message: 'Provider configuration unavailable.' }, /source-approved/],
  [{ ...paused, message: '' }, /source-approved/],
  [{ ...paused, message: undefined }, /source-approved/],
  [{ state: 'blocked', checkoutEnabled: false }, /source-approved/],
];
for (const [body, expected] of invalidPaused) {
  const failures = libraryPassCommerceMonitorFailures(body, true);
  assert.ok(failures.some(text => expected.test(text)), 'The paused-state negative fixture must fail closed.');
}
for (const bad of [undefined, null, [], false, 'blocked', 1]) {
  assert.ok(libraryPassCommerceMonitorFailures(bad, true).length > 0);
}

const previouslyApprovedLive = Object.freeze({
  state: 'active',
  checkoutEnabled: true,
  message: 'Verified controlled-Live checkout.',
});
assert.deepEqual(libraryPassCommerceMonitorFailures(previouslyApprovedLive, false), []);
for (const body of [
  { ...previouslyApprovedLive, state: 'blocked' },
  { ...previouslyApprovedLive, checkoutEnabled: false },
]) {
  assert.ok(libraryPassCommerceMonitorFailures(body, false).length > 0,
    'A separately approved Live mode must retain active purchase readiness.');
}
for (const badFlag of [undefined, null, 'true', 1]) {
  assert.ok(libraryPassCommerceMonitorFailures(paused, badFlag).length > 0);
}
assert.equal(NEW_LIBRARY_PASS_SALES_PAUSED, true, 'Do not enable new sales during monitor remediation.');
assert.equal(FREE_CORE_PUBLIC_RELEASE_COMMITTED, false, 'Do not claim a public free-core launch.');
// Contract proof: the scheduled monitor really consumes the source-committed
// flag and this tested helper. A pure-helper test must not silently pass if a
// later refactor reintroduces the obsolete hardcoded 'active' expectation.
const monitorSource = readFileSync(new URL('./check-production-security-posture.mjs', import.meta.url), 'utf8');
assert.match(monitorSource, /libraryPassCommerceMonitorFailures\(commerce, librarySalesPaused\)/);
assert.match(monitorSource, /NEW_LIBRARY_PASS_SALES_PAUSED\s*\|\|\s*FREE_CORE_PUBLIC_RELEASE_COMMITTED/);
assert.match(monitorSource, /verifySecurityHeaders\(readiness, 'Commerce readiness'\)/);
assert.match(monitorSource, /commerce\?\.providerConfigured !== true/);
assert.match(monitorSource, /commerce\?\.disclosuresComplete !== true/);
assert.doesNotMatch(monitorSource, /commerce\?\.state !== 'active'/);
console.log('Production security monitor Library Pass pause: 8 paused negative cases, 2 Live negative cases, 4 invalid flag cases and 6 integration assertions PASS.');
