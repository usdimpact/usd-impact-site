import assert from 'node:assert/strict';
import {
  readOwnVideoProgress,
  upsertOwnVideoProgress,
} from '../src/lib/supabase-server.js';

const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.video-progress-storage-token.signature';
const contentId = 'video:dollar-yields-liquidity';
const config = Object.freeze({
  url: 'https://development.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: null,
});

const response = (status, body) => new Response(body == null ? '' : JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const rows = await readOwnVideoProgress({
  accessToken,
  accountId,
  config,
  fetchImpl: async (url, options) => {
    assert.match(url, /\/rest\/v1\/learning_progress\?/);
    assert.match(url, /account_id=eq\.46d8a4a1-e616-4d9d-8faf-d877a42af310/);
    assert.match(url, /content_id=like\.video:\*/);
    assert.equal(options.headers.apikey, config.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    return response(200, [{
      account_id: accountId,
      content_id: contentId,
      status: 'in_progress',
      progress_percent: 42,
      resume_position: '23.0',
    }]);
  },
});
assert.equal(rows.length, 1);
assert.equal(rows[0].content_id, contentId);
assert.equal(Object.isFrozen(rows[0]), true);

let requestCount = 0;
const completed = await upsertOwnVideoProgress({
  accessToken,
  accountId,
  contentId,
  status: 'in_progress',
  progressPercent: 12,
  resumePositionSeconds: 7.4,
  durationSeconds: 56.2,
  config,
  fetchImpl: async (url, options) => {
    requestCount += 1;
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    if (requestCount === 1) {
      assert.match(url, /content_id=eq\.video%3Adollar-yields-liquidity/);
      return response(200, [{
        account_id: accountId,
        content_id: contentId,
        status: 'completed',
        progress_percent: 100,
        resume_position: '56.2',
        completed_at: '2026-08-18T18:00:00.000Z',
      }]);
    }

    assert.equal(url, `${config.url}/rest/v1/learning_progress?on_conflict=account_id,content_id`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Prefer, 'resolution=merge-duplicates,return=representation');
    const body = JSON.parse(options.body);
    assert.equal(body.account_id, accountId);
    assert.equal(body.content_id, contentId);
    assert.equal(body.status, 'completed');
    assert.equal(body.progress_percent, 100);
    assert.equal(body.completed_at, '2026-08-18T18:00:00.000Z');
    assert.equal(body.resume_position, '7.4');
    assert.deepEqual(body.data, { contentType: 'video', durationSeconds: 56.2 });
    return response(200, [body]);
  },
});
assert.equal(requestCount, 2);
assert.equal(completed.status, 'completed');

await assert.rejects(() => upsertOwnVideoProgress({
  accessToken,
  accountId,
  contentId: 'video:../invalid',
  status: 'in_progress',
  progressPercent: 5,
  resumePositionSeconds: 2,
  durationSeconds: 40,
  config,
  fetchImpl: async () => response(500, {}),
}), /valid video content ID/);

console.log('Supabase video progress storage tests passed.');
