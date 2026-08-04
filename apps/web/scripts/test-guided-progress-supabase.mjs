import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SupabaseRequestError,
  readGuidedContentCatalog,
  readGuidedContentRelease,
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
  progress_percent: 50,
  resume_position: 'test-middle',
  mastery_score: null,
  attempt_count: 0,
  completed_at: null,
  data: { contentVersion: 2 },
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

const releaseRow = {
  content_id: row.content_id,
  version: 2,
  chapter_number: 1,
  slug: 'chapter-1',
  status: 'published',
  source_sha256: 'a'.repeat(64),
  reader_sha256: 'b'.repeat(64),
  payload: { synthetic: true },
};
const release = await readGuidedContentRelease({
  contentId: row.content_id,
  config,
  fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/rest/v1/guided_content_releases');
    assert.equal(parsed.searchParams.get('content_id'), `eq.${row.content_id}`);
    assert.equal(parsed.searchParams.has('version'), false);
    assert.equal(parsed.searchParams.get('status'), 'eq.published');
    assert.match(parsed.searchParams.get('select'), /chapter_number/);
    assert.equal(options.headers.apikey, config.secretKey);
    assert.equal(options.headers.Authorization, `Bearer ${config.secretKey}`);
    return response(200, [releaseRow]);
  },
});
assert.deepEqual(release, releaseRow);

const releaseBySlug = await readGuidedContentRelease({
  slug: 'CHAPTER-1',
  config,
  fetchImpl: async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('slug'), 'eq.chapter-1');
    assert.equal(parsed.searchParams.has('content_id'), false);
    return response(200, [releaseRow]);
  },
});
assert.deepEqual(releaseBySlug, releaseRow);

const missingRelease = await readGuidedContentRelease({
  slug: 'chapter-99',
  config,
  fetchImpl: async () => response(200, []),
});
assert.equal(missingRelease, null);

const catalog = await readGuidedContentCatalog({
  config,
  fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/rest/v1/guided_content_releases');
    assert.equal(parsed.searchParams.get('status'), 'eq.published');
    assert.equal(parsed.searchParams.get('order'), 'chapter_number.asc');
    assert.equal(options.headers.apikey, config.secretKey);
    assert.equal(options.headers.Authorization, `Bearer ${config.secretKey}`);
    return response(200, [releaseRow]);
  },
});
assert.deepEqual(catalog, [releaseRow]);

await assert.rejects(
  () => readGuidedContentRelease({ contentId: row.content_id, slug: 'chapter-1', config }),
  (error) => error instanceof SupabaseRequestError && error.code === 'INVALID_GUIDED_CONTENT',
);

let recordedBody;
const recorded = await recordGuidedLearningProgress({
  accountId,
  contentId: row.content_id,
  progressPercent: 100,
  resumePosition: 'test-review',
  contentVersion: 2,
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
  p_resume_position: 'test-review',
  p_content_version: 2,
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
    resumePosition: 'test-middle',
    contentVersion: 2,
    config,
  }),
  (error) => error instanceof SupabaseRequestError && error.code === 'INVALID_GUIDED_CONTENT',
);

const foundationMigration = await readFile(
  new URL('../../../supabase/migrations/20260804163445_guided_edition_progress_foundation.sql', import.meta.url),
  'utf8',
);
assert.match(foundationMigration, /revoke insert, update, delete on public\.learning_progress from anon, authenticated;/);
for (const policy of ['learning_progress_insert_own', 'learning_progress_update_own', 'learning_progress_delete_own']) {
  assert.match(foundationMigration, new RegExp(`drop policy if exists ${policy}`));
}
assert.match(foundationMigration, /create or replace function public\.record_guided_learning_progress/);
assert.match(foundationMigration, /security invoker/);
assert.match(foundationMigration, /e\.product_id = 'read-the-dollar-first-guided-interactive-edition'/);
assert.match(foundationMigration, /e\.state = 'active'/);

const versionResetMigration = await readFile(
  new URL('../../../supabase/migrations/20260804170311_reset_guided_progress_on_content_version_change.sql', import.meta.url),
  'utf8',
);
assert.match(versionResetMigration, /create or replace function public\.record_guided_learning_progress/);
assert.match(versionResetMigration, /security invoker/);
assert.match(versionResetMigration, /e\.product_id = 'read-the-dollar-first-guided-interactive-edition'/);
assert.match(versionResetMigration, /e\.state = 'active'/);
assert.match(versionResetMigration, /on conflict \(account_id, content_id\) do update/);
assert.match(versionResetMigration, /not coalesce\(target\.data @> excluded\.data, false\)/);
assert.match(versionResetMigration, /data = excluded\.data/);
assert.match(versionResetMigration, /when not coalesce\(target\.data @> excluded\.data, false\) then excluded\.mastery_score/);
assert.match(versionResetMigration, /when not coalesce\(target\.data @> excluded\.data, false\) then excluded\.attempt_count/);
assert.match(versionResetMigration, /when not coalesce\(target\.data @> excluded\.data, false\) then excluded\.completed_at/);
assert.match(versionResetMigration, /grant execute on function public\.record_guided_learning_progress[\s\S]*to service_role;/);
assert.doesNotMatch(versionResetMigration, /grant execute on function public\.record_guided_learning_progress[\s\S]*to authenticated;/);

const privateContentMigration = await readFile(
  new URL('../../../supabase/migrations/20260804172251_store_guided_content_privately.sql', import.meta.url),
  'utf8',
);
assert.match(privateContentMigration, /create table public\.guided_content_releases/);
assert.match(privateContentMigration, /primary key \(content_id, version\)/);
assert.match(privateContentMigration, /alter table public\.guided_content_releases enable row level security/);
assert.match(privateContentMigration, /alter table public\.guided_content_releases force row level security/);
assert.match(privateContentMigration, /revoke all on public\.guided_content_releases from public, anon, authenticated/);
assert.match(privateContentMigration, /grant select on public\.guided_content_releases to service_role/);
assert.match(privateContentMigration, /guided_content_releases_deny_client_access[\s\S]*using \(false\)/);
assert.doesNotMatch(privateContentMigration, /insert into public\.guided_content_releases/);

const catalogMigration = await readFile(
  new URL('../../../supabase/migrations/20260804174902_publish_guided_content_catalog.sql', import.meta.url),
  'utf8',
);
assert.match(catalogMigration, /add column chapter_number integer/);
assert.match(catalogMigration, /alter column chapter_number set not null/);
assert.match(catalogMigration, /guided_content_releases_chapter_number[\s\S]*chapter_number > 0/);
for (const index of [
  'guided_content_releases_one_published_content_idx',
  'guided_content_releases_one_published_slug_idx',
  'guided_content_releases_published_chapter_number_idx',
]) {
  assert.match(catalogMigration, new RegExp(`create unique index ${index}`));
}
assert.equal((catalogMigration.match(/where status = 'published'/g) || []).length, 3);

console.log('Supabase Guided Edition private catalog and progress boundary tests passed.');
