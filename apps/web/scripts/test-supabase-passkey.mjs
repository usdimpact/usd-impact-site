import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  deletePasskey,
  listPasskeys,
  passkeyAuthEnabled,
  renamePasskey,
  startPasskeyAuthentication,
  startPasskeyRegistration,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from '../src/lib/supabase-passkey.js';

const config = Object.freeze({
  url: 'https://development.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: null,
});
const enabledEnvironment = Object.freeze({ PASSKEY_AUTH_ENABLED: 'true' });
const disabledEnvironment = Object.freeze({ PASSKEY_AUTH_ENABLED: 'false' });
const accessToken = 'access.token/value+that=is_long_enough_for_validation_12345';
const challengeId = '6e730d21-fab5-4ee6-88d4-b3b4629ff377';
const passkeyId = 'eb7276d4-02fc-49ca-a8bf-425c57fbbd31';
const credential = Object.freeze({
  id: 'credential-id',
  rawId: 'credential-id',
  type: 'public-key',
  response: Object.freeze({
    clientDataJSON: 'client-data',
    authenticatorData: 'auth-data',
    signature: 'signature',
    userHandle: 'user-handle',
  }),
});

function request(headers = {}) {
  return { headers };
}

assert.equal(passkeyAuthEnabled(enabledEnvironment), true);
assert.equal(passkeyAuthEnabled({ PASSKEY_AUTH_ENABLED: 'TRUE' }), true);
assert.equal(passkeyAuthEnabled(disabledEnvironment), false);

await assert.rejects(
  startPasskeyAuthentication({
    request: request(),
    environment: disabledEnvironment,
    config,
    fetchImpl: async () => { throw new Error('fetch should not run'); },
  }),
  (error) => error?.code === 'PASSKEY_AUTH_DISABLED' && error?.status === 404,
);

