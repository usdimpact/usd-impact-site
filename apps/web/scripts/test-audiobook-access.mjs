import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleAudiobookRequest } from '../api/audiobook.js';
import {
  AUDIOBOOK_SIGNED_URL_TTL_MS,
  createPrivateAudiobookUrl,
} from '../src/lib/audiobook-access.js';
import { SESSION_COOKIE_NAMES } from '../src/lib/supabase-auth.js';

const accessToken = 'eyJhbGciOiJIUzI1NiJ9.audiobook-library-pass-token.signature';
const privateBlobEnvironment = Object.freeze({
  AUDIOBOOK_BLOB_STORE_ID: 'store_teststore',
  AUDIOBOOK_BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_teststore_private-signing-token',
});

function request({ method = 'GET', chapter = '0', authenticated = false } = {}) {
  return {
    method,
    url: `/api/audiobook?chapter=${encodeURIComponent(chapter)}`,
    headers: authenticated
      ? { cookie: `${SESSION_COOKIE_NAMES.ACCESS}=${encodeURIComponent(accessToken)}` }
      : {},
  };
}

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = value; },
  };
}

const nowMs = Date.parse('2026-08-10T20:00:00.000Z');
let issuedOptions;
let presignedOptions;
const signed = await createPrivateAudiobookUrl({
  pathname: 'read-the-dollar-first/00-read-the-dollar-first.mp3',
  nowMs,
  environment: privateBlobEnvironment,
  issueToken: async (options) => {
    issuedOptions = options;
    return { delegationToken: 'delegation', clientSigningToken: 'signing' };
  },
  presign: async (token, options) => {
    assert.equal(token.delegationToken, 'delegation');
    presignedOptions = options;
    return {
      presignedUrl: 'https://teststore.private.blob.vercel-storage.com/read-the-dollar-first/00-read-the-dollar-first.mp3?vercel-blob-signature=short-lived',
    };
  },
});
assert.equal(issuedOptions.pathname, 'read-the-dollar-first/00-read-the-dollar-first.mp3');
assert.deepEqual(issuedOptions.operations, ['get']);
assert.equal(issuedOptions.validUntil, nowMs + AUDIOBOOK_SIGNED_URL_TTL_MS);
assert.equal(issuedOptions.token, privateBlobEnvironment.AUDIOBOOK_BLOB_READ_WRITE_TOKEN);
assert.equal(presignedOptions.access, 'private');
assert.equal(presignedOptions.operation, 'get');
assert.equal(signed.validUntil, nowMs + AUDIOBOOK_SIGNED_URL_TTL_MS);
assert.match(signed.url, /^https:\/\/teststore\.private\.blob\.vercel-storage\.com\//);

await assert.rejects(
  () => createPrivateAudiobookUrl({
    pathname: 'read-the-dollar-first/00-read-the-dollar-first.mp3',
    environment: privateBlobEnvironment,
    issueToken: async () => ({ delegationToken: 'delegation', clientSigningToken: 'signing' }),
    presign: async () => ({ presignedUrl: 'https://example.com/audio.mp3' }),
  }),
  (error) => error?.code === 'AUDIOBOOK_DELIVERY_UNAVAILABLE',
);

await assert.rejects(
  () => createPrivateAudiobookUrl({
    pathname: 'read-the-dollar-first/00-read-the-dollar-first.mp3',
    environment: {
      AUDIOBOOK_BLOB_STORE_ID: 'store_teststore',
      AUDIOBOOK_BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_differentstore_private-signing-token',
    },
    issueToken: async () => ({ delegationToken: 'delegation', clientSigningToken: 'signing' }),
    presign: async () => ({
      presignedUrl: 'https://teststore.private.blob.vercel-storage.com/read-the-dollar-first/00-read-the-dollar-first.mp3',
    }),
  }),
  (error) => error?.code === 'AUDIOBOOK_STORE_MISMATCH',
);

const anonymous = responseRecorder();
await handleAudiobookRequest(request(), anonymous);
assert.equal(anonymous.statusCode, 401);
assert.equal(JSON.parse(anonymous.body).code, 'AUTHENTICATION_REQUIRED');
assert.match(anonymous.getHeader('cache-control'), /no-store/);
assert.equal(anonymous.getHeader('vary'), 'Cookie, Authorization');

const missingChapter = responseRecorder();
await handleAudiobookRequest(request({ chapter: '20' }), missingChapter);
assert.equal(missingChapter.statusCode, 404);
assert.equal(JSON.parse(missingChapter.body).code, 'AUDIOBOOK_CHAPTER_NOT_FOUND');

let signedRequest;
const active = responseRecorder();
await handleAudiobookRequest(
  request({ authenticated: true, chapter: '3' }),
  active,
  {
    readAccessState: async ({ accessToken: received }) => {
      assert.equal(received, accessToken);
      return { allowed: true, reason: 'active' };
    },
    createSignedUrl: async (options) => {
      signedRequest = options;
      return { url: 'https://store.private.blob.vercel-storage.com/read-the-dollar-first/chapter.mp3?signed=1' };
    },
  },
);
assert.equal(active.statusCode, 307);
assert.equal(active.getHeader('content-length'), '0');
assert.match(active.getHeader('location'), /^https:\/\/store\.private\.blob\.vercel-storage\.com\//);
assert.equal(signedRequest.pathname, 'read-the-dollar-first/03-chapter-1-why-the-dollar-comes-first.mp3');
assert.equal(signedRequest.method, 'GET');
assert.equal(active.body, '');

const head = responseRecorder();
await handleAudiobookRequest(
  request({ authenticated: true, method: 'HEAD' }),
  head,
  {
    readAccessState: async () => ({ allowed: true, reason: 'active' }),
    createSignedUrl: async ({ method }) => {
      assert.equal(method, 'HEAD');
      return { url: 'https://store.private.blob.vercel-storage.com/read-the-dollar-first/chapter.mp3?signed=1' };
    },
  },
);
assert.equal(head.statusCode, 307);

const suspended = responseRecorder();
await handleAudiobookRequest(
  request({ authenticated: true }),
  suspended,
  { readAccessState: async () => ({ allowed: false, reason: 'suspended' }) },
);
assert.equal(suspended.statusCode, 403);
assert.deepEqual(JSON.parse(suspended.body), {
  error: 'An active Library Pass is required.',
  code: 'LIBRARY_PASS_REQUIRED',
  reason: 'suspended',
});

const signerFailure = responseRecorder();
const originalConsoleError = console.error;
console.error = () => {};
try {
  await handleAudiobookRequest(
    request({ authenticated: true }),
    signerFailure,
    {
      readAccessState: async () => ({ allowed: true, reason: 'active' }),
      createSignedUrl: async () => { throw new Error('Private store unavailable'); },
    },
  );
} finally {
  console.error = originalConsoleError;
}
assert.equal(signerFailure.statusCode, 503);
assert.equal(JSON.parse(signerFailure.body).code, 'AUDIOBOOK_DELIVERY_UNAVAILABLE');

const post = responseRecorder();
await handleAudiobookRequest(request({ method: 'POST' }), post);
assert.equal(post.statusCode, 405);
assert.equal(post.getHeader('allow'), 'GET, HEAD');

const sourceFiles = await Promise.all([
  '../src/data/read-the-dollar-first-audiobook.js',
  '../src/components/AudiobookPlayer.astro',
  '../src/pages/audiobook/read-the-dollar-first.astro',
].map((file) => readFile(new URL(file, import.meta.url), 'utf8')));
const publicSource = sourceFiles.join('\n');
assert.doesNotMatch(publicSource, /\.public\.blob\.vercel-storage\.com/);
assert.doesNotMatch(publicSource, /https:\/\/[^\s'\"]+\.mp3/);
assert.match(publicSource, /AUDIOBOOK_STREAM_ENDPOINT = '\/api\/audiobook'/);
assert.match(publicSource, /\?chapter=\$\{index\}/);
assert.match(publicSource, /Library Pass required/);
assert.match(publicSource, /Checking your Library Pass/);

console.log('Library Pass audiobook access tests passed.');
