import assert from 'node:assert/strict';
import {
  buildProgressEmailQaSourceArtifact,
  ProgressEmailQaSourceArtifactError,
  verifyProgressEmailQaSourceArtifact,
} from '../src/lib/progress-email-qa-source-artifact.js';
import { ProgressEmailMeaningfulChangeError } from '../src/lib/progress-email-meaningful-changes.js';

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
assert.equal(artifact.schemaVersion, 1);
assert.match(artifact.checksum, /^[0-9a-f]{64}$/);
assert.equal(artifact.payload.registryVersion, 1);
assert.equal(artifact.payload.weekEnding, '2026-09-04');
assert.equal(artifact.payload.currentWeeklyReport.title, weeklyReport.title);
assert.equal(artifact.payload.currentWeeklyReport.generatedAt, weeklyReport.generatedAt);
assert.equal(artifact.payload.sourceReports.length, 1);
assert.equal(artifact.payload.sourceReports[0].periodEnd, '2026-09-04');
assert.equal(Object.hasOwn(artifact.payload.sourceReports[0], 'priority'), false);
assert.equal(Object.hasOwn(artifact.payload.sourceReports[0], 'occurredAt'), false);

const verified = verifyProgressEmailQaSourceArtifact(artifact);
assert.equal(verified.checksum, artifact.checksum);
assert.deepEqual(verified.payload, artifact.payload);
assert(Object.isFrozen(verified));
assert(Object.isFrozen(verified.payload));

assert.throws(
  () => verifyProgressEmailQaSourceArtifact({
    ...artifact,
    payload: {
      ...artifact.payload,
      currentWeeklyReport: {
        ...artifact.payload.currentWeeklyReport,
        title: 'Tampered title',
      },
    },
  }),
  (error) => error instanceof ProgressEmailQaSourceArtifactError
    && error.code === 'PROGRESS_EMAIL_QA_SOURCE_CHECKSUM_MISMATCH',
);

assert.throws(
  () => buildProgressEmailQaSourceArtifact({
    currentWeeklyReport: weeklyReport,
    sourceReports: [],
  }),
  (error) => error instanceof ProgressEmailMeaningfulChangeError
    && error.code === 'PROGRESS_CHANGE_SOURCE_MISSING',
);

assert.throws(
  () => buildProgressEmailQaSourceArtifact({
    currentWeeklyReport: { ...weeklyReport, status: 'review' },
    sourceReports,
  }),
  /must be published|outside|published/i,
);

console.log('Progress QA source artifact contract passed.');
