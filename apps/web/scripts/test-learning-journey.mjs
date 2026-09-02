import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleAccess } from '../api/account.js';
import { buildLearningJourney } from '../src/lib/learning-journey.js';
import { readOwnLearningProgress } from '../src/lib/supabase-server.js';

const accountId = ['00000000', '0000', '4000', '8000', '000000000001'].join('-');
const accessToken = Array(6).fill('example').join('-');
const config = Object.freeze({
  url: 'https://example.invalid',
  publishableKey: 'public-test-key',
  secretKey: null,
});

const accountPage = await readFile(new URL('../src/pages/account/index.astro', import.meta.url), 'utf8');
assert.match(accountPage, /<main id="main-content">/);
assert.match(accountPage, /id="next-step-heading"/);
assert.match(accountPage, /How to use USD Impact/);
assert.match(accountPage, /Explore another section/);
assert.match(accountPage, /aria-label="Saved learning progress"/);
assert.match(accountPage, /aria-hidden="true"/);
assert.match(accountPage, /safeInternalHref/);
assert.match(accountPage, /no additional activity tracking was added/);
assert.doesNotMatch(accountPage, /<img[^>]+account-icon/i);

function progressRow(contentId, overrides = {}) {
  return {
    content_id: contentId,
    status: 'in_progress',
    progress_percent: 35,
    resume_position: 'framework-baseline',
    completed_at: null,
    updated_at: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = value; },
  };
}

function accountRequest() {
  return {
    method: 'GET',
    url: '/api/account?action=access',
    headers: { authorization: `Bearer ${accessToken}` },
  };
}

function accessState(allowed = true) {
  return {
    user: { id: accountId, email: 'reader@example.com' },
    profile: { status: 'active' },
    entitlement: allowed
      ? { productId: 'read-the-dollar-first-library-pass', state: 'active' }
      : null,
    allowed,
    reason: allowed ? 'active' : 'missing-entitlement',
  };
}

const noAccess = buildLearningJourney({
  hasPaidAccess: false,
  rows: [progressRow('guided-edition:chapter-1')],
});
assert.equal(noAccess.nextStep.kind, 'product');
assert.equal(noAccess.activityCount, 0, 'inactive access must not expose supplied progress');

const newMember = buildLearningJourney({ hasPaidAccess: true, rows: [] });
assert.equal(newMember.available, true);
assert.equal(newMember.nextStep.kind, 'start-guided-edition');

const guidedResume = buildLearningJourney({
  hasPaidAccess: true,
  rows: [progressRow('guided-edition:chapter-2', { resume_position: 'test-middle' })],
});
assert.equal(guidedResume.nextStep.kind, 'resume-guided-edition');
assert.equal(guidedResume.nextStep.href, '/guided-edition/chapter-2/#test-middle');
assert.equal(guidedResume.inProgressCount, 1);

const videoResume = buildLearningJourney({
  hasPaidAccess: true,
  rows: [
    progressRow('guided-edition:chapter-2', { updated_at: '2026-08-31T12:00:00.000Z' }),
    progressRow('video:dollar-yields-liquidity', {
      resume_position: '24.5',
      updated_at: '2026-09-01T12:00:00.000Z',
    }),
  ],
});
assert.equal(videoResume.nextStep.kind, 'resume-video');
assert.equal(videoResume.nextStep.href, '/guided-edition/video-library/dollar-yields-liquidity/');

const videoRecommendation = buildLearningJourney({
  hasPaidAccess: true,
  rows: [progressRow('guided-edition:chapter-1', {
    status: 'completed',
    progress_percent: 100,
    completed_at: '2026-08-30T10:00:00.000Z',
  })],
});
assert.equal(videoRecommendation.nextStep.kind, 'explore-video-library');

const audiobookRecommendation = buildLearningJourney({
  hasPaidAccess: true,
  rows: [
    progressRow('guided-edition:chapter-1', { status: 'completed', progress_percent: 100 }),
    progressRow('video:dollar-yields-liquidity', { status: 'completed', progress_percent: 100 }),
  ],
});
assert.equal(audiobookRecommendation.nextStep.kind, 'explore-audiobook');
assert.deepEqual(audiobookRecommendation.formatCounts, {
  guidedEdition: 1,
  video: 1,
  dailyCard: 0,
});

