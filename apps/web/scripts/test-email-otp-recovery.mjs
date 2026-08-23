import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  emailOtpRecoveryEnabled,
  verifyEmailOtpRecovery,
} from '../src/lib/email-otp-recovery.js';

const config = Object.freeze({
  url: 'https://development.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: null,
});
const enabledEnvironment = Object.freeze({ EMAIL_OTP_FALLBACK_ENABLED: 'true' });
const disabledEnvironment = Object.freeze({ EMAIL_OTP_FALLBACK_ENABLED: 'false' });

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

let verifyRequest;
const session = await verifyEmailOtpRecovery({
  email: 'Reader@Example.com',
  token: '123456',
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
  token: '123456',
  type: 'email',
});
assert.equal(typeof session.access_token, 'string');

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
await assert.rejects(
  verifyEmailOtpRecovery({
    email: 'reader@example.com',
    token: '12345',
    environment: enabledEnvironment,
    config,
    fetchImpl: async () => { throw new Error('fetch should not run'); },
  }),
  (error) => error?.code === 'INVALID_EMAIL_OTP' && error?.status === 400,
);
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

const handler = await readFile(new URL('../src/lib/passkey-handler.js', import.meta.url), 'utf8');
const signInPage = await readFile(new URL('../src/pages/account/sign-in/index.astro', import.meta.url), 'utf8');
const accountPage = await readFile(new URL('../src/pages/account/index.astro', import.meta.url), 'utf8');

assert.match(handler, /recovery-status/);
assert.match(handler, /recovery-verify/);
assert.match(handler, /clearPkceCookie/);
assert.match(signInPage, /autocomplete="one-time-code"/);
assert.match(signInPage, /op=recovery-status/);
assert.match(signInPage, /op=recovery-verify/);
assert.match(signInPage, /emailCodeContainer\.hidden = !emailCodeEnabled/);
assert.match(signInPage, /Already have a code\?/);
assert.match(accountPage, /passkey-settings-link/);
assert.match(accountPage, /action=passkey&op=status/);
assert.doesNotMatch(`${handler}${signInPage}${accountPage}`, /SUPABASE_SECRET_KEY|sb_secret_/);

console.log('Email OTP recovery tests passed.');