let authenticationOptionsRequest;
const authenticationOptions = await startPasskeyAuthentication({
  request: request({ 'x-turnstile-token': 'turnstile-passkey-token' }),
  environment: enabledEnvironment,
  config,
  fetchImpl: async (url, options) => {
    authenticationOptionsRequest = { url, options };
    return new Response(JSON.stringify({
      challenge_id: challengeId,
      options: { challenge: 'challenge', rpId: 'usd-impact.com', allowCredentials: [] },
      expires_at: 1234567890,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(authenticationOptionsRequest.url, `${config.url}/auth/v1/passkeys/authentication/options`);
assert.equal(authenticationOptionsRequest.options.method, 'POST');
assert.deepEqual(JSON.parse(authenticationOptionsRequest.options.body), {
  gotrue_meta_security: { captcha_token: 'turnstile-passkey-token' },
});
assert.equal(authenticationOptions.challengeId, challengeId);
assert.equal(authenticationOptions.options.rpId, 'usd-impact.com');

let authenticationVerifyRequest;
const authenticationSession = await verifyPasskeyAuthentication({
  challengeId,
  credential,
  environment: enabledEnvironment,
  config,
  fetchImpl: async (url, options) => {
    authenticationVerifyRequest = { url, options };
    return new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: 'refresh/token+value=that_is_long_enough_for_validation_12345',
      expires_in: 3600,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(authenticationVerifyRequest.url, `${config.url}/auth/v1/passkeys/authentication/verify`);
assert.deepEqual(JSON.parse(authenticationVerifyRequest.options.body), {
  challenge_id: challengeId,
  credential,
});
assert.equal(authenticationSession.access_token, accessToken);

let registrationOptionsRequest;
const registrationOptions = await startPasskeyRegistration({
  accessToken,
  environment: enabledEnvironment,
  config,
  fetchImpl: async (url, options) => {
    registrationOptionsRequest = { url, options };
    return new Response(JSON.stringify({
      challenge_id: challengeId,
      options: {
        challenge: 'challenge',
        rp: { id: 'usd-impact.com', name: 'USD Impact' },
        user: { id: 'user-id', name: 'reader@example.com', displayName: 'reader@example.com' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      },
      expires_at: 1234567890,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(registrationOptionsRequest.url, `${config.url}/auth/v1/passkeys/registration/options`);
assert.equal(registrationOptionsRequest.options.headers.Authorization, `Bearer ${accessToken}`);
assert.equal(registrationOptions.options.rp.id, 'usd-impact.com');

let registrationVerifyRequest;
const registered = await verifyPasskeyRegistration({
  accessToken,
  challengeId,
  credential,
  environment: enabledEnvironment,
  config,
  fetchImpl: async (url, options) => {
    registrationVerifyRequest = { url, options };
    return new Response(JSON.stringify({
      id: passkeyId,
      friendly_name: 'Windows Hello',
      created_at: '2026-08-23T18:00:00Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(registrationVerifyRequest.url, `${config.url}/auth/v1/passkeys/registration/verify`);
assert.equal(registrationVerifyRequest.options.headers.Authorization, `Bearer ${accessToken}`);
assert.equal(registered.id, passkeyId);
assert.equal(registered.friendlyName, 'Windows Hello');

let listRequest;
const listed = await listPasskeys({
  accessToken,
  environment: enabledEnvironment,
  config,
  fetchImpl: async (url, options) => {
    listRequest = { url, options };
    return new Response(JSON.stringify([{
      id: passkeyId,
      friendly_name: 'Windows Hello',
      created_at: '2026-08-23T18:00:00Z',
      last_used_at: '2026-08-23T18:10:00Z',
    }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(listRequest.url, `${config.url}/auth/v1/passkeys`);
assert.equal(listRequest.options.method, 'GET');
assert.equal(listed.length, 1);
assert.equal(listed[0].lastUsedAt, '2026-08-23T18:10:00Z');

let renameRequest;
const renamed = await renamePasskey({
  accessToken,
  passkeyId,
  friendlyName: 'Work laptop',
  environment: enabledEnvironment,
  config,
  fetchImpl: async (url, options) => {
    renameRequest = { url, options };
    return new Response(JSON.stringify({
      id: passkeyId,
      friendly_name: 'Work laptop',
      created_at: '2026-08-23T18:00:00Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(renameRequest.url, `${config.url}/auth/v1/passkeys/${passkeyId}`);
assert.equal(renameRequest.options.method, 'PATCH');
assert.deepEqual(JSON.parse(renameRequest.options.body), { friendly_name: 'Work laptop' });
assert.equal(renamed.friendlyName, 'Work laptop');

let deleteRequest;
const deleted = await deletePasskey({
  accessToken,
  passkeyId,
  environment: enabledEnvironment,
  config,
  fetchImpl: async (url, options) => {
    deleteRequest = { url, options };
    return new Response(null, { status: 204 });
  },
});
assert.equal(deleteRequest.url, `${config.url}/auth/v1/passkeys/${passkeyId}`);
assert.equal(deleteRequest.options.method, 'DELETE');
assert.equal(deleted.id, passkeyId);

await assert.rejects(
  verifyPasskeyAuthentication({
    challengeId: 'not-a-uuid',
    credential,
    environment: enabledEnvironment,
    config,
    fetchImpl: async () => new Response('{}', { status: 200 }),
  }),
  (error) => error?.code === 'INVALID_PASSKEY_REQUEST',
);
await assert.rejects(
  verifyPasskeyAuthentication({
    challengeId,
    credential: null,
    environment: enabledEnvironment,
    config,
    fetchImpl: async () => new Response('{}', { status: 200 }),
  }),
  (error) => error?.code === 'INVALID_PASSKEY_CREDENTIAL',
);

const browserHelper = await readFile(new URL('../public/assets/passkey-browser.js', import.meta.url), 'utf8');
const signInPage = await readFile(new URL('../src/pages/account/sign-in/index.astro', import.meta.url), 'utf8');
const passkeyPage = await readFile(new URL('../src/pages/account/passkeys/index.astro', import.meta.url), 'utf8');
const accountRouter = await readFile(new URL('../api/account.js', import.meta.url), 'utf8');

assert.match(browserHelper, /navigator\.credentials\.create/);
assert.match(browserHelper, /navigator\.credentials\.get/);
assert.match(browserHelper, /parseCreationOptionsFromJSON/);
assert.match(browserHelper, /parseRequestOptionsFromJSON/);
assert.doesNotMatch(browserHelper, /localStorage|sessionStorage/);
assert.match(signInPage, /Sign in with a passkey/);
assert.match(signInPage, /op=authentication-options/);
assert.match(signInPage, /op=authentication-verify/);
assert.match(signInPage, /X-Turnstile-Token/);
assert.match(signInPage, /Email sign-in remains available as the recovery method/);
assert.match(passkeyPage, /api\('registration-options'/);
assert.match(passkeyPage, /api\('registration-verify'/);
assert.match(passkeyPage, /api\('rename'/);
assert.match(passkeyPage, /api\('delete'/);
assert.match(accountRouter, /handlePasskeyRequest/);
assert.match(accountRouter, /passkey: handlePasskeyRequest/);
assert.doesNotMatch(`${browserHelper}${signInPage}${passkeyPage}`, /SUPABASE_SECRET_KEY|sb_secret_/);

console.log('Supabase passkey gateway tests passed.');
