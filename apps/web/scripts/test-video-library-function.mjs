import assert from 'node:assert/strict';
import guidedEditionHandler from '../api/guided-edition.js';
import { handleVideoLibraryRequest } from '../src/lib/video-library-handler.js';
import { getStreamUid } from '../src/lib/video-stream-map.js';
import { SESSION_COOKIE_NAMES } from '../src/lib/supabase-auth.js';

const host = 'usd-impact-site-test-usd-impact.vercel.app';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.video-library-test-token.signature';
const signedToken = 'signed.header.payload';

function request({ method = 'GET', url = '/api/video-library', authenticated = false } = {}) {
  return {
    method,
    url,
    headers: {
      host,
      'x-forwarded-host': host,
      'x-forwarded-proto': 'https',
      ...(authenticated ? { cookie: `${SESSION_COOKIE_NAMES.ACCESS}=${encodeURIComponent(accessToken)}` } : {}),
    },
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

const anonymous = responseRecorder();
await handleVideoLibraryRequest(request(), anonymous);
assert.equal(anonymous.statusCode, 302);
assert.equal(new URL(anonymous.getHeader('location'), `https://${host}`).pathname, '/account/sign-in/');
assert.equal(new URL(anonymous.getHeader('location'), `https://${host}`).searchParams.get('next'), '/guided-edition/video-library/');

const nestedRoute = responseRecorder();
await guidedEditionHandler(
  request({ url: '/api/guided-edition?__video_path=dollar-yields-liquidity' }),
  nestedRoute,
);
assert.equal(nestedRoute.statusCode, 302);
const nestedSignIn = new URL(nestedRoute.getHeader('location'), `https://${host}`);
assert.equal(nestedSignIn.pathname, '/account/sign-in/');
assert.equal(
  nestedSignIn.searchParams.get('next'),
  '/guided-edition/video-library/dollar-yields-liquidity/',
);

const unpaid = responseRecorder();
await handleVideoLibraryRequest(request({ authenticated: true }), unpaid, {
  readAccessState: async () => ({ allowed: false, reason: 'missing' }),
});
assert.equal(unpaid.statusCode, 302);
assert.equal(new URL(unpaid.getHeader('location'), `https://${host}`).pathname, '/account/access-required/');

const catalog = responseRecorder();
await handleVideoLibraryRequest(request({ authenticated: true }), catalog, {
  readAccessState: async () => ({ allowed: true, reason: 'active' }),
});
assert.equal(catalog.statusCode, 200);
assert.match(catalog.body, /51 verified films/);
assert.match(catalog.body, /dxy-the-signal-vs-the-system/);
assert.match(catalog.getHeader('cache-control'), /no-store/);
assert.equal(catalog.getHeader('vary'), 'Cookie, Authorization');
assert.match(catalog.getHeader('content-security-policy'), /cloudflarestream\.com/);

let receivedUid = null;
const watch = responseRecorder();
await handleVideoLibraryRequest(
  request({ authenticated: true, url: '/api/video-library?__video_path=dollar-yields-liquidity' }),
  watch,
  {
    readAccessState: async () => ({ allowed: true, reason: 'active' }),
    createToken: async ({ videoUid }) => { receivedUid = videoUid; return signedToken; },
  },
);
assert.equal(watch.statusCode, 200);
assert.equal(receivedUid, getStreamUid('dollar-yields-liquidity'));
assert.match(watch.body, new RegExp(signedToken.replaceAll('.', '\\.')));
assert.doesNotMatch(watch.body, new RegExp(receivedUid));
assert.match(watch.body, /defaultTextTrack=en/);

let headTokenCalls = 0;
const head = responseRecorder();
await handleVideoLibraryRequest(
  request({ method: 'HEAD', authenticated: true, url: '/api/video-library?__video_path=dollar-yields-liquidity' }),
  head,
  {
    readAccessState: async () => ({ allowed: true, reason: 'active' }),
    createToken: async () => { headTokenCalls += 1; return signedToken; },
  },
);
assert.equal(head.statusCode, 200);
assert.equal(head.body, '');
assert.equal(headTokenCalls, 0);

const invalid = responseRecorder();
await handleVideoLibraryRequest(
  request({ authenticated: true, url: '/api/video-library?__video_path=not-a-film' }),
  invalid,
  { readAccessState: async () => ({ allowed: true, reason: 'active' }) },
);
assert.equal(invalid.statusCode, 404);

const unavailable = responseRecorder();
const originalConsoleError = console.error;
console.error = () => {};
try {
  await handleVideoLibraryRequest(
    request({ authenticated: true, url: '/api/video-library?__video_path=dollar-yields-liquidity' }),
    unavailable,
    {
      readAccessState: async () => ({ allowed: true, reason: 'active' }),
      createToken: async () => { throw new Error('provider unavailable'); },
    },
  );
} finally {
  console.error = originalConsoleError;
}
assert.equal(unavailable.statusCode, 503);
assert.match(unavailable.body, /Playback is temporarily unavailable/);

console.log('Protected video library function tests passed.');
