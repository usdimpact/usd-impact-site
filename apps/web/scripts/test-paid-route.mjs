import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PAID_CONTENT_PREFIX,
  buildPaidAccessRequiredRedirect,
  buildPaidSignInRedirect,
  decidePaidRouteAccess,
  isPaidContentPath,
  normalizePaidAccessReason,
} from '../src/lib/paid-route.js';

const protectedUrl = new URL('https://preview.example/guided-edition/chapter-1/?section=yield-curve');

assert.equal(PAID_CONTENT_PREFIX, '/guided-edition');
assert.equal(isPaidContentPath('/guided-edition'), true);
assert.equal(isPaidContentPath('/guided-edition/'), true);
assert.equal(isPaidContentPath('/guided-edition/chapter-1'), true);
assert.equal(isPaidContentPath('/guided-edition-download'), false);
assert.equal(isPaidContentPath('/book/read-the-dollar-first/'), false);

const signIn = buildPaidSignInRedirect(protectedUrl);
assert.equal(signIn.pathname, '/account/sign-in/');
assert.equal(signIn.searchParams.get('next'), '/guided-edition/chapter-1/?section=yield-curve');

const anonymous = decidePaidRouteAccess({
  requestUrl: protectedUrl,
  hasSession: false,
  accessState: null,
});
assert.equal(anonymous.action, 'redirect');
assert.equal(anonymous.reason, 'authentication-required');
assert.equal(new URL(anonymous.location).pathname, '/account/sign-in/');
assert.equal(new URL(anonymous.location).searchParams.get('next'), '/guided-edition/chapter-1/?section=yield-curve');

const active = decidePaidRouteAccess({
  requestUrl: protectedUrl,
  hasSession: true,
  accessState: { allowed: true, reason: 'active' },
});
assert.deepEqual(active, { action: 'allow', reason: 'active', location: null });

for (const reason of [
  'missing',
  'missing-profile',
  'wrong-product',
  'suspended',
  'suspended_dispute',
  'refunded',
  'charged_back',
  'revoked',
  'account_deleted',
  'deletion_pending',
  'deleted',
  'disabled',
  'expired',
  'not-started',
  'malformed',
  'unknown-state',
  'invalid-window',
]) {
  assert.equal(normalizePaidAccessReason(reason), reason);
  const decision = decidePaidRouteAccess({
    requestUrl: protectedUrl,
    hasSession: true,
    accessState: { allowed: false, reason },
  });
  assert.equal(decision.action, 'redirect');
  assert.equal(decision.reason, reason);
  const destination = new URL(decision.location);
  assert.equal(destination.pathname, '/account/access-required/');
  assert.equal(destination.searchParams.get('reason'), reason);
  assert.equal(destination.searchParams.get('next'), '/guided-edition/chapter-1/?section=yield-curve');
}

assert.equal(normalizePaidAccessReason('unexpected-provider-state'), 'denied');
const unavailable = buildPaidAccessRequiredRedirect(protectedUrl, 'unexpected-provider-state');
assert.equal(unavailable.searchParams.get('reason'), 'denied');

const middleware = await readFile(new URL('../middleware.js', import.meta.url), 'utf8');
assert.match(middleware, /'\/guided-edition\/:path\*'/);
assert.match(middleware, /readSessionAccessToken\(request\)/);
assert.match(middleware, /readAccountAccessState\(\{ accessToken \}\)/);
assert.match(middleware, /isPaidContentPath\(url\.pathname\)/);
assert.match(middleware, /Paid-route authorization failed closed/);
assert.doesNotMatch(middleware, /localStorage|sessionStorage/);

const signInPage = await readFile(
  new URL('../src/pages/account/sign-in/index.astro', import.meta.url),
  'utf8',
);
assert.match(signInPage, /new URLSearchParams\(window\.location\.search\)\.get\('next'\)/);
assert.match(signInPage, /parsed\.origin !== window\.location\.origin/);
assert.match(signInPage, /nextInput\.value = safeNextPath\(requestedNext\)/);
assert.doesNotMatch(signInPage, /Astro\.url\.searchParams\.get\('next'\)/);

const accessRequiredPage = await readFile(
  new URL('../src/pages/account/access-required/index.astro', import.meta.url),
  'utf8',
);
assert.match(accessRequiredPage, /Browser state, email possession alone, and a checkout redirect do not grant access/);
assert.match(accessRequiredPage, /const reason = params\.get\('reason'\) \|\| 'missing'/);
assert.match(accessRequiredPage, /const next = safeNextPath\(params\.get\('next'\)\)/);
assert.match(accessRequiredPage, /messages\[reason\] \|\| messages\.denied/);
assert.doesNotMatch(accessRequiredPage, /Astro\.url\.searchParams/);

const protectedPage = await readFile(
  new URL('../src/pages/guided-edition/index.astro', import.meta.url),
  'utf8',
);
assert.match(protectedPage, /durable Supabase entitlement/);

console.log('Protected paid-route tests passed.');
