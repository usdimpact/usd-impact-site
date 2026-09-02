import assert from 'node:assert/strict';
import { handleAudiobookRequest, renderProtectedAudiobook } from '../src/lib/audiobook-handler.js';
import { SESSION_COOKIE_NAMES } from '../src/lib/supabase-auth.js';

const token = 'x'.repeat(40);
function request(path = '', { method = 'GET', authenticated = false } = {}) {
  return {
    method,
    url: `/api/guided-edition?__audiobook=1${path ? `&__audio_path=${encodeURIComponent(path)}` : ''}`,
    headers: {
      host: 'www.usd-impact.com',
      'x-forwarded-proto': 'https',
      ...(authenticated ? { cookie: `${SESSION_COOKIE_NAMES.ACCESS}=${token}` } : {}),
    },
  };
}
function response() {
  const headers = new Map();
  return { statusCode: 200, body: '', setHeader(k, v) { headers.set(k.toLowerCase(), v); }, getHeader(k) { return headers.get(k.toLowerCase()); }, end(v = '') { this.body = v; } };
}

const publicHtml = renderProtectedAudiobook();
assert.equal((publicHtml.match(/data-track data-index=/g) || []).length, 20);
assert.doesNotMatch(publicHtml, /\.public\.blob\.vercel-storage\.com/);
assert.doesNotMatch(publicHtml, /https:\/\/[^\s'\"]+\.mp3/);
assert.match(publicHtml, /\/guided-edition\/audiobook\/track\/read-the-dollar-first\//);
assert.match(publicHtml, /<nav class="site-nav" aria-label="Library navigation">/);
assert.match(publicHtml, /href="\/guided-edition\/">Guided Edition<\/a>/);
assert.match(publicHtml, /href="\/guided-edition\/book\/">Book<\/a>/);
assert.match(publicHtml, /href="\/guided-edition\/audiobook\/" aria-current="page">Audiobook<\/a>/);
assert.match(publicHtml, /href="\/guided-edition\/video-library\/">Video Library<\/a>/);
assert.match(publicHtml, /href="\/account\/">Account<\/a>/);

const anonymous = response();
await handleAudiobookRequest(request(), anonymous);
assert.equal(anonymous.statusCode, 302);
assert.match(anonymous.getHeader('location'), /^\/account\/sign-in\//);
assert.match(anonymous.getHeader('cache-control'), /no-store/);

const denied = response();
await handleAudiobookRequest(request('', { authenticated: true }), denied, { readAccessState: async () => ({ allowed: false, reason: 'refunded' }) });
assert.equal(denied.statusCode, 302);
assert.match(denied.getHeader('location'), /reason=refunded/);

const eligible = response();
await handleAudiobookRequest(request('', { authenticated: true }), eligible, { readAccessState: async () => ({ allowed: true }) });
assert.equal(eligible.statusCode, 200);
assert.match(eligible.body, /Protected Library Pass audiobook/);

let signedSlug = null;
const track = response();
await handleAudiobookRequest(request('track/read-the-dollar-first', { authenticated: true }), track, {
  readAccessState: async () => ({ allowed: true }),
  createSignedUrl: async ({ slug }) => {
    signedSlug = slug;
    return 'https://project-ref.supabase.co/storage/v1/object/sign/library-pass-assets/audiobook/read-the-dollar-first/v1/00-read-the-dollar-first.mp3?token=temporary';
  },
});
assert.equal(track.statusCode, 302);
assert.equal(signedSlug, 'read-the-dollar-first');
assert.match(track.getHeader('location'), /^https:\/\/project-ref\.supabase\.co\/storage\/v1\/object\/sign\//);

const missing = response();
await handleAudiobookRequest(request('track/missing', { authenticated: true }), missing, { readAccessState: async () => ({ allowed: true }) });
assert.equal(missing.statusCode, 404);

const signingFailure = response();
await handleAudiobookRequest(request('track/read-the-dollar-first', { authenticated: true }), signingFailure, {
  readAccessState: async () => ({ allowed: true }),
  createSignedUrl: async () => { throw new Error('storage unavailable'); },
});
assert.equal(signingFailure.statusCode, 503);

const post = response();
await handleAudiobookRequest(request('', { method: 'POST' }), post);
assert.equal(post.statusCode, 405);
assert.equal(post.getHeader('allow'), 'GET, HEAD');

console.log('Protected audiobook handler tests passed.');
