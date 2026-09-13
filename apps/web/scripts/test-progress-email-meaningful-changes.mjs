import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildProgressEmailMeaningfulChanges,
  ProgressEmailMeaningfulChangeError,
  progressEmailMeaningfulChangeRegistryVersion,
} from '../src/lib/progress-email-meaningful-changes.js';
import { progressEmailMeaningfulChangeRegistry } from '../src/data/progress-email-meaningful-changes.js';

function readTopLevelQuoted(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s+"([^"]+)"\\s*$`, 'm'));
  if (!match) throw new Error(`Missing top-level quoted field ${key}.`);
  return match[1];
}

function readTopLevelPlain(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s+([^\\n]+)\\s*$`, 'm'));
  if (!match) throw new Error(`Missing top-level field ${key}.`);
  return match[1].trim().replace(/^"|"$/g, '');
}

function readWeeklyReport(periodEnd) {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src', 'content', 'weekly-reports', `${periodEnd}.md`),
    'utf8',
  );
  const end = source.indexOf('\n---', 4);
  if (!source.startsWith('---\n') || end < 0) throw new Error(`Invalid frontmatter for ${periodEnd}.`);
  const frontmatter = source.slice(4, end);
  return {
    title: readTopLevelQuoted(frontmatter, 'title'),
    slug: readTopLevelQuoted(frontmatter, 'slug'),
    periodEnd: readTopLevelQuoted(frontmatter, 'periodEnd'),
    generatedAt: readTopLevelQuoted(frontmatter, 'generatedAt'),
    status: readTopLevelQuoted(frontmatter, 'status'),
    category: readTopLevelQuoted(frontmatter, 'category'),
  };
}

const sourceIds = progressEmailMeaningfulChangeRegistry.map((entry) => entry.sourceId);
const weeklyReports = sourceIds.map(readWeeklyReport);
const changes = buildProgressEmailMeaningfulChanges({ weeklyReports });

assert.equal(progressEmailMeaningfulChangeRegistryVersion(), 1);
assert.equal(changes.length, 1);
assert.deepEqual(changes[0], {
  kind: 'weekly_report',
  priority: 'P2',
  title: 'Weekly USD Impact Brief — September 4, 2026',
  occurredAt: '2026-09-07T14:13:55.977Z',
  url: 'https://www.usd-impact.com/reports/weekly/2026-09-04',
});
assert(Object.isFrozen(changes));
assert(Object.isFrozen(changes[0]));

assert.throws(
  () => buildProgressEmailMeaningfulChanges({
    registry: [{
      changeId: 'weekly-report:2026-09-04',
      sourceType: 'weekly_report',
      sourceId: '2026-09-04',
      priority: 'P1',
      occurredAt: '2026-09-07T14:13:55.977Z',
    }],
    weeklyReports,
  }),
  (error) => error instanceof ProgressEmailMeaningfulChangeError
    && error.code === 'UNAPPROVED_PROGRESS_CHANGE_PRIORITY',
);

assert.throws(
  () => buildProgressEmailMeaningfulChanges({
    registry: [{
      changeId: 'weekly-report:2026-09-04',
      sourceType: 'weekly_report',
      sourceId: '2026-09-04',
      priority: 'P2',
      occurredAt: '2026-09-01T00:00:00.000Z',
    }],
    weeklyReports,
  }),
  (error) => error instanceof ProgressEmailMeaningfulChangeError
    && error.code === 'PROGRESS_CHANGE_PRECEDES_SOURCE',
);

assert.throws(
  () => buildProgressEmailMeaningfulChanges({
    registry: progressEmailMeaningfulChangeRegistry,
    weeklyReports: weeklyReports.map((report) => ({ ...report, status: 'review' })),
  }),
  (error) => error instanceof ProgressEmailMeaningfulChangeError
    && error.code === 'PROGRESS_CHANGE_SOURCE_NOT_PUBLISHED',
);

assert.throws(
  () => buildProgressEmailMeaningfulChanges({
    registry: [
      progressEmailMeaningfulChangeRegistry[0],
      { ...progressEmailMeaningfulChangeRegistry[0] },
    ],
    weeklyReports,
  }),
  (error) => error instanceof ProgressEmailMeaningfulChangeError
    && error.code === 'DUPLICATE_PROGRESS_CHANGE_ID',
);

assert.throws(
  () => buildProgressEmailMeaningfulChanges({
    registry: progressEmailMeaningfulChangeRegistry,
    weeklyReports: [],
  }),
  (error) => error instanceof ProgressEmailMeaningfulChangeError
    && error.code === 'PROGRESS_CHANGE_SOURCE_MISSING',
);

console.log('progress email meaningful-change registry tests passed');
