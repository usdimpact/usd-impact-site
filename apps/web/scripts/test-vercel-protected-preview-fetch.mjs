import assert from 'node:assert/strict';
import {
  VercelProtectedPreviewFetchError,
  createVercelProtectedPreviewFetch,
} from '../src/lib/vercel-protected-preview-fetch.js';

const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  VERCEL_URL: 'usd-impact-site-preview-test-usd-impact.vercel.app',
  VERCEL_AUTOMATION_BYPASS_SECRET: 'b'.repeat(32),
});

{
  let captured = null;
  const protectedFetch = createVercelProtectedPreviewFetch({
    environment,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 200 };
    },
  });
  const response = await protectedFetch(
    'https://usd-impact-site-preview-test-usd-impact.vercel.app/newsletter/weekly/2026-09-04.json',
    { headers: { Accept: 'application/json' } },
  );
  assert.equal(response.ok, true);
  assert.equal(
    captured.url,
    'https://usd-impact-site-preview-test-usd-impact.vercel.app/newsletter/weekly/2026-09-04.json',
  );
  const headers = captured.options.headers;
  assert(headers instanceof Headers);
  assert.equal(headers.get('accept'), 'application/json');
  assert.equal(headers.get('x-vercel-protection-bypass'), environment.VERCEL_AUTOMATION_BYPASS_SECRET);
}

{
  const protectedFetch = createVercelProtectedPreviewFetch({
    environment,
    fetchImpl: async () => assert.fail('Origin mismatch must not reach network.'),
  });
  await assert.rejects(
    () => protectedFetch('https://usd-impact-site-other-usd-impact.vercel.app/newsletter/weekly/2026-09-04.json'),
    (error) => error instanceof VercelProtectedPreviewFetchError
      && error.code === 'PROTECTED_PREVIEW_ORIGIN_MISMATCH',
  );
}

{
  const protectedFetch = createVercelProtectedPreviewFetch({
    environment: { ...environment, VERCEL_AUTOMATION_BYPASS_SECRET: '' },
    fetchImpl: async () => assert.fail('Missing bypass secret must not reach network.'),
  });
  await assert.rejects(
    () => protectedFetch('https://usd-impact-site-preview-test-usd-impact.vercel.app/newsletter/weekly/2026-09-04.json'),
    (error) => error instanceof VercelProtectedPreviewFetchError
      && error.code === 'VERCEL_AUTOMATION_BYPASS_SECRET_INVALID',
  );
}

{
  const protectedFetch = createVercelProtectedPreviewFetch({
    environment: { ...environment, VERCEL_ENV: 'production' },
    fetchImpl: async () => assert.fail('Production environment must not reach network.'),
  });
  await assert.rejects(
    () => protectedFetch('https://usd-impact-site-preview-test-usd-impact.vercel.app/newsletter/weekly/2026-09-04.json'),
    (error) => error instanceof VercelProtectedPreviewFetchError
      && error.code === 'INVALID_VERCEL_PREVIEW_ORIGIN',
  );
}

console.log('Protected Vercel Preview fetch contract passed.');
