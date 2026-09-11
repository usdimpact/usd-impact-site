import assert from 'node:assert/strict';
import { buildWeeklyNewsletterPayload } from '../src/lib/weekly-newsletter-contract.js';
import { evaluateWeeklyNewsletterCandidate } from '../src/lib/weekly-newsletter-candidate.js';
import { buildWeeklyNewsletterEditionArtifact } from '../src/lib/weekly-newsletter-edition.js';
import {
  WeeklyNewsletterOutboxError,
  createWeeklyNewsletterOutboxRecord,
} from '../src/lib/weekly-newsletter-outbox.js';

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
const consentGrant = Object.freeze({
  id: '123e4567-e89b-42d3-a456-426614174701',
  idempotency_key: `consent:v1:${'a'.repeat(64)}`,
  email_normalized: 'reader@example.com',
  purpose: 'weekly_newsletter',
  status: 'granted',
});
const candidate = evaluateWeeklyNewsletterCandidate({
  payload,
  consentGrant,
  now: '2026-09-05T08:00:00.000Z',
});
const artifact = buildWeeklyNewsletterEditionArtifact(payload);
const checkedAt = '2026-09-05T08:00:00.000Z';

const outbox = createWeeklyNewsletterOutboxRecord({
  candidate,
  editionChecksum: artifact.checksum,
  consentCheckedAt: checkedAt,
});
assert.match(outbox.idempotency_key, /^notification:v1:[0-9a-f]{64}$/);
assert.equal(outbox.event_id, `weekly.newsletter:2026-09-04:${consentGrant.id}`);
assert.equal(outbox.message_id, 'weekly_newsletter');
assert.equal(outbox.classification, 'marketing');
assert.equal(outbox.business_object_type, 'weekly_newsletter_edition');
assert.equal(outbox.business_object_id, '2026-09-04');
assert.equal(outbox.state_version, 1);
assert.equal(outbox.recipient_email_normalized, 'reader@example.com');
assert.equal(outbox.template_id, 'weekly_newsletter');
assert.equal(outbox.template_version, 'weekly-newsletter-v1');
assert.equal(outbox.provider, 'resend');
assert.equal(outbox.consent_required, true);
assert.equal(outbox.consent_record_id, consentGrant.id);
assert.equal(outbox.consent_purpose, 'weekly_newsletter');
assert.equal(outbox.consent_checked_at, checkedAt);
assert.deepEqual(outbox.payload, {
  weekEnding: '2026-09-04',
  editionChecksum: artifact.checksum,
});
assert.equal(outbox.status, 'queued');
assert.equal(outbox.attempt_count, 0);
assert.equal(outbox.next_attempt_at, checkedAt);
assert(Object.isFrozen(outbox));

const repeat = createWeeklyNewsletterOutboxRecord({
  candidate,
  editionChecksum: artifact.checksum,
  consentCheckedAt: checkedAt,
});
assert.equal(repeat.idempotency_key, outbox.idempotency_key, 'same edition and recipient must be idempotent');

assert.throws(
  () => createWeeklyNewsletterOutboxRecord({
    candidate,
    editionChecksum: 'invalid',
    consentCheckedAt: checkedAt,
  }),
  (error) => error instanceof WeeklyNewsletterOutboxError
    && error.code === 'INVALID_WEEKLY_NEWSLETTER_CHECKSUM',
);

assert.throws(
  () => createWeeklyNewsletterOutboxRecord({
    candidate: { ...candidate, eligible: false, action: 'suppress' },
    editionChecksum: artifact.checksum,
    consentCheckedAt: checkedAt,
  }),
  (error) => error instanceof WeeklyNewsletterOutboxError
    && error.code === 'WEEKLY_NEWSLETTER_CANDIDATE_REQUIRED',
);

console.log('Weekly Newsletter outbox record contract passed.');
