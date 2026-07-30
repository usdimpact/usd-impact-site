import assert from 'node:assert/strict';
import { verifyPasswordlessTokenHash } from '../src/lib/supabase-token-hash.js';

const config = Object.freeze({
  url: 'https://development.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: null,
});
const accessToken = 'access.token/value+that=is_long_enough_for_validation_12345';
const refreshToken = 'refresh/token+value=that_is_long_enough_for_validation_12345';
const tokenHash = '0123456789abcdef0123456789abcdef0123456789abcdef01234567';

const payload = await verifyPasswordlessTokenHash({
  tokenHash,
  type: 'email',
  config,
  fetchImpl: async (url, options) => {
    assert.equal(url, `${config.url}/auth/v1/verify`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.apikey, config.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${config.publishableKey}`);
    assert.deepEqual(JSON.parse(options.body), {
      token_hash: tokenHash,
      type: 'email',
    });
    return new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(payload.access_token, accessToken);
assert.equal(payload.refresh_token, refreshToken);

await assert.rejects(
  verifyPasswordlessTokenHash({ tokenHash: 'short', type: 'email', config }),
  (error) => error?.code === 'INVALID_SIGN_IN_LINK' && error?.status === 400,
);
await assert.rejects(
  verifyPasswordlessTokenHash({ tokenHash, type: 'recovery', config }),
  (error) => error?.code === 'INVALID_SIGN_IN_LINK' && error?.status === 400,
);
await assert.rejects(
  verifyPasswordlessTokenHash({
    tokenHash,
    type: 'email',
    config,
    fetchImpl: async () => new Response(JSON.stringify({
      error: 'otp_expired',
      error_description: 'Token has expired or is invalid',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } }),
  }),
  (error) => error?.status === 403 && error?.code === 'AUTH_REQUEST_FAILED',
);

console.log('Supabase token-hash confirmation tests passed.');
