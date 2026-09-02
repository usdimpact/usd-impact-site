import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PAID_CONTENT_PREFIX,
  buildPaidAccessRequiredRedirect,
  buildPaidSignInRedirect,
  decidePaidRouteAccess,
  isPaidContentPath,
  normalizePaidAccessReason,
  readPaidAccessFromAccountApi,
} from '../src/lib/paid-route.js';

const protectedUrl = new URL('https://preview.example/guided-edition/chapter-1/?section=yield-curve');
const response = (status, body) => new Response(body == null ? '' : JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.test-access-token-that-is-long-enough.signature';

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

const anonymousApi = await readPaidAccessFromAccountApi({
  requestUrl: protectedUrl,
  accessToken: '',
  fetchImpl: async (url, options) => {
    assert.equal(url.toString(), 'https://preview.example/api/account-access');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cache, 'no-store');
    return response(401, { code: 'AUTHENTICATION_REQUIRED' });
  },
});
assert.deepEqual(anonymousApi, { hasSession: false, accessState: null });

const unpaidApi = await readPaidAccessFromAccountApi({
  requestUrl: protectedUrl,
  accessToken,
  fetchImpl: async (url, options) => {
    assert.equal(url.toString(), 'https://preview.example/api/account-access');
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    return response(200, {
      account: { id: 'account-id', email: 'reader@example.com', status: 'active' },
      paidAccess: { allowed: false, reason: 'missing', productId: null, state: null },
    });
  },
});
assert.deepEqual(unpaidApi, {
  hasSession: true,
  accessState: { allowed: false, reason: 'missing', productId: null, state: null },
});

const activeApi = await readPaidAccessFromAccountApi({
  requestUrl: protectedUrl,
  accessToken,
  fetchImpl: async () => response(200, {
    paidAccess: {
      allowed: true,
      reason: 'active',
      productId: 'read-the-dollar-first-guided-interactive-edition',
      state: 'active',
    },
  }),
});
assert.equal(activeApi.hasSession, true);
assert.equal(activeApi.accessState.allowed, true);
assert.equal(activeApi.accessState.reason, 'active');

await assert.rejects(
  () => readPaidAccessFromAccountApi({
    requestUrl: protectedUrl,
    accessToken,
    fetchImpl: async () => response(200, { paidAccess: { allowed: 'yes', reason: null } }),
  }),
  (error) => error?.code === 'INVALID_PAID_ACCESS_RESPONSE' && error?.status === 502,
);

await assert.rejects(
  () => readPaidAccessFromAccountApi({
    requestUrl: protectedUrl,
    accessToken,
    fetchImpl: async () => response(503, { code: 'SUPABASE_CONFIGURATION_ERROR' }),
  }),
  (error) => error?.code === 'SUPABASE_CONFIGURATION_ERROR' && error?.status === 503,
);

const middleware = await readFile(new URL('../middleware.js', import.meta.url), 'utf8');
assert.doesNotMatch(middleware, /guided-edition/);
assert.doesNotMatch(middleware, /readSessionAccessToken|readPaidAccessFromAccountApi|readAccountAccessState/);
assert.doesNotMatch(middleware, /localStorage|sessionStorage/);

const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const rewriteMap = new Map(vercelConfig.rewrites.map((entry) => [entry.source, entry.destination]));
assert.equal(rewriteMap.get('/guided-edition'), '/api/guided-edition');
assert.equal(rewriteMap.get('/guided-edition/:path*'), '/api/guided-edition?__paid_path=:path*');

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

await assert.rejects(
  () => readFile(new URL('../src/pages/guided-edition/index.astro', import.meta.url), 'utf8'),
  (error) => error?.code === 'ENOENT',
);

const protectedFunction = await readFile(new URL('../api/guided-edition.js', import.meta.url), 'utf8');
assert.match(protectedFunction, /readAccountAccessState/);
assert.match(protectedFunction, /resolveSessionWithRefresh/);
assert.match(protectedFunction, /private, no-store/);
assert.match(protectedFunction, /normalizePaidAccessReason/);

console.log('Protected paid-route tests passed.');
