import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SESSION_COOKIE_NAMES,
  clearSessionCookies,
  readSessionAccessToken,
  readSessionRefreshToken,
  requestOrigin,
  safeNextPath,
  sendPasswordlessEmail,
  setSessionCookies,
  verifyPasswordlessToken,
} from '../src/lib/supabase-auth.js';

const config = Object.freeze({
  url: 'https://development.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});
const accessToken = 'access_token_value_that_is_long_enough_for_validation_12345';
const refreshToken = 'refresh_token_value_that_is_long_enough_for_validation_12345';

function request(headers = {}) {
  return { headers };
}

function responseRecorder() {
  const values = new Map();
  return {
    setHeader(name, value) { values.set(name.toLowerCase(), value); },
    getHeader(name) { return values.get(name.toLowerCase()); },
    values,
  };
}

assert.equal(safeNextPath('/account/?tab=data'), '/account/?tab=data');
assert.equal(safeNextPath('https://evil.example'), '/account/');
assert.equal(safeNextPath('//evil.example'), '/account/');
assert.equal(safeNextPath('/\\evil'), '/account/');

assert.equal(requestOrigin(request({ host: 'localhost:4321' })), 'http://localhost:4321');
assert.equal(
  requestOrigin(request({ 'x-forwarded-host': 'usd-impact-site-test-usd-impact.vercel.app', 'x-forwarded-proto': 'https' })),
  'https://usd-impact-site-test-usd-impact.vercel.app',
);
assert.throws(() => requestOrigin(request({ host: 'evil.example', 'x-forwarded-proto': 'https' })));
assert.throws(() => requestOrigin(request({ host: 'unrelated-project.vercel.app', 'x-forwarded-proto': 'https' })));

const cookieResponse = responseRecorder();
setSessionCookies(cookieResponse, request({ host: 'www.usd-impact.com', 'x-forwarded-proto': 'https' }), {
  access_token: accessToken,
  refresh_token: refreshToken,
  expires_in: 3600,
});
const cookies = cookieResponse.getHeader('set-cookie');
assert.equal(cookies.length, 2);
assert.match(cookies[0], new RegExp(`^${SESSION_COOKIE_NAMES.ACCESS}=`));
assert.match(cookies[0], /HttpOnly/);
assert.match(cookies[0], /SameSite=Lax/);
assert.match(cookies[0], /Secure/);
assert.match(cookies[1], new RegExp(`^${SESSION_COOKIE_NAMES.REFRESH}=`));

const cookieHeader = `${SESSION_COOKIE_NAMES.ACCESS}=${encodeURIComponent(accessToken)}; ${SESSION_COOKIE_NAMES.REFRESH}=${encodeURIComponent(refreshToken)}`;
assert.equal(readSessionAccessToken(request({ cookie: cookieHeader })), accessToken);
assert.equal(readSessionRefreshToken(request({ cookie: cookieHeader })), refreshToken);
assert.equal(readSessionAccessToken(request({ authorization: `Bearer ${accessToken}` })), accessToken);

const clearResponse = responseRecorder();
clearSessionCookies(clearResponse, request({ host: 'localhost:4321' }));
assert.equal(clearResponse.getHeader('set-cookie').length, 2);
assert.match(clearResponse.getHeader('set-cookie')[0], /Max-Age=0/);
assert.doesNotMatch(clearResponse.getHeader('set-cookie')[0], /Secure/);

let otpRequest;
const requestedDestination = '/book/read-the-dollar-first/chapter-1/?resume=1';
const sent = await sendPasswordlessEmail({
  email: ' Reader@Example.com ',
  next: requestedDestination,
  request: request({ host: 'localhost:4321' }),
  config,
  fetchImpl: async (url, options) => {
    otpRequest = { url, options };
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.match(otpRequest.url, /\/auth\/v1\/otp\?redirect_to=/);
assert.equal(new URL(sent.redirectTo).searchParams.get('next'), requestedDestination);
assert.deepEqual(JSON.parse(otpRequest.options.body), {
  email: 'reader@example.com',
  create_user: true,
});

const verified = await verifyPasswordlessToken({
  tokenHash: 'valid_token_hash_value_that_is_long_enough_123456',
  type: 'email',
  config,
  fetchImpl: async (url, options) => {
    assert.equal(url, `${config.url}/auth/v1/verify`);
    assert.deepEqual(JSON.parse(options.body), {
      token_hash: 'valid_token_hash_value_that_is_long_enough_123456',
      type: 'email',
    });
    return new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(verified.accessToken, accessToken);
assert.equal(verified.refreshToken, refreshToken);

const signInPage = await readFile(new URL('../src/pages/account/sign-in/index.astro', import.meta.url), 'utf8');
const confirmPage = await readFile(new URL('../src/pages/auth/confirm/index.astro', import.meta.url), 'utf8');
const accountPage = await readFile(new URL('../src/pages/account/index.astro', import.meta.url), 'utf8');
const loginEndpoint = await readFile(new URL('../api/auth-login.js', import.meta.url), 'utf8');
const confirmEndpoint = await readFile(new URL('../api/auth-confirm.js', import.meta.url), 'utf8');
assert.match(signInPage, /\/api\/auth-login/);
assert.match(confirmPage, /\/api\/auth-confirm/);
assert.match(accountPage, /\/api\/account-access/);
assert.match(accountPage, /\/api\/account-export/);
assert.match(accountPage, /\/api\/account-delete/);
assert.match(accountPage, /\/api\/auth-logout/);
assert.match(loginEndpoint, /next:\s*payload\.next/);
assert.match(confirmEndpoint, /request\.method !== 'POST'/);
assert.match(confirmEndpoint, /payload\.token_hash/);
assert.match(confirmEndpoint, /redirectTo:\s*next/);
assert.doesNotMatch(`${signInPage}${confirmPage}${accountPage}`, /sb_secret_|SUPABASE_SECRET_KEY/);

console.log('Supabase passwordless auth tests passed.');
