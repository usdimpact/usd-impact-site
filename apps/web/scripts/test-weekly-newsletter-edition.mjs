import assert from 'node:assert/strict';
import { buildWeeklyNewsletterPayload } from '../src/lib/weekly-newsletter-contract.js';
import {
  WeeklyNewsletterEditionError,
  buildWeeklyNewsletterEditionArtifact,
  buildWeeklyNewsletterEditionSnapshot,
  checksumWeeklyNewsletterEdition,
  verifyWeeklyNewsletterEditionArtifact,
} from '../src/lib/weekly-newsletter-edition.js';

const weeklyReport = {
  title: 'Weekly USD Impact Brief — September 4, 2026',
  slug: '/reports/weekly/2026-09-04',
  periodStart: '2026-08-31',
  periodEnd: '2026-09-04',
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

const payload = buildWeeklyNewsletterPayload({ weeklyReport });
const snapshot = buildWeeklyNewsletterEditionSnapshot(payload);
assert.equal(snapshot.schemaVersion, 1);
assert.equal(snapshot.weekEnding, '2026-09-04');
assert.equal(snapshot.messageId, 'weekly_newsletter');
assert.equal(snapshot.consentPurpose, 'weekly_newsletter');
assert.equal(snapshot.classification, 'marketing');
assert.equal(snapshot.locale, 'en');
assert.equal(snapshot.highlights.length, 3);
assert.equal(snapshot.links.length, 4);
assert.equal(snapshot.primaryCta.url, 'https://www.usd-impact.com/reports/weekly/2026-09-04');
assert.equal(snapshot.source.scoreSourceUrl, weeklyReport.score.sourceUrl);
assert.deepEqual(snapshot.source.sourceEditionDates, ['2026-08-31', '2026-09-02', '2026-09-04']);
assert.match(snapshot.score.note, /not a forecast or trading signal/i);
assert(Object.isFrozen(snapshot));

const checksumA = checksumWeeklyNewsletterEdition(snapshot);
const checksumB = checksumWeeklyNewsletterEdition(buildWeeklyNewsletterEditionSnapshot(payload));
assert.match(checksumA, /^[0-9a-f]{64}$/);
assert.equal(checksumA, checksumB, 'identical source payloads must produce the same checksum');

const artifact = buildWeeklyNewsletterEditionArtifact(payload);
assert.equal(artifact.schemaVersion, 1);
assert.equal(artifact.checksum, checksumA);
assert.equal(artifact.payload.weekEnding, '2026-09-04');
assert(Object.isFrozen(artifact));

const verified = verifyWeeklyNewsletterEditionArtifact(JSON.parse(JSON.stringify(artifact)));
assert.equal(verified.checksum, artifact.checksum);
assert.deepEqual(verified.payload, artifact.payload);

const tampered = JSON.parse(JSON.stringify(artifact));
tampered.payload.score.regime = 'Tampered regime';
assert.throws(
  () => verifyWeeklyNewsletterEditionArtifact(tampered),
  (error) => error instanceof WeeklyNewsletterEditionError
    && error.code === 'WEEKLY_NEWSLETTER_EDITION_CHECKSUM_MISMATCH',
);

const nonCanonical = JSON.parse(JSON.stringify(payload));
nonCanonical.links[0].url = 'https://example.com/reports/weekly/2026-09-04';
assert.throws(
  () => buildWeeklyNewsletterEditionArtifact(nonCanonical),
  (error) => error instanceof WeeklyNewsletterEditionError,
);

console.log('Weekly Newsletter deterministic edition artifact contract passed.');
