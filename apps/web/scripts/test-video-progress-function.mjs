import assert from 'node:assert/strict';
import { handleVideoProgressRequest } from '../src/lib/video-progress-handler.js';
import { SESSION_COOKIE_NAMES } from '../src/lib/supabase-auth.js';

const accessToken = 'eyJhbGciOiJIUzI1NiJ9.video-progress-test-token.signature';
const accountId = '11111111-1111-4111-8111-111111111111';

function request({ method = 'GET', url = '/api/video-progress', authenticated = false, body = null, json = false } = {}) {
  return {
    method,
    url,
    body,
    headers: {
      host: 'usd-impact-site-test-usd-impact.vercel.app',
      ...(authenticated ? { cookie: `${SESSION_COOKIE_NAMES.ACCESS}=${encodeURIComponent(accessToken)}` } : {}),
      ...(json ? { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' } : {}),
    },
  };
}

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = value; },
  };
}

const active = async () => ({ allowed: true, reason: 'active', user: { id: accountId } });

const anonymous = responseRecorder();
await handleVideoProgressRequest(request(), anonymous);
assert.equal(anonymous.statusCode, 401);

const unpaid = responseRecorder();
await handleVideoProgressRequest(request({ authenticated: true }), unpaid, {
  readAccessState: async () => ({ allowed: false, reason: 'missing', user: { id: accountId } }),
});
assert.equal(unpaid.statusCode, 403);

const getResponse = responseRecorder();
await handleVideoProgressRequest(
  request({ authenticated: true, url: '/api/video-progress?slug=dollar-yields-liquidity' }),
  getResponse,
  {
    readAccessState: active,
    readProgress: async (args) => {
      assert.equal(args.accountId, accountId);
      assert.equal(args.contentId, 'video:dollar-yields-liquidity');
      return [{ content_id: args.contentId, status: 'in_progress', progress_percent: 44, resume_position: '24.0' }];
    },
  },
);
assert.equal(getResponse.statusCode, 200);
assert.equal(JSON.parse(getResponse.body).progress.progress_percent, 44);

const contentType = responseRecorder();
await handleVideoProgressRequest(request({ method: 'POST', authenticated: true, body: {} }), contentType, {
  readAccessState: active,
});
assert.equal(contentType.statusCode, 415);

let upsertArgs = null;
const postResponse = responseRecorder();
await handleVideoProgressRequest(
  request({
    method: 'POST',
    authenticated: true,
    json: true,
    body: { slug: 'dollar-yields-liquidity', positionSeconds: 55.1, status: 'in_progress' },
  }),
  postResponse,
  {
    readAccessState: active,
    upsertProgress: async (args) => {
      upsertArgs = args;
      return { content_id: args.contentId, status: args.status, progress_percent: args.progressPercent };
    },
  },
);
assert.equal(postResponse.statusCode, 200);
assert.equal(upsertArgs.contentId, 'video:dollar-yields-liquidity');
assert.equal(upsertArgs.status, 'completed');
assert.equal(upsertArgs.progressPercent, 100);

const invalid = responseRecorder();
await handleVideoProgressRequest(
  request({ method: 'POST', authenticated: true, json: true, body: { slug: 'missing-film', positionSeconds: 2 } }),
  invalid,
  { readAccessState: active },
);
assert.equal(invalid.statusCode, 404);

console.log('Video progress API tests passed.');
