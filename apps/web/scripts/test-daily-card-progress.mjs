import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  readDailyCardReviewQueue,
  submitDailyCardReview,
} from '../src/lib/daily-card-progress.js';
import { handleDailyCardReviewRequest } from '../src/lib/daily-card-progress-handler.js';

const config = {
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: null,
};
const accessToken = 'abcdefghijklmnopqrstuvwxyz1234567890';
const userId = '123e4567-e89b-42d3-a456-426614174000';

function response({ ok = true, status = 200, payload = null } = {}) {
  return {
    ok,
    status,
    async text() {
      return payload === null ? '' : JSON.stringify(payload);
    },
  };
}

function apiResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(value = '') { this.body = String(value); },
  };
}

const queueCalls = [];
const queue = await readDailyCardReviewQueue({
  accessToken,
  limit: 2,
  config,
  now: new Date('2026-08-22T08:00:00.000Z'),
  fetchImpl: async (url, options = {}) => {
    queueCalls.push({ url, options });
    if (url.endsWith('/auth/v1/user')) {
      return response({ payload: {
        id: userId,
        email: 'member@example.com',
        email_confirmed_at: '2026-08-01T00:00:00.000Z',
      } });
    }
    return response({ payload: [{
      account_id: userId,
      content_id: 'card:card-real-yield',
      status: 'in_progress',
      progress_percent: 20,
      mastery_score: 20,
      attempt_count: 1,
      completed_at: null,
      data: { nextReviewAt: '2026-08-20T08:00:00.000Z' },
      created_at: '2026-08-19T08:00:00.000Z',
      updated_at: '2026-08-19T08:00:00.000Z',
    }] });
  },
});
assert.equal(queue.length, 2);
assert.equal(queue[0].id, 'card-real-yield');
assert.equal(queue[0].due, true);
assert.equal(queue[0].mastery, 20);
assert.match(queueCalls[1].url, /\/rest\/v1\/learning_progress\?/);
assert.equal(queueCalls[1].options.headers.apikey, config.publishableKey);
assert.equal(queueCalls[1].options.headers.Authorization, `Bearer ${accessToken}`);

const reviewCalls = [];
const reviewed = await submitDailyCardReview({
  accessToken,
  cardId: 'card-real-yield',
  rating: 'easy',
  config,
  now: new Date('2026-08-22T08:00:00.000Z'),
  fetchImpl: async (url, options = {}) => {
    reviewCalls.push({ url, options });
    if (url.endsWith('/auth/v1/user')) {
      return response({ payload: {
        id: userId,
        email: 'member@example.com',
        email_confirmed_at: '2026-08-01T00:00:00.000Z',
      } });
    }
    if (options.method === 'POST') {
      const stored = JSON.parse(options.body);
      return response({ payload: [stored] });
    }
    return response({ payload: [{
      account_id: userId,
      content_id: 'card:card-real-yield',
      status: 'in_progress',
      progress_percent: 20,
      mastery_score: 20,
      attempt_count: 2,
      completed_at: null,
      data: {
        correctCount: 1,
        incorrectCount: 1,
        nextReviewAt: '2026-08-20T08:00:00.000Z',
      },
    }] });
  },
});
assert.equal(reviewed.ok, true);
assert.equal(reviewed.rating, 'easy');
assert.equal(reviewed.mastery, 32);
assert.equal(reviewed.attemptCount, 3);
assert.equal(reviewCalls.length, 3);
assert.match(reviewCalls[1].url, /content_id=eq\.card%3Acard-real-yield/);
assert.match(reviewCalls[2].url, /on_conflict=account_id,content_id$/);
assert.equal(reviewCalls[2].options.method, 'POST');
assert.equal(reviewCalls[2].options.headers.Prefer, 'resolution=merge-duplicates,return=representation');
const reviewBody = JSON.parse(reviewCalls[2].options.body);
assert.equal(reviewBody.account_id, userId);
assert.equal(reviewBody.content_id, 'card:card-real-yield');
assert.equal(reviewBody.mastery_score, 32);
assert.equal(reviewBody.attempt_count, 3);
assert.equal(reviewBody.data.correctCount, 2);
assert.equal(reviewBody.data.incorrectCount, 1);
assert.equal(reviewBody.data.reviewIntervalDays, 1);

await assert.rejects(
  () => submitDailyCardReview({ accessToken, cardId: 'card-tga-reserves', rating: 'good', config }),
  /not available for adaptive review/,
);
await assert.rejects(
  () => submitDailyCardReview({ accessToken, cardId: 'card-real-yield', rating: 'perfect', config }),
  /must be again, hard, good, or easy/,
);

const priorFlag = process.env.ADAPTIVE_LEARNING_ENABLED;
delete process.env.ADAPTIVE_LEARNING_ENABLED;
const gatedResponse = apiResponse();
await handleDailyCardReviewRequest({ method: 'GET', headers: {}, url: '/api/account?action=daily-card-review' }, gatedResponse);
assert.equal(gatedResponse.statusCode, 404);
assert.equal(JSON.parse(gatedResponse.body).code, 'ADAPTIVE_LEARNING_DISABLED');
if (priorFlag === undefined) delete process.env.ADAPTIVE_LEARNING_ENABLED;
else process.env.ADAPTIVE_LEARNING_ENABLED = priorFlag;

const accountSource = await readFile(new URL('../api/account.js', import.meta.url), 'utf8');
assert.match(accountSource, /handleDailyCardReviewRequest/);
assert.match(accountSource, /'daily-card-review': handleDailyCardReviewRequest/);

const detailSource = await readFile(new URL('../src/pages/learn/[slug].astro', import.meta.url), 'utf8');
assert.match(detailSource, /<AdaptiveDailyCardReview cardId=\{card\.id\} \/>/);
const learnSource = await readFile(new URL('../src/pages/learn/index.astro', import.meta.url), 'utf8');
assert.match(learnSource, /<AdaptiveDailyReviewQueue \/>/);

console.log('Adaptive Daily Card progress and UI routing contract verified.');
