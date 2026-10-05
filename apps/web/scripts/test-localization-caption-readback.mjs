import assert from 'node:assert/strict';
import { handleLocalizationCaptionReadback } from '../src/lib/localization-caption-readback.js';

const PREVIEW = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'feature/spanish-localization-foundation',
  CLOUDFLARE_ACCOUNT_ID: 'account-test',
  CLOUDFLARE_STREAM_API_TOKEN: 'secret-test-token',
};

function request(url, method = 'GET') {
  return { method, url, headers: {} };
}

function recorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    end(value = '') { this.body += String(value ?? ''); return this; },
  };
}

function upstream(body, { status = 200, contentType = 'text/vtt; charset=utf-8' } = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': contentType,
      'content-length': String(Buffer.byteLength(body)),
    },
  });
}

const knownUid = 'stream-known';
const resolveUid = (slug) => slug === 'known-video' ? knownUid : null;

{
  let fetched = false;
  const response = recorder();
  await handleLocalizationCaptionReadback(
    request('/api/guided-edition?action=localization-source-caption&slug=known-video'),
    response,
    {
      environment: { ...PREVIEW, VERCEL_ENV: 'production' },
      resolveUid,
      fetchImpl: async () => { fetched = true; return upstream('WEBVTT'); },
    },
  );
  assert.equal(response.statusCode, 404);
  assert.equal(fetched, false);
}

{
  let fetched = false;
  const response = recorder();
  await handleLocalizationCaptionReadback(
    request('/api/guided-edition?action=localization-source-caption&slug=known-video'),
    response,
    {
      environment: { ...PREVIEW, VERCEL_GIT_COMMIT_REF: 'main' },
      resolveUid,
      fetchImpl: async () => { fetched = true; return upstream('WEBVTT'); },
    },
  );
  assert.equal(response.statusCode, 404);
  assert.equal(fetched, false);
}

{
  const response = recorder();
  await handleLocalizationCaptionReadback(
    request('/api/guided-edition?action=localization-source-caption&slug=known-video', 'POST'),
    response,
    { environment: PREVIEW, resolveUid, fetchImpl: async () => upstream('WEBVTT') },
  );
  assert.equal(response.statusCode, 405);
  assert.equal(response.getHeader('allow'), 'GET');
}

for (const url of [
  '/api/guided-edition?action=localization-source-caption&slug=unknown-video',
  '/api/guided-edition?action=localization-source-caption&slug=known-video&language=es',
]) {
  let fetched = false;
  const response = recorder();
  await handleLocalizationCaptionReadback(request(url), response, {
    environment: PREVIEW,
    resolveUid,
    fetchImpl: async () => { fetched = true; return upstream('WEBVTT'); },
  });
  assert.equal(response.statusCode, 404);
  assert.equal(fetched, false);
}

{
  const response = recorder();
  await handleLocalizationCaptionReadback(
    request('/api/guided-edition?action=localization-source-caption&slug=known-video'),
    response,
    {
      environment: {
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'feature/spanish-localization-foundation',
      },
      resolveUid,
      fetchImpl: async () => upstream('WEBVTT'),
    },
  );
  assert.equal(response.statusCode, 503);
}

{
  let captured;
  const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello.\n';
  const response = recorder();
  await handleLocalizationCaptionReadback(
    request('/api/guided-edition?action=localization-source-caption&slug=known-video&language=en'),
    response,
    {
      environment: PREVIEW,
      resolveUid,
      fetchImpl: async (url, options) => {
        captured = { url, options };
        return upstream(vtt);
      },
    },
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, vtt);
  assert.match(response.getHeader('content-type'), /^text\/vtt/);
  assert.equal(response.getHeader('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.getHeader('x-robots-tag'), 'noindex, nofollow');
  assert.equal(
    captured.url,
    'https://api.cloudflare.com/client/v4/accounts/account-test/stream/stream-known/captions/en/vtt',
  );
  assert.equal(captured.options.method, 'GET');
  assert.equal(captured.options.headers.Authorization, 'Bearer secret-test-token');
  assert.equal(response.body.includes('secret-test-token'), false);
}

{
  const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nEnvelope.\n';
  const response = recorder();
  await handleLocalizationCaptionReadback(
    request('/api/guided-edition?action=localization-source-caption&slug=known-video'),
    response,
    {
      environment: PREVIEW,
      resolveUid,
      fetchImpl: async () => upstream(
        JSON.stringify({ success: true, result: vtt }),
        { contentType: 'application/json' },
      ),
    },
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, vtt);
}

{
  const response = recorder();
  await handleLocalizationCaptionReadback(
    request('/api/guided-edition?action=localization-source-caption&slug=known-video'),
    response,
    {
      environment: PREVIEW,
      resolveUid,
      fetchImpl: async () => upstream('provider failure', { status: 403, contentType: 'text/plain' }),
    },
  );
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.includes('secret-test-token'), false);
}

console.log('preview-only localization caption readback: PASS');
