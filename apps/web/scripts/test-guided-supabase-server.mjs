import assert from 'node:assert/strict';
import {
  readGuidedContentCatalog,
  readGuidedContentRelease,
  readGuidedLearningProgress,
  readGuidedSupplementCatalog,
  readGuidedSupplementRelease,
  recordGuidedLearningProgress,
} from '../src/lib/guided-supabase-server.js';
import { SupabaseRequestError } from '../src/lib/supabase-server.js';

const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const contentId = 'guided-edition:chapter-1';
const accessToken = 'guided-test-access-token-1234567890';
const config = {
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_test_1234567890123456',
  secretKey: 'sb_secret_test_12345678901234567890',
};

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return payload === null || payload === undefined ? '' : JSON.stringify(payload);
    },
  };
}

const progressRow = {
  account_id: accountId,
  content_id: contentId,
  status: 'in_progress',
  progress_percent: 50,
  resume_position: 'middle',
  mastery_score: null,
  attempt_count: 0,
  completed_at: null,
  data: { contentVersion: 2 },
  updated_at: '2026-08-22T12:00:00.000Z',
};

const progress = await readGuidedLearningProgress({
  accessToken,
  accountId,
  contentId,
  config,
  fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/rest/v1/learning_progress');
    assert.equal(parsed.searchParams.get('account_id'), `eq.${accountId}`);
    assert.equal(parsed.searchParams.get('content_id'), `eq.${contentId}`);
    assert.equal(options.headers.apikey, config.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    return response(200, [progressRow]);
  },
});
assert.deepEqual(progress, progressRow);

const releaseRow = {
  content_id: contentId,
  version: 2,
  chapter_number: 1,
  slug: 'chapter-1',
  status: 'published',
  source_sha256: 'a'.repeat(64),
  reader_sha256: 'b'.repeat(64),
  payload: { synthetic: true },
};

const byId = await readGuidedContentRelease({
  contentId,
  config,
  fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/rest/v1/guided_content_releases');
    assert.equal(parsed.searchParams.get('content_id'), `eq.${contentId}`);
    assert.equal(parsed.searchParams.has('slug'), false);
    assert.equal(parsed.searchParams.get('status'), 'eq.published');
    assert.match(parsed.searchParams.get('select'), /chapter_number/);
    assert.equal(options.headers.apikey, config.secretKey);
    assert.equal(options.headers.Authorization, `Bearer ${config.secretKey}`);
    return response(200, [releaseRow]);
  },
});
assert.deepEqual(byId, releaseRow);

const bySlug = await readGuidedContentRelease({
  slug: 'CHAPTER-1',
  config,
  fetchImpl: async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('slug'), 'eq.chapter-1');
    assert.equal(parsed.searchParams.has('content_id'), false);
    return response(200, [releaseRow]);
  },
});
assert.deepEqual(bySlug, releaseRow);

const catalog = await readGuidedContentCatalog({
  config,
  fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/rest/v1/guided_content_releases');
    assert.equal(parsed.searchParams.get('order'), 'chapter_number.asc');
    assert.equal(options.headers.apikey, config.secretKey);
    return response(200, [releaseRow]);
  },
});
assert.deepEqual(catalog, [releaseRow]);

const supplementRow = {
  content_id: 'guided-supplement:further-reading',
  version: 1,
  slug: 'further-reading',
  supplement_type: 'further-reading',
  sort_order: 1,
  status: 'published',
  source_sha256: 'c'.repeat(64),
  reader_sha256: 'd'.repeat(64),
  payload: { synthetic: true },
};

const supplement = await readGuidedSupplementRelease({
  slug: 'FURTHER-READING',
  config,
  fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/rest/v1/guided_supplement_releases');
    assert.equal(parsed.searchParams.get('slug'), 'eq.further-reading');
    assert.equal(options.headers.apikey, config.secretKey);
    return response(200, [supplementRow]);
  },
});
assert.deepEqual(supplement, supplementRow);

const supplements = await readGuidedSupplementCatalog({
  config,
  fetchImpl: async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('order'), 'sort_order.asc');
    return response(200, [supplementRow]);
  },
});
assert.deepEqual(supplements, [supplementRow]);

let recordedBody;
const recorded = await recordGuidedLearningProgress({
  accountId,
  contentId,
  progressPercent: 100,
  resumePosition: 'review',
  contentVersion: 2,
  masteryScore: 100,
  attemptIncrement: 1,
  masteryPassed: true,
  config,
  fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/rest/v1/rpc/record_guided_learning_progress');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.apikey, config.secretKey);
    recordedBody = JSON.parse(options.body);
    return response(200, [{ ...progressRow, status: 'completed', progress_percent: 100 }]);
  },
});
assert.equal(recorded.status, 'completed');
assert.deepEqual(recordedBody, {
  p_account_id: accountId,
  p_content_id: contentId,
  p_progress_percent: 100,
  p_resume_position: 'review',
  p_content_version: 2,
  p_mastery_score: 100,
  p_attempt_increment: 1,
  p_mastery_passed: true,
});

await assert.rejects(
  () => readGuidedContentRelease({ contentId, slug: 'chapter-1', config }),
  (error) => error instanceof SupabaseRequestError && error.code === 'INVALID_GUIDED_CONTENT',
);
await assert.rejects(
  () => readGuidedLearningProgress({ accessToken, accountId: 'invalid', contentId, config }),
  (error) => error instanceof SupabaseRequestError && error.code === 'INVALID_ACCOUNT_ID',
);

console.log('Guided Edition isolated Supabase access tests passed.');
