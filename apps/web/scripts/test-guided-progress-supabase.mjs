import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SupabaseRequestError,
  readGuidedLearningProgress,
  recordGuidedLearningProgress,
} from '../src/lib/supabase-server.js';

const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.test-access-token-that-is-long-enough.signature';
const config = Object.freeze({
  url: 'https://development.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});
const response = (status, body) => new Response(body == null ? '' : JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const row = {
  account_id: accountId,
  content_id: 'guided-edition:chapter-1',
  status: 'in_progress',
  progress_percent: 60,
  resume_position: 'access-boundary',
  mastery_score: null,
  attempt_count: 0,
  completed_at: null,
  data: { contentVersion: 1 },
  updated_at: '2026-08-04T16:45:00.000Z',
};

const read = await readGuidedLearningProgress({
  accessToken,
  accountId,
  contentId: row.content_id,
  config,
  fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/rest/v1/learning_progress');
    assert.equal(parsed.searchParams.get('account_id'), `eq.${accountId}`);
    assert.equal(parsed.searchParams.get('content_id'), `eq.${row.content_id}`);
    assert.equal(options.headers.apikey, config.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    return response(200, [row]);
  },
});
assert.deepEqual(read, row);

let recordedBody;
const recorded = await recordGuidedLearningProgress({
  accountId,
  contentId: row.content_id,
  progressPercent: 100,
  resumePosition: 'next-step',
  contentVersion: 1,
  masteryScore: 100,
  attemptIncrement: 1,
  masteryPassed: true,
  config,
  fetchImpl: async (url, options) => {
    assert.equal(url, `${config.url}/rest/v1/rpc/record_guided_learning_progress`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.apikey, config.secretKey);
    assert.equal(options.headers.Authorization, `Bearer ${config.secretKey}`);
    recordedBody = JSON.parse(options.body);
    return response(200, { ...row, status: 'completed', progress_percent: 100, mastery_score: 100 });
  },
});
assert.equal(recorded.status, 'completed');
assert.deepEqual(recordedBody, {
  p_account_id: accountId,
  p_content_id: row.content_id,
  p_progress_percent: 100,
  p_resume_position: 'next-step',
  p_content_version: 1,
  p_mastery_score: 100,
  p_attempt_increment: 1,
  p_mastery_passed: true,
});

await assert.rejects(
  () => readGuidedLearningProgress({
    accessToken,
    accountId: 'not-a-uuid',
    contentId: row.content_id,
    config,
  }),
  (error) => error instanceof SupabaseRequestError && error.code === 'INVALID_ACCOUNT_ID',
);
await assert.rejects(
  () => recordGuidedLearningProgress({
    accountId,
    contentId: 'other:chapter-1',
    progressPercent: 25,
    resumePosition: 'orientation',
    contentVersion: 1,
    config,
  }),
  (error) => error instanceof SupabaseRequestError && error.code === 'INVALID_GUIDED_CONTENT',
);

const migration = await readFile(
  new URL('../../../supabase/migrations/20260804163445_guided_edition_progress_foundation.sql', import.meta.url),
  'utf8',
);
assert.match(migration, /revoke insert, update, delete on public\.learning_progress from anon, authenticated;/);
for (const policy of ['learning_progress_insert_own', 'learning_progress_update_own', 'learning_progress_delete_own']) {
  assert.match(migration, new RegExp(`drop policy if exists ${policy}`));
}
assert.match(migration, /create or replace function public\.record_guided_learning_progress/);
assert.match(migration, /security invoker/);
assert.match(migration, /e\.product_id = 'read-the-dollar-first-guided-interactive-edition'/);
assert.match(migration, /e\.state = 'active'/);
assert.match(migration, /on conflict \(account_id, content_id\) do update/);
assert.match(migration, /grant execute on function public\.record_guided_learning_progress[\s\S]*to service_role;/);
assert.doesNotMatch(migration, /grant execute on function public\.record_guided_learning_progress[\s\S]*to authenticated;/);

console.log('Supabase Guided Edition progress boundary tests passed.');
