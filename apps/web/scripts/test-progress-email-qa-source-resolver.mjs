import assert from 'node:assert/strict';
import { buildProgressEmailQaSourceArtifact } from '../src/lib/progress-email-qa-source-artifact.js';
import {
  ProgressEmailQaSourceResolverError,
  resolveProgressEmailQaSources,
} from '../src/lib/progress-email-qa-source-resolver.js';

const PREVIEW_HOST = 'usd-impact-site-preview-test-usd-impact.vercel.app';
const PREVIEW_ORIGIN = `https://${PREVIEW_HOST}`;
const BYPASS_SECRET = 'b'.repeat(32);
const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  VERCEL_URL: PREVIEW_HOST,
  VERCEL_AUTOMATION_BYPASS_SECRET: BYPASS_SECRET,
  PROGRESS_EMAIL_BASE_URL: PREVIEW_ORIGIN,
});

const weeklyReport = {
  title: 'Weekly USD Impact Brief — September 4, 2026',
  slug: '/reports/weekly/2026-09-04',
  periodStart: '2026-08-31',
  periodEnd: '2026-09-04',
  generatedAt: '2026-09-07T14:13:55.977Z',
  status: 'published',
  category: 'Weekly USD Impact Brief',
  summary: 'Verified weekly context.',
  score: {
    value: -0.712292630238848,
    regime: 'Soft dollar regime',
    weekOverWeekChange: -0.07064819933592303,
    fourWeekChange: -0.15751160487657456,
    nearestRegimeBoundary: -1,
    sourceUrl: 'https://score.usd-impact.com/archive/2026-09-04/weekly_input.json',
  },
  themes: [
    { title: 'One', summary: 'First verified theme.', editionDates: ['2026-08-31'] },
    { title: 'Two', summary: 'Second verified theme.', editionDates: ['2026-09-02'] },
    { title: 'Three', summary: 'Third verified theme.', editionDates: ['2026-09-04'] },
  ],
  sourceEditions: [
    { date: '2026-08-31', title: 'Daily USD Impact — August 31, 2026', url: '/news/2026-08-31' },
    { date: '2026-09-02', title: 'Daily USD Impact — September 2, 2026', url: '/news/2026-09-02' },
    { date: '2026-09-04', title: 'Daily USD Impact — September 4, 2026', url: '/news/2026-09-04' },
  ],
  complianceNote: 'Educational and informational only. Not investment advice.',
};
const sourceReports = [{
  title: weeklyReport.title,
  slug: weeklyReport.slug,
  periodEnd: weeklyReport.periodEnd,
  generatedAt: weeklyReport.generatedAt,
  status: weeklyReport.status,
  category: weeklyReport.category,
}];
const artifact = buildProgressEmailQaSourceArtifact({
  currentWeeklyReport: weeklyReport,
  sourceReports,
});

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return typeof payload === 'string' ? payload : JSON.stringify(payload);
    },
  };
}

{
  let captured = null;
  const result = await resolveProgressEmailQaSources({
    weekEnding: '2026-09-04',
    environment,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response(artifact);
    },
  });
  assert.equal(
    captured.url,
    `${PREVIEW_ORIGIN}/newsletter/progress/2026-09-04.json`,
  );
  assert(captured.options.headers instanceof Headers);
  assert.equal(captured.options.headers.get('accept'), 'application/json');
  assert.equal(
    captured.options.headers.get('x-vercel-protection-bypass'),
    BYPASS_SECRET,
  );
  assert.equal(result.artifactChecksum, artifact.checksum);
  assert.equal(result.currentWeeklyReport.periodEnd, '2026-09-04');
  assert.equal(result.weeklyReports.length, 1);
}

await assert.rejects(
  () => resolveProgressEmailQaSources({
    weekEnding: '2026-08-28',
    environment,
    fetchImpl: async () => response(artifact),
  }),
  (error) => error instanceof ProgressEmailQaSourceResolverError
    && error.code === 'PROGRESS_EMAIL_QA_SOURCE_WEEK_MISMATCH',
);

await assert.rejects(
  () => resolveProgressEmailQaSources({
    weekEnding: '2026-09-04',
    environment: { ...environment, VERCEL_ENV: 'production' },
    fetchImpl: async () => assert.fail('Production source resolution must not fetch.'),
  }),
  (error) => error instanceof ProgressEmailQaSourceResolverError
    && error.code === 'PROGRESS_EMAIL_QA_SOURCE_PREVIEW_ONLY',
);

await assert.rejects(
  () => resolveProgressEmailQaSources({
    weekEnding: '2026-09-04',
    environment: {
      ...environment,
      PROGRESS_EMAIL_BASE_URL: 'https://usd-impact-site-other-usd-impact.vercel.app',
    },
    fetchImpl: async () => assert.fail('Origin mismatch must not reach network.'),
  }),
  (error) => error instanceof ProgressEmailQaSourceResolverError
    && error.code === 'PROGRESS_EMAIL_QA_SOURCE_FETCH_FAILED',
);

await assert.rejects(
  () => resolveProgressEmailQaSources({
    weekEnding: '2026-09-04',
    environment,
    fetchImpl: async () => response({ error: 'unavailable' }, 503),
  }),
  (error) => error instanceof ProgressEmailQaSourceResolverError
    && error.code === 'PROGRESS_EMAIL_QA_SOURCE_HTTP_FAILED',
);

await assert.rejects(
  () => resolveProgressEmailQaSources({
    weekEnding: '2026-09-04',
    environment,
    fetchImpl: async () => response('not json'),
  }),
  (error) => error instanceof ProgressEmailQaSourceResolverError
    && error.code === 'PROGRESS_EMAIL_QA_SOURCE_JSON_INVALID',
);

console.log('Protected Progress QA source resolver contract passed.');
