import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleBookDeliveryRequest, renderProtectedBook } from '../src/lib/book-delivery-handler.js';
import { BOOK_DOWNLOAD_PATH, privateBookDocument } from '../src/lib/private-book.js';
import { SESSION_COOKIE_NAMES } from '../src/lib/supabase-auth.js';

const token = 'x'.repeat(40);
function request(path = '', { method = 'GET', authenticated = false } = {}) {
  return {
    method,
    url: `/api/guided-edition?__book=1${path ? `&__book_path=${encodeURIComponent(path)}` : ''}`,
    headers: {
      host: 'usd-impact-site-test-usd-impact.vercel.app',
      'x-forwarded-proto': 'https',
      ...(authenticated ? { cookie: `${SESSION_COOKIE_NAMES.ACCESS}=${token}` } : {}),
    },
  };
}
function response() {
  const headers = new Map();
  return { statusCode: 200, body: '', setHeader(k, v) { headers.set(k.toLowerCase(), v); }, getHeader(k) { return headers.get(k.toLowerCase()); }, end(v = '') { this.body = v; } };
}

const protectedHtml = renderProtectedBook();
assert.match(protectedHtml, /Protected Library Pass digital reader/);
assert.match(protectedHtml, /Edition 1\.3/);
assert.match(protectedHtml, /Phase 2C Scoped Candidate 2/);
assert.match(protectedHtml, new RegExp(privateBookDocument.sha256));
assert.equal(protectedHtml.includes(privateBookDocument.accessibility), true);
assert.match(protectedHtml, /This private digital-reader PDF is untagged and is not PDF\/UA-conformant\./);
assert.match(protectedHtml, /This limitation is accepted for private Library Pass delivery\./);
assert.match(protectedHtml, /The PDF must not be represented as PDF\/UA-conformant\./);
assert.doesNotMatch(protectedHtml, /review PDF|private Development proof|does not represent publication approval|not publication-approved/i);
assert.match(protectedHtml, new RegExp(BOOK_DOWNLOAD_PATH.replaceAll('/', '\\/')));
assert.match(protectedHtml, /<nav class="site-nav" aria-label="Library navigation">/);
assert.match(protectedHtml, /href="\/guided-edition\/">Guided Edition<\/a>/);
assert.match(protectedHtml, /href="\/guided-edition\/book\/" aria-current="page">Book<\/a>/);
assert.match(protectedHtml, /href="\/guided-edition\/audiobook\/">Audiobook<\/a>/);
assert.match(protectedHtml, /href="\/guided-edition\/video-library\/">Video Library<\/a>/);
assert.match(protectedHtml, /href="\/account\/">Account<\/a>/);
assert.doesNotMatch(protectedHtml, /supabase\.co|service_role|sb_secret_/);

let anonymousRead = false;
const anonymous = response();
await handleBookDeliveryRequest(request(), anonymous, {
  readAccessState: async () => { anonymousRead = true; return { allowed: true }; },
});
assert.equal(anonymous.statusCode, 302);
assert.equal(anonymousRead, false);
const anonymousLocation = new URL(anonymous.getHeader('location'), 'https://usd-impact-site-test-usd-impact.vercel.app');
assert.equal(anonymousLocation.pathname, '/account/sign-in/');
assert.equal(anonymousLocation.searchParams.get('next'), '/guided-edition/book/');
assert.match(anonymous.getHeader('cache-control'), /no-store/);

const denied = response();
await handleBookDeliveryRequest(request('', { authenticated: true }), denied, {
  readAccessState: async () => ({ allowed: false, reason: 'refunded' }),
});
assert.equal(denied.statusCode, 302);
assert.match(denied.getHeader('location'), /reason=refunded/);

const eligible = response();
await handleBookDeliveryRequest(request('', { authenticated: true }), eligible, {
  readAccessState: async () => ({ allowed: true }),
});
assert.equal(eligible.statusCode, 200);
assert.match(eligible.getHeader('content-type'), /text\/html/);
assert.equal(eligible.getHeader('vary'), 'Cookie, Authorization');
assert.match(eligible.body, /Your private book file/);

let signed = false;
const download = response();
await handleBookDeliveryRequest(request('download', { authenticated: true }), download, {
  readAccessState: async () => ({ allowed: true }),
  createSignedUrl: async () => {
    signed = true;
    return `https://project-ref.supabase.co/storage/v1/object/sign/library-pass-books/${privateBookDocument.objectPath}?token=temporary`;
  },
});
assert.equal(download.statusCode, 302);
assert.equal(signed, true);
assert.match(download.getHeader('location'), /^https:\/\/project-ref\.supabase\.co\/storage\/v1\/object\/sign\/library-pass-books\//);

const downloadHead = response();
await handleBookDeliveryRequest(request('download', { authenticated: true, method: 'HEAD' }), downloadHead, {
  readAccessState: async () => ({ allowed: true }),
  createSignedUrl: async () => { throw new Error('HEAD must not mint a URL'); },
});
assert.equal(downloadHead.statusCode, 200);

const missing = response();
await handleBookDeliveryRequest(request('missing', { authenticated: true }), missing, {
  readAccessState: async () => ({ allowed: true }),
});
assert.equal(missing.statusCode, 404);

const signingFailure = response();
await handleBookDeliveryRequest(request('download', { authenticated: true }), signingFailure, {
  readAccessState: async () => ({ allowed: true }),
  createSignedUrl: async () => { throw new Error('storage unavailable'); },
});
assert.equal(signingFailure.statusCode, 503);
assert.equal(signingFailure.body, 'The private book is temporarily unavailable.');

const post = response();
await handleBookDeliveryRequest(request('', { method: 'POST' }), post);
assert.equal(post.statusCode, 405);
assert.equal(post.getHeader('allow'), 'GET, HEAD');

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const rewrites = new Map(config.rewrites.map((entry) => [entry.source, entry.destination]));
assert.equal(rewrites.get('/guided-edition/book'), '/api/guided-edition?__book=1');
assert.equal(rewrites.get('/guided-edition/book/:path*'), '/api/guided-edition?__book=1&__book_path=:path*');
const guidedApi = await readFile(new URL('../api/guided-edition.js', import.meta.url), 'utf8');
assert.match(guidedApi, /handleBookDeliveryRequest/);
assert.match(guidedApi, /__book/);

console.log('Protected book anonymous-denial, entitlement, accessibility copy, routing, and signed-URL handler tests passed.');
