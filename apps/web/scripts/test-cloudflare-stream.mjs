import assert from 'node:assert/strict';
import {
  CloudflareStreamConfigurationError,
  CloudflareStreamRequestError,
  createCloudflareStreamToken,
} from '../src/lib/cloudflare-stream.js';

const accountId = 'a'.repeat(32);
const videoUid = 'b'.repeat(32);
const apiToken = 'cfut_test_token_1234567890';
const signedToken = 'header.payload.signature';

await assert.rejects(
  () => createCloudflareStreamToken({ videoUid, environment: {}, fetchImpl: async () => null }),
  CloudflareStreamConfigurationError,
);

const token = await createCloudflareStreamToken({
  videoUid,
  environment: {
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_STREAM_API_TOKEN: apiToken,
  },
  fetchImpl: async (url, options) => {
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}/token`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Bearer ${apiToken}`);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, result: { token: signedToken } }),
    };
  },
});
assert.equal(token, signedToken);

await assert.rejects(
  () => createCloudflareStreamToken({
    videoUid,
    environment: {
      CLOUDFLARE_ACCOUNT_ID: accountId,
      CLOUDFLARE_STREAM_API_TOKEN: apiToken,
    },
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ success: false, errors: [{ message: 'denied' }] }),
    }),
  }),
  CloudflareStreamRequestError,
);

console.log('Cloudflare Stream signed-token tests passed.');
