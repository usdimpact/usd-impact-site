import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  emailOtpRecoveryEnabled,
  verifyEmailOtpRecovery,
} from '../src/lib/email-otp-recovery.js';
import { handlePasskeyRequest } from '../src/lib/passkey-handler.js';

const config = Object.freeze({
  url: 'https://development.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: null,
});
const enabledEnvironment = Object.freeze({ EMAIL_OTP_FALLBACK_ENABLED: 'true' });
const disabledEnvironment = Object.freeze({ EMAIL_OTP_FALLBACK_ENABLED: 'false' });

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

assert.equal(emailOtpRecoveryEnabled(enabledEnvironment), true);
assert.equal(emailOtpRecoveryEnabled({ EMAIL_OTP_FALLBACK_ENABLED: 'TRUE' }), true);
assert.equal(emailOtpRecoveryEnabled(disabledEnvironment), false);

await assert.rejects(
  verifyEmailOtpRecovery({
    email: 'reader@example.com',
    token: '123456',
    environment: disabledEnvironment,
    config,
    fetchImpl: async () => { throw new Error('fetch should not run'); },
  }),
  (error) => error?.code === 'EMAIL_OTP_FALLBACK_DISABLED' && error?.status === 404,
);

for (const token of ['123456', '12345678']) {
  let verifyRequest;
  const session = await verifyEmailOtpRecovery({
    email: 'Reader@Example.com',
    token,
    environment: enabledEnvironment,
    config,
    fetchImpl: async (url, options) => {
      verifyRequest = { url, options };
      return new Response(JSON.stringify({
        access_token: 'access.token/value+that=is_long_enough_for_validation_12345',
        refresh_token: 'refresh/token+value=that_is_long_enough_for_validation_12345',
        expires_in: 3600,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  assert.equal(verifyRequest.url, `${config.url}/auth/v1/verify`);
  assert.equal(verifyRequest.options.method, 'POST');
  assert.equal(verifyRequest.options.headers.apikey, config.publishableKey);
  assert.deepEqual(JSON.parse(verifyRequest.options.body), {
    email: 'reader@example.com',
    token,
    type: 'email',
  });
  assert.equal(typeof session.access_token, 'string');
}

await assert.rejects(
  verifyEmailOtpRecovery({
    email: 'not-an-email',
    token: '123456',
    environment: enabledEnvironment,
    config,
    fetchImpl: async () => { throw new Error('fetch should not run'); },
  }),
  (error) => error?.code === 'INVALID_EMAIL_OTP' && error?.status === 400,
);
for (const token of ['12345', '12345678901', '12ab5678']) {
  await assert.rejects(
    verifyEmailOtpRecovery({
      email: 'reader@example.com',
      token,
      environment: enabledEnvironment,
      config,
      fetchImpl: async () => { throw new Error('fetch should not run'); },
    }),
    (error) => error?.code === 'INVALID_EMAIL_OTP' && error?.status === 400,
  );
}
await assert.rejects(
  verifyEmailOtpRecovery({
    email: 'reader@example.com',
    token: '654321',
    environment: enabledEnvironment,
    config,
    fetchImpl: async () => new Response(JSON.stringify({ message: 'expired' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }),
  }),
  (error) => error?.code === 'INVALID_EMAIL_OTP' && error?.status === 400,
);
await assert.rejects(
  verifyEmailOtpRecovery({
    email: 'reader@example.com',
    token: '654321',
    environment: enabledEnvironment,
    config,
    fetchImpl: async () => new Response(JSON.stringify({ message: 'upstream unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }),
  }),
  (error) => error?.code === 'EMAIL_OTP_VERIFY_FAILED' && error?.status === 503,
);

const originalEnvironment = {
  EMAIL_OTP_FALLBACK_ENABLED: process.env.EMAIL_OTP_FALLBACK_ENABLED,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
};
const originalFetch = globalThis.fetch;
try {
  process.env.EMAIL_OTP_FALLBACK_ENABLED = 'true';
  process.env.SUPABASE_URL = config.url;
  process.env.SUPABASE_PUBLISHABLE_KEY = config.publishableKey;
  globalThis.fetch = async () => new Response(JSON.stringify({
    access_token: 'accepted.access_token_that_is_long_enough_for_cookie_validation',
    refresh_token: 'accepted.refresh_token_that_is_long_enough_for_cookie_validation',
    expires_in: 3600,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const acceptedCodeResponse = responseRecorder();
  await handlePasskeyRequest({
    method: 'POST',
    url: '/api/account?action=passkey&op=recovery-verify',
    headers: {
      'content-type': 'application/json',
      host: 'www.usd-impact.com',
      'x-forwarded-proto': 'https',
    },
    body: {
      email: 'reader@example.com',
      token: '123456',
      next: '/guided-edition/video-library/',
    },
  }, acceptedCodeResponse);

  assert.equal(acceptedCodeResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(acceptedCodeResponse.body), {
    ok: true,
    redirect: '/auth/session-ready/?next=%2Fguided-edition%2Fvideo-library%2F',
  });
  assert.equal(acceptedCodeResponse.getHeader('set-cookie').length, 4);
} finally {
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

const handler = await readFile(new URL('../src/lib/passkey-handler.js', import.meta.url), 'utf8');
const signInPage = await readFile(new URL('../src/pages/account/sign-in/index.astro', import.meta.url), 'utf8');
const accountPage = await readFile(new URL('../src/pages/account/index.astro', import.meta.url), 'utf8');

assert.match(handler, /recovery-status/);
assert.match(handler, /recovery-verify/);
assert.match(handler, /clearPkceCookie/);
assert.match(
  handler,
  /setSessionCookies\(response, request, session, \{[\s\S]*rememberDevice: payload\.rememberDevice,[\s\S]*redirect: sessionReadyLocation\(payload\.next\)/,
);
assert.match(signInPage, /autocomplete="one-time-code"/);
assert.match(signInPage, /pattern="\[0-9\]\{6,10\}"/);
assert.match(signInPage, /maxlength="10"/);
assert.match(signInPage, /\^\\d\{6,10\}\$/);
assert.match(signInPage, /op=recovery-status/);
assert.match(signInPage, /op=recovery-verify/);
assert.match(signInPage, /emailCodeContainer\.hidden = !emailCodeEnabled/);
assert.match(signInPage, /six-digit fallback code/i);
assert.match(signInPage, /Six-digit email code/);
assert.match(signInPage, /EMAIL_RESEND_COOLDOWN_SECONDS = 35/);
assert.match(signInPage, /Send again in \$\{remainingSeconds\}s/);
assert.match(signInPage, /response\.status === 429/);
assert.match(signInPage, /Too many sign-in emails were requested/);
assert.match(signInPage, /Keep me signed in on this device for 30 days/);
assert.equal((signInPage.match(/rememberDevice:/g) || []).length, 3);
assert.match(accountPage, /passkey-settings-link/);
assert.match(accountPage, /action=passkey&op=status/);
assert.doesNotMatch(`${handler}${signInPage}${accountPage}`, /SUPABASE_SECRET_KEY|sb_secret_/);

console.log('Email OTP recovery tests passed.');
