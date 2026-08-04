import assert from 'node:assert/strict';
import { handleGuidedEditionRequest } from '../api/guided-edition.js';
import { SESSION_COOKIE_NAMES } from '../src/lib/supabase-auth.js';

const host = 'usd-impact-site-test-usd-impact.vercel.app';
const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.guided-edition-test-token.signature';
const activeState = { allowed: true, reason: 'active', user: { id: accountId } };

function request({ method = 'GET', url = '/api/guided-edition', authenticated = false, body, headers = {} } = {}) {
  return {
    method,
    url,
    body,
    headers: {
      host,
      'x-forwarded-host': host,
      'x-forwarded-proto': 'https',
      ...(authenticated ? { cookie: `${SESSION_COOKIE_NAMES.ACCESS}=${encodeURIComponent(accessToken)}` } : {}),
      ...headers,
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

async function run(input, dependencies = {}) {
  const response = responseRecorder();
  await handleGuidedEditionRequest(input, response, {
    readAccessState: async () => activeState,
    readProgress: async () => null,
    recordProgress: async () => ({
      status: 'in_progress', progress_percent: 60, resume_position: 'access-boundary',
      mastery_score: null, attempt_count: 0, completed_at: null, updated_at: '2026-08-04T16:45:00.000Z',
    }),
    ...dependencies,
  });
  return response;
}

const anonymous = await run(request());
assert.equal(anonymous.statusCode, 302);
const anonymousLocation = new URL(anonymous.getHeader('location'), `https://${host}`);
assert.equal(anonymousLocation.pathname, '/account/sign-in/');
assert.equal(anonymousLocation.searchParams.get('next'), '/guided-edition/');

for (const reason of ['missing', 'suspended', 'suspended_dispute', 'refunded', 'charged_back', 'revoked', 'expired', 'deletion_pending']) {
  const denied = await run(
    request({ authenticated: true, url: '/api/guided-edition?campaign=launch' }),
    { readAccessState: async () => ({ allowed: false, reason }) },
  );
  assert.equal(denied.statusCode, 302);
  const location = new URL(denied.getHeader('location'), `https://${host}`);
  assert.equal(location.pathname, '/account/access-required/');
  assert.equal(location.searchParams.get('reason'), reason);
  assert.equal(location.searchParams.get('next'), '/guided-edition/?campaign=launch');
}

const library = await run(request({ authenticated: true }), {
  readProgress: async ({ accessToken: received, accountId: receivedAccount, contentId }) => {
    assert.equal(received, accessToken);
    assert.equal(receivedAccount, accountId);
    assert.equal(contentId, 'guided-edition:chapter-1');
    return { status: 'in_progress', progress_percent: 60, resume_position: 'access-boundary', attempt_count: 1 };
  },
});
assert.equal(library.statusCode, 200);
assert.match(library.getHeader('content-type'), /text\/html/);
assert.match(library.getHeader('cache-control'), /private, no-store/);
assert.equal(library.getHeader('vary'), 'Cookie, Authorization');
assert.match(library.body, /Protected learning library/);
assert.match(library.body, /Resume chapter/);
assert.match(library.body, /value="60"/);

const chapter = await run(request({ authenticated: true, url: '/api/guided-edition?__paid_path=chapter-1' }));
assert.equal(chapter.statusCode, 200);
assert.match(chapter.body, /Implementation fixture—not manuscript content/);
assert.match(chapter.body, /id="orientation"/);
assert.match(chapter.body, /id="mastery-form"/);
assert.match(chapter.body, /Skip to content/);
assert.doesNotMatch(chapter.body, /correctOptionId|correctFeedback/);

const head = await run(request({ method: 'HEAD', authenticated: true, url: '/api/guided-edition?__paid_path=chapter-1' }));
assert.equal(head.statusCode, 200);
assert.equal(head.body, '');
assert.ok(Number(head.getHeader('content-length')) > 1000);

const missing = await run(request({ authenticated: true, url: '/api/guided-edition?__paid_path=chapter-99' }));
assert.equal(missing.statusCode, 404);
assert.equal(missing.body, 'Protected page not found.');

const anonymousProgress = await run(request({ url: '/api/guided-edition?action=progress&contentId=guided-edition%3Achapter-1' }));
assert.equal(anonymousProgress.statusCode, 401);
assert.equal(JSON.parse(anonymousProgress.body).code, 'AUTHENTICATION_REQUIRED');

const readProgress = await run(request({ authenticated: true, url: '/api/guided-edition?action=progress&contentId=guided-edition%3Achapter-1' }), {
  readProgress: async ({ accountId: receivedAccount }) => {
    assert.equal(receivedAccount, accountId);
    return { status: 'in_progress', progress_percent: 25, resume_position: 'orientation', attempt_count: 0 };
  },
});
assert.equal(readProgress.statusCode, 200);
assert.equal(JSON.parse(readProgress.body).progress.progressPercent, 25);

const invalidContent = await run(request({ authenticated: true, url: '/api/guided-edition?action=progress&contentId=private%3Aother' }));
assert.equal(invalidContent.statusCode, 400);
assert.equal(JSON.parse(invalidContent.body).code, 'INVALID_GUIDED_CONTENT');

let recordedProgress;
const writeProgress = await run(request({
  method: 'PATCH',
  authenticated: true,
  url: '/api/guided-edition?action=progress',
  headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  body: { contentId: 'guided-edition:chapter-1', progressPercent: 60, resumePosition: 'access-boundary' },
}), {
  recordProgress: async (input) => {
    recordedProgress = input;
    return { status: 'in_progress', progress_percent: 60, resume_position: 'access-boundary', attempt_count: 0 };
  },
});
assert.equal(writeProgress.statusCode, 200);
assert.equal(recordedProgress.accountId, accountId);
assert.equal(recordedProgress.contentVersion, 1);
assert.equal(recordedProgress.masteryScore, undefined);

const mismatchedProgress = await run(request({
  method: 'PATCH', authenticated: true, url: '/api/guided-edition?action=progress',
  headers: { 'content-type': 'application/json' },
  body: { contentId: 'guided-edition:chapter-1', progressPercent: 100, resumePosition: 'orientation' },
}));
assert.equal(mismatchedProgress.statusCode, 400);
assert.equal(JSON.parse(mismatchedProgress.body).code, 'INVALID_PROGRESS_PERCENT');

const crossSite = await run(request({
  method: 'PATCH', authenticated: true, url: '/api/guided-edition?action=progress',
  headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: {},
}));
assert.equal(crossSite.statusCode, 403);
assert.equal(JSON.parse(crossSite.body).code, 'CROSS_SITE_REQUEST');

let masteryWrite;
const mastery = await run(request({
  method: 'POST', authenticated: true, url: '/api/guided-edition?action=mastery',
  headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  body: { contentId: 'guided-edition:chapter-1', answers: { 'chapter-1-access-proof': 'verified-entitlement' } },
}), {
  recordProgress: async (input) => {
    masteryWrite = input;
    return { status: 'completed', progress_percent: 100, resume_position: 'next-step', mastery_score: 100, attempt_count: 1, completed_at: '2026-08-04T16:50:00.000Z' };
  },
});
assert.equal(mastery.statusCode, 200);
assert.equal(JSON.parse(mastery.body).passed, true);
assert.equal(masteryWrite.masteryPassed, true);
assert.equal(masteryWrite.attemptIncrement, 1);

const deniedApi = await run(request({ authenticated: true, url: '/api/guided-edition?action=progress&contentId=guided-edition%3Achapter-1' }), {
  readAccessState: async () => ({ allowed: false, reason: 'refunded' }),
});
assert.equal(deniedApi.statusCode, 403);
assert.equal(JSON.parse(deniedApi.body).reason, 'refunded');

const postPage = await run(request({ method: 'POST' }));
assert.equal(postPage.statusCode, 405);
assert.equal(postPage.getHeader('allow'), 'GET, HEAD');

console.log('Serverless Guided Edition routing, progress, and mastery tests passed.');
