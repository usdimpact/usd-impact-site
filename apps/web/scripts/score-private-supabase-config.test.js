import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  readScorePrivateSupabaseConfig, SCORE_HANDOFF_PREVIEW_BRANCH,
} from '../src/lib/score-private-supabase-config.js';

const publishable = 'sb_publishable_' + 'p'.repeat(32);
const dedicated = 'sb_secret_' + 'd'.repeat(32);
const ordinaryServerKey = 'sb_secret_' + 'g'.repeat(32);
const env = Object.freeze({
  VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: SCORE_HANDOFF_PREVIEW_BRANCH,
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: publishable,
  // Simulate the observed wrong-provider shared Preview key; never use its
  // value for Score. The prefix below is a test fixture, not a credential.
  SUPABASE_SECRET_KEY: 'sk_live_' + 'x'.repeat(32),
  SCORE_PREVIEW_SUPABASE_SECRET_KEY: dedicated,
});

test('isolated Score Preview uses dedicated Development key, never generic Preview key', () => {
  const result = readScorePrivateSupabaseConfig(env);
  assert.equal(result.url, env.SUPABASE_URL);
  assert.equal(result.publishableKey, publishable);
  assert.equal(result.secretKey, dedicated);
  assert.equal(env.SUPABASE_SECRET_KEY.startsWith('sk_live_'), true);
  assert.equal(Object.isFrozen(result), true);
});

test('matching Score Preview branch refuses a missing dedicated secret even when a shared key exists', () => {
  assert.throws(
    () => readScorePrivateSupabaseConfig({
      ...env,
      SCORE_PREVIEW_SUPABASE_SECRET_KEY: undefined,
      SUPABASE_SECRET_KEY: ordinaryServerKey,
    }),
    /SUPABASE_SECRET_KEY is missing or invalid/,
  );
});

test('wrong-provider or short dedicated Score key is rejected without fallback', () => {
  for (const invalid of ['', 'sk_live_' + 'x'.repeat(40), 'sb_secret_short', null]) {
    assert.throws(() => readScorePrivateSupabaseConfig({
      ...env, SCORE_PREVIEW_SUPABASE_SECRET_KEY: invalid,
    }), /SUPABASE_SECRET_KEY is missing or invalid/);
  }
});

test('Production cannot consume Preview-only dedicated secret', () => {
  assert.throws(() => readScorePrivateSupabaseConfig({
    ...env, VERCEL_ENV: 'production',
  }), /SUPABASE_SECRET_KEY is missing or invalid/);
  const production = readScorePrivateSupabaseConfig({
    ...env, VERCEL_ENV: 'production', SUPABASE_SECRET_KEY: ordinaryServerKey,
  });
  assert.equal(production.secretKey, ordinaryServerKey);
});

test('other Preview branches cannot select the dedicated Score secret', () => {
  assert.throws(() => readScorePrivateSupabaseConfig({
    ...env, VERCEL_GIT_COMMIT_REF: 'other-preview-branch',
  }), /SUPABASE_SECRET_KEY is missing or invalid/);
});

test('Vercel member content uses the isolated private asset config, not generic Preview SUPABASE_SECRET_KEY', async () => {
  const src = await readFile(new URL('../src/lib/score-member-handler.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ readScorePrivateSupabaseConfig \} from '.\/score-private-supabase-config\.js'/);
  assert.match(src, /readScorePrivateSupabaseConfig\(/);
  assert.doesNotMatch(src, /readSupabaseServerConfig\(/);
});
