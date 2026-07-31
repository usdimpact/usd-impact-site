import assert from 'node:assert/strict';
import {
  formatDeploymentHealthReport,
  verifyDailyNewsDeployment,
} from './check-daily-news-deployment-health.mjs';

const expectedDate = '2026-07-31';
const title = 'Daily USD Impact — July 31, 2026';
const expectedSlug = `/news/${expectedDate}`;
const origin = 'https://www.usd-impact.com';

function response(body, { status = 200, json = false } = {}) {
  return new Response(json ? JSON.stringify(body) : body, {
    status,
    headers: { 'content-type': json ? 'application/json' : 'text/plain' },
  });
}

function healthyFetch(url) {
  if (url.endsWith('/news/latest.json')) {
    return Promise.resolve(response({ edition: { date: expectedDate, slug: expectedSlug, title } }, { json: true }));
  }
  if (url.endsWith(`${expectedSlug}/`)) {
    return Promise.resolve(response(`<html><h1>${title}</h1></html>`));
  }
  if (url.endsWith('/news/feed.xml')) {
    return Promise.resolve(response(`<rss><link>${origin}${expectedSlug}/</link></rss>`));
  }
  throw new Error(`Unexpected URL: ${url}`);
}

const healthy = await verifyDailyNewsDeployment({
  expectedDate,
  fetchImpl: healthyFetch,
  retryDelayMs: 0,
});
assert.equal(healthy.editionUrl, `${origin}${expectedSlug}/`);
assert.match(formatDeploymentHealthReport(healthy), /Deployed edition checks/);

await assert.rejects(
  verifyDailyNewsDeployment({
    expectedDate,
    fetchImpl: async (url) => url.endsWith('/news/latest.json')
      ? response({ edition: { date: '2026-07-30', slug: '/news/2026-07-30', title } }, { json: true })
      : healthyFetch(url),
    retryDelayMs: 0,
  }),
  /Latest deployed edition is 2026-07-30, expected 2026-07-31/,
);

await assert.rejects(
  verifyDailyNewsDeployment({
    expectedDate,
    fetchImpl: async (url) => url.endsWith('/news/feed.xml')
      ? response('<rss></rss>')
      : healthyFetch(url),
    retryDelayMs: 0,
  }),
  /RSS feed does not contain the expected edition URL/,
);

let attempts = 0;
const recovered = await verifyDailyNewsDeployment({
  expectedDate,
  attempts: 2,
  retryDelayMs: 0,
  fetchImpl: async (url) => {
    if (url.endsWith('/news/latest.json') && attempts++ === 0) {
      return response('temporary failure', { status: 503 });
    }
    return healthyFetch(url);
  },
});
assert.equal(recovered.expectedDate, expectedDate);
assert.equal(attempts, 2);

await assert.rejects(
  verifyDailyNewsDeployment({ expectedDate: 'July 31', fetchImpl: healthyFetch }),
  /Expected an ISO edition date/,
);

console.log('daily news deployment health tests pass');
