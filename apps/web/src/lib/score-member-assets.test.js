import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createScoreMemberAssetStore,
  rewriteScoreMemberLinks,
  scoreMemberAssetPath,
} from './score-member-assets.js';

const config = {
  url: 'https://example.supabase.co',
  secretKey: 'sb_secret_' + 'a'.repeat(32),
};

test('member asset path accepts only bounded Score HTML paths', () => {
  for (const [input, expected] of [
    ['/en/', '/en/'], ['en', '/en/'], ['/es', '/es/'],
    ['/archive/en', '/archive/en/'], ['archive/es/', '/archive/es/'],
    ['/archive/2026-10-16/en.html', '/archive/2026-10-16/en.html'],
  ]) {
    assert.equal(scoreMemberAssetPath(input), expected);
  }
  for (const value of [
    '', '/', '/../secret', '/archive/latest/en.html', '/archive/2026-10-16/score.json',
    '//attacker.test', '/en/index.html', '/archive/2026-10-16/en.html?x=1',
  ]) {
    assert.equal(scoreMemberAssetPath(value), null);
  }
});

test('archive links are rewritten under the authenticated Vercel member route', () => {
  const html = '<a href="/archive/2026-10-16/en.html">A</a>' +
    '<a href="/archive/es/">B</a><a href="/en/">C</a>';
  const rewritten = rewriteScoreMemberLinks(html);
  assert.match(rewritten, /href="\/score\/member\/archive\/2026-10-16\/en\.html"/);
  assert.match(rewritten, /href="\/score\/member\/archive\/es\/"/);
  assert.match(rewritten, /href="\/score\/member\/en\/"/);
});

test('private asset store requires privileged server config and exact provenance', async () => {
  let seenUrl = '';
  const store = createScoreMemberAssetStore({
    config,
    fetchImpl: async (url, init) => {
      seenUrl = String(url);
      assert.equal(init.headers.apikey, config.secretKey);
      return new Response(JSON.stringify([{
        path: '/en/',
        content_type: 'text/html; charset=utf-8',
        body: '<!doctype html><title>Score</title>',
        source_commit: 'b'.repeat(40),
        source_sha: 'c'.repeat(40),
      }]), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const asset = await store.read('/en/');
  assert.equal(asset.path, '/en/');
  assert.equal(asset.sourceCommit, 'b'.repeat(40));
  assert.match(seenUrl, /score_member_assets/);
  assert.match(seenUrl, /path=eq/);
});

test('missing or malformed asset fails closed', async () => {
  const empty = createScoreMemberAssetStore({
    config,
    fetchImpl: async () => new Response('[]', { status: 200 }),
  });
  assert.equal(await empty.read('/en/'), null);
  const malformed = createScoreMemberAssetStore({
    config,
    fetchImpl: async () => new Response(JSON.stringify([{
      path: '/en/', content_type: 'text/plain', body: 'x',
      source_commit: 'b'.repeat(40), source_sha: 'c'.repeat(40),
    }]), { status: 200 }),
  });
  assert.equal(await malformed.read('/en/'), null);
});
