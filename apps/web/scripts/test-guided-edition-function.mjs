import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { handleGuidedEditionRequest } from '../api/guided-edition.js';
import { SESSION_COOKIE_NAMES } from '../src/lib/supabase-auth.js';
import { WEEKLY_SCORE_DOWNLOAD_NAME } from '../src/lib/private-paid-assets.js';

const host = 'usd-impact-site-test-usd-impact.vercel.app';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.guided-edition-test-token.signature';

function request({
  method = 'GET',
  url = '/api/guided-edition',
  authenticated = false,
} = {}) {
  return {
    method,
    url,
    headers: {
      host,
      'x-forwarded-host': host,
      'x-forwarded-proto': 'https',
      ...(authenticated
        ? { cookie: `${SESSION_COOKIE_NAMES.ACCESS}=${encodeURIComponent(accessToken)}` }
        : {}),
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

const anonymousResponse = responseRecorder();
await handleGuidedEditionRequest(request(), anonymousResponse);
assert.equal(anonymousResponse.statusCode, 302);
const anonymousLocation = new URL(anonymousResponse.getHeader('location'), `https://${host}`);
assert.equal(anonymousLocation.pathname, '/account/sign-in/');
assert.equal(anonymousLocation.searchParams.get('next'), '/guided-edition/');

const unpaidResponse = responseRecorder();
await handleGuidedEditionRequest(
  request({ authenticated: true, url: '/api/guided-edition?campaign=launch' }),
  unpaidResponse,
  {
    readAccessState: async ({ accessToken: received }) => {
      assert.equal(received, accessToken);
      return { allowed: false, reason: 'missing' };
    },
  },
);
assert.equal(unpaidResponse.statusCode, 302);
const unpaidLocation = new URL(unpaidResponse.getHeader('location'), `https://${host}`);
assert.equal(unpaidLocation.pathname, '/account/access-required/');
assert.equal(unpaidLocation.searchParams.get('reason'), 'missing');
assert.equal(unpaidLocation.searchParams.get('next'), '/guided-edition/?campaign=launch');

const activeResponse = responseRecorder();
await handleGuidedEditionRequest(
  request({ authenticated: true }),
  activeResponse,
  { readAccessState: async () => ({ allowed: true, reason: 'active' }) },
);
assert.equal(activeResponse.statusCode, 200);
assert.match(activeResponse.getHeader('content-type'), /text\/html/);
assert.match(activeResponse.getHeader('cache-control'), /no-store/);
assert.equal(activeResponse.getHeader('vary'), 'Cookie, Authorization');
assert.match(activeResponse.body, /Your member library/);
assert.match(activeResponse.body, /Weekly Score v1\.1/);
assert.match(activeResponse.body, /durable purchase entitlement/);

const weeklyScoreResponse = responseRecorder();
await handleGuidedEditionRequest(
  request({ authenticated: true, url: '/api/guided-edition?__paid_path=weekly-score' }),
  weeklyScoreResponse,
  { readAccessState: async () => ({ allowed: true, reason: 'active' }) },
);
assert.equal(weeklyScoreResponse.statusCode, 200);
assert.match(weeklyScoreResponse.body, /Install it once\. Read it weekly\./);
assert.match(weeklyScoreResponse.body, /Copy all <strong>753 lines<\/strong>/);
assert.match(weeklyScoreResponse.body, /Once per bar close/);
assert.match(weeklyScoreResponse.body, /not forecasts, trading signals, or recommendations/);

const downloadBytes = Buffer.from('verified-paid-member-package');
const downloadSha256 = createHash('sha256').update(downloadBytes).digest('hex');
const downloadResponse = responseRecorder();
await handleGuidedEditionRequest(
  request({ authenticated: true, url: '/api/guided-edition?__paid_path=weekly-score/download' }),
  downloadResponse,
  {
    readAccessState: async () => ({ allowed: true, reason: 'active' }),
    downloadAsset: async () => ({
      bytes: downloadBytes,
      sha256: downloadSha256,
      size: downloadBytes.length,
    }),
  },
);
assert.equal(downloadResponse.statusCode, 200);
assert.equal(downloadResponse.getHeader('content-type'), 'application/zip');
assert.equal(
  downloadResponse.getHeader('content-disposition'),
  `attachment; filename="${WEEKLY_SCORE_DOWNLOAD_NAME}"`,
);
assert.equal(downloadResponse.getHeader('content-length'), downloadBytes.length);
assert.deepEqual(downloadResponse.body, downloadBytes);

const unavailableDownloadResponse = responseRecorder();
await handleGuidedEditionRequest(
  request({ authenticated: true, url: '/api/guided-edition?__paid_path=weekly-score/download' }),
  unavailableDownloadResponse,
  {
    readAccessState: async () => ({ allowed: true, reason: 'active' }),
    downloadAsset: async () => { throw new Error('Private storage unavailable.'); },
  },
);
assert.equal(unavailableDownloadResponse.statusCode, 503);
assert.match(unavailableDownloadResponse.body, /temporarily unavailable/);

const nestedResponse = responseRecorder();
await handleGuidedEditionRequest(
  request({ authenticated: true, url: '/api/guided-edition?__paid_path=chapter-1&section=yield-curve' }),
  nestedResponse,
  { readAccessState: async () => ({ allowed: true, reason: 'active' }) },
);
assert.equal(nestedResponse.statusCode, 404);
assert.equal(nestedResponse.body, 'Protected page not found.');

const suspendedResponse = responseRecorder();
await handleGuidedEditionRequest(
  request({ authenticated: true }),
  suspendedResponse,
  { readAccessState: async () => ({ allowed: false, reason: 'suspended' }) },
);
assert.equal(suspendedResponse.statusCode, 302);
assert.equal(
  new URL(suspendedResponse.getHeader('location'), `https://${host}`).searchParams.get('reason'),
  'suspended',
);

const unavailableResponse = responseRecorder();
await handleGuidedEditionRequest(
  request({ authenticated: true }),
  unavailableResponse,
  {
    readAccessState: async () => {
      const error = new Error('Unavailable');
      error.status = 503;
      error.code = 'SUPABASE_REQUEST_FAILED';
      throw error;
    },
  },
);
assert.equal(unavailableResponse.statusCode, 302);
assert.equal(
  new URL(unavailableResponse.getHeader('location'), `https://${host}`).searchParams.get('reason'),
  'denied',
);

const postResponse = responseRecorder();
await handleGuidedEditionRequest(request({ method: 'POST' }), postResponse);
assert.equal(postResponse.statusCode, 405);
assert.equal(postResponse.getHeader('allow'), 'GET, HEAD');

console.log('Serverless Guided Edition guard tests passed.');
