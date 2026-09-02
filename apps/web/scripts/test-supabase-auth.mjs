import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PKCE_COOKIE_NAME,
  SESSION_COOKIE_NAMES,
  clearSessionCookies,
  exchangePasswordlessCode,
  readPkceVerifier,
  readSessionAccessToken,
  readSessionRefreshToken,
  requestOrigin,
  safeNextPath,
  sessionReadyLocation,
  sendPasswordlessEmail,
  setSessionCookies,
} from '../src/lib/supabase-auth.js';

const config = Object.freeze({
  url: 'https://development.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});
const accessToken = 'access.token/value+that=is_long_enough_for_validation_12345';
const refreshToken = 'refresh/token+value=that_is_long_enough_for_validation_12345';

function request(headers = {}, url = '/') {
  return { headers, url };
}

function responseRecorder() {
  const values = new Map();
  return {
    statusCode: 200,
    setHeader(name, value) { values.set(name.toLowerCase(), value); },
    getHeader(name) { return values.get(name.toLowerCase()); },
    end(value = '') { this.body = value; },
    values,
  };
}

assert.equal(safeNextPath('/account/?tab=data'), '/account/?tab=data');
assert.equal(
  safeNextPath('/checkout/?utm_source=newsletter&utm_medium=email&utm_campaign=september_launch'),
  '/checkout/?utm_source=newsletter&utm_medium=email&utm_campaign=september_launch',
);
assert.equal(safeNextPath('https://evil.example'), '/account/');
assert.equal(safeNextPath('//evil.example'), '/account/');
assert.equal(safeNextPath('/\\evil'), '/account/');
assert.equal(
  sessionReadyLocation('/guided-edition/video-library/'),
  '/auth/session-ready/?next=%2Fguided-edition%2Fvideo-library%2F',
);
assert.equal(
  sessionReadyLocation('https://evil.example'),
  '/auth/session-ready/?next=%2Faccount%2F',
);

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
assert.equal(readSessionRefreshToken(request({ cookie: `${SESSION_COOKIE_NAMES.REFRESH}=bad%0Atoken` })), null);

const clearResponse = responseRecorder();
clearSessionCookies(clearResponse, request({ host: 'localhost:4321' }));
assert.equal(clearResponse.getHeader('set-cookie').length, 2);
assert.match(clearResponse.getHeader('set-cookie')[0], /Max-Age=0/);
assert.doesNotMatch(clearResponse.getHeader('set-cookie')[0], /Secure/);

let otpRequest;
const requestedDestination = '/book/read-the-dollar-first/chapter-1/?resume=1';
const otpResponse = responseRecorder();
const sent = await sendPasswordlessEmail({
  email: ' Reader@Example.com ',
  next: requestedDestination,
  request: request({ host: 'localhost:4321' }),
  response: otpResponse,
  config,
  fetchImpl: async (url, options) => {
    otpRequest = { url, options };
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.match(otpRequest.url, /\/auth\/v1\/otp\?redirect_to=/);
assert.equal(new URL(sent.redirectTo).pathname, '/auth/confirm/');
assert.equal(new URL(sent.redirectTo).searchParams.get('next'), requestedDestination);
const otpBody = JSON.parse(otpRequest.options.body);
assert.equal(otpBody.email, 'reader@example.com');
assert.equal(otpBody.create_user, true);
assert.equal(otpBody.gotrue_meta_security, undefined);
assert.equal(otpBody.code_challenge_method, 's256');
assert.match(otpBody.code_challenge, /^[A-Za-z0-9_-]{43}$/);
const pkceCookie = otpResponse.getHeader('set-cookie')[0];
assert.match(pkceCookie, new RegExp(`^${PKCE_COOKIE_NAME}=`));
assert.match(pkceCookie, /Path=\//);
assert.doesNotMatch(pkceCookie, /Path=\/auth\/confirm\//);
assert.match(pkceCookie, /HttpOnly/);
const verifier = decodeURIComponent(pkceCookie.match(new RegExp(`^${PKCE_COOKIE_NAME}=([^;]+)`))[1]);
assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
assert.equal(readPkceVerifier(request({ cookie: `${PKCE_COOKIE_NAME}=${encodeURIComponent(verifier)}` })), verifier);

let captchaOtpRequest;
const captchaResponse = responseRecorder();
await sendPasswordlessEmail({
  email: 'captcha@example.com',
  next: '/account/',
  request: request({ host: 'localhost:4321', 'x-turnstile-token': 'turnstile-test-token' }),
  response: captchaResponse,
  config,
  fetchImpl: async (url, options) => {
    captchaOtpRequest = { url, options };
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
const captchaOtpBody = JSON.parse(captchaOtpRequest.options.body);
assert.deepEqual(captchaOtpBody.gotrue_meta_security, { captcha_token: 'turnstile-test-token' });
assert.equal(captchaOtpBody.create_user, true);

await assert.rejects(
  sendPasswordlessEmail({
    email: 'captcha@example.com',
    next: '/account/',
    request: request({ host: 'localhost:4321', 'x-turnstile-token': 'x'.repeat(2049) }),
    response: responseRecorder(),
    config,
    fetchImpl: async () => new Response('{}', { status: 200 }),
  }),
  (error) => error?.code === 'INVALID_CAPTCHA_TOKEN' && error?.status === 400,
);

const exchanged = await exchangePasswordlessCode({
  authCode: 'valid_auth_code_value_that_is_long_enough_123456',
  codeVerifier: verifier,
  config,
  fetchImpl: async (url, options) => {
    assert.equal(url, `${config.url}/auth/v1/token?grant_type=pkce`);
    assert.deepEqual(JSON.parse(options.body), {
      auth_code: 'valid_auth_code_value_that_is_long_enough_123456',
      code_verifier: verifier,
    });
    return new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(exchanged.accessToken, accessToken);
assert.equal(exchanged.refreshToken, refreshToken);

const signInPage = await readFile(new URL('../src/pages/account/sign-in/index.astro', import.meta.url), 'utf8');
const accountPage = await readFile(new URL('../src/pages/account/index.astro', import.meta.url), 'utf8');
const confirmationPage = await readFile(new URL('../src/pages/auth/confirm/index.astro', import.meta.url), 'utf8');
const accountRouter = await readFile(new URL('../api/account.js', import.meta.url), 'utf8');
const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(signInPage, /\/api\/auth-login/);
assert.match(signInPage, /PUBLIC_TURNSTILE_SITE_KEY/);
assert.match(signInPage, /cf-turnstile/);
assert.match(signInPage, /X-Turnstile-Token/);
assert.match(signInPage, /account_sign_in/);
assert.match(accountPage, /\/api\/account-access/);
assert.match(accountPage, /\/api\/account-export/);
assert.match(accountPage, /\/api\/account-delete/);
assert.match(accountPage, /\/api\/auth-logout/);
assert.match(confirmationPage, /searchParams\.delete\('code'\)/);
assert.match(confirmationPage, /new URL\('\/api\/auth-confirm'/);
assert.doesNotMatch(confirmationPage, /token_hash|auth\/confirm\/exchange/);
assert.match(accountRouter, /request\.method !== 'GET'/);
assert.match(accountRouter, /exchangePasswordlessCode/);
assert.match(accountRouter, /const next = safeNextPath\(url\.searchParams\.get\('next'\)\);/);
assert.match(accountRouter, /target\.searchParams\.set\('next', next\);/);
assert.match(accountRouter, /target\.searchParams\.set\('error', safe\.status >= 500 \? 'service_unavailable' : 'invalid_link'\);/);
assert.doesNotMatch(accountRouter, /verifyPasswordlessTokenHash|handleTokenHashConfirmation/);
for (const action of ['login', 'confirm', 'refresh', 'logout', 'access', 'export', 'delete']) {
  assert.match(accountRouter, new RegExp(`${action}: handle`, 'i'));
}
const rewriteMap = new Map(vercelConfig.rewrites.map((entry) => [entry.source, entry.destination]));
assert.equal(rewriteMap.get('/api/auth-login'), '/api/account?action=login');
assert.equal(rewriteMap.get('/api/auth-confirm'), '/api/account?action=confirm');
assert.equal(rewriteMap.has('/auth/confirm/exchange'), false);
assert.equal(rewriteMap.get('/api/account-access'), '/api/account?action=access');
assert.equal(rewriteMap.get('/api/telemetry-report'), '/api/telemetry?action=report');
assert.equal(rewriteMap.get('/api/checklist-analytics'), '/api/telemetry?action=checklist-report');
assert.match(packageJson.scripts['validate:functions'], /node --check api\/account\.js/);
assert.doesNotMatch(packageJson.scripts['validate:supabase'], /token-hash/);
assert.doesNotMatch(`${signInPage}${accountPage}${confirmationPage}`, /sb_secret_|SUPABASE_SECRET_KEY/);

console.log('Supabase passwordless auth tests passed.');