const sanitized = buildLearningJourney({
  hasPaidAccess: true,
  rows: [
    progressRow('guided-edition:chapter-1', { updated_at: '2026-08-30T10:00:00.000Z' }),
    progressRow('guided-edition:chapter-1', { updated_at: '2026-09-01T10:00:00.000Z' }),
    progressRow('private:secret-answer'),
    progressRow('video:../unsafe'),
    progressRow(`video:${'a'.repeat(120)}`),
    progressRow('card:real-yield', { status: 'unexpected' }),
  ],
});
assert.equal(sanitized.activityCount, 1, 'duplicates and unrecognized rows must not inflate counts');
assert.equal(Object.isFrozen(sanitized), true);
assert.equal(Object.isFrozen(sanitized.nextStep), true);
const serialized = JSON.stringify(sanitized);
assert.doesNotMatch(serialized, /content_id|contentId|resume_position|secret-answer/);

const unavailable = buildLearningJourney({
  hasPaidAccess: true,
  progressAvailable: false,
  rows: [progressRow('guided-edition:chapter-1')],
});
assert.equal(unavailable.available, false);
assert.equal(unavailable.activityCount, 0);
assert.equal(unavailable.nextStep.kind, 'start-guided-edition');

const storedRows = await readOwnLearningProgress({
  accessToken,
  accountId,
  config,
  fetchImpl: async (url, options) => {
    assert.match(url, /\/rest\/v1\/learning_progress\?/);
    assert.ok(url.includes(`account_id=eq.${accountId}`));
    assert.match(url, /select=content_id,status,progress_percent,resume_position,completed_at,updated_at/);
    assert.match(url, /order=updated_at\.desc&limit=500$/);
    assert.doesNotMatch(url, /data|mastery_score|attempt_count/);
    assert.equal(options.headers.apikey, config.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    return new Response(JSON.stringify([progressRow('guided-edition:chapter-3')]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
assert.equal(storedRows.length, 1);
assert.equal(Object.isFrozen(storedRows[0]), true);

const activeResponse = responseRecorder();
await handleAccess(accountRequest(), activeResponse, {
  readAccountAccessState: async ({ accessToken: providedToken }) => {
    assert.equal(providedToken, accessToken);
    return accessState(true);
  },
  readOwnLearningProgress: async ({ accessToken: providedToken, accountId: providedAccountId }) => {
    assert.equal(providedToken, accessToken);
    assert.equal(providedAccountId, accountId);
    return [progressRow('guided-edition:chapter-4')];
  },
});
assert.equal(activeResponse.statusCode, 200);
const activeBody = JSON.parse(activeResponse.body);
assert.equal(activeBody.learningJourney.nextStep.kind, 'resume-guided-edition');
assert.equal(activeBody.learningJourney.activityCount, 1);

let inactiveProgressRead = false;
const inactiveResponse = responseRecorder();
await handleAccess(accountRequest(), inactiveResponse, {
  readAccountAccessState: async () => accessState(false),
  readOwnLearningProgress: async () => {
    inactiveProgressRead = true;
    return [];
  },
});
assert.equal(inactiveProgressRead, false, 'progress must not be read without active paid access');
assert.equal(JSON.parse(inactiveResponse.body).learningJourney.nextStep.kind, 'product');

const originalConsoleError = console.error;
console.error = () => {};
try {
  const fallbackResponse = responseRecorder();
  await handleAccess(accountRequest(), fallbackResponse, {
    readAccountAccessState: async () => accessState(true),
    readOwnLearningProgress: async () => {
      const error = new Error('storage unavailable');
      error.code = 'TEST_PROGRESS_UNAVAILABLE';
      throw error;
    },
  });
  assert.equal(fallbackResponse.statusCode, 200, 'progress failure must not block account access');
  const fallbackBody = JSON.parse(fallbackResponse.body);
  assert.equal(fallbackBody.learningJourney.available, false);
  assert.equal(fallbackBody.learningJourney.nextStep.kind, 'start-guided-edition');
} finally {
  console.error = originalConsoleError;
}

console.log('Learning journey tests passed.');
