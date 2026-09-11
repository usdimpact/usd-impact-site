import assert from 'node:assert/strict';
import { buildWeeklyNewsletterPayload } from '../src/lib/weekly-newsletter-contract.js';
import { buildWeeklyNewsletterEditionArtifact } from '../src/lib/weekly-newsletter-edition.js';
import {
  WeeklyNewsletterQaBatchError,
  loadWeeklyNewsletterQaArtifact,
  runWeeklyNewsletterQaBatch,
} from '../src/lib/weekly-newsletter-qa-batch.js';

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
const artifact = buildWeeklyNewsletterEditionArtifact(buildWeeklyNewsletterPayload({ weeklyReport }));
const grant = Object.freeze({
  id: '123e4567-e89b-42d3-a456-426614174901',
  idempotency_key: `consent:v1:${'a'.repeat(64)}`,
  email_normalized: 'qa@example.com',
  user_id: null,
  purpose: 'weekly_newsletter',
  status: 'granted',
  consent_text_version: 'weekly-newsletter-v1',
  privacy_notice_version: 'privacy-2026-08-31',
  provider_contact_ref: null,
  captured_at: '2026-09-04T18:00:00.000Z',
});
const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  WEEKLY_NEWSLETTER_QA_BATCH_ENABLED: 'true',
  WEEKLY_NEWSLETTER_QA_RECIPIENTS: 'other@example.com, qa@example.com',
  WEEKLY_NEWSLETTER_QA_BATCH_LIMIT: '1',
});

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return payload == null ? '' : JSON.stringify(payload); },
  };
}

{
  let requestedUrl = null;
  const loaded = await loadWeeklyNewsletterQaArtifact({
    weekEnding: '2026-09-04',
    baseUrl: 'https://usd-impact-site-example.vercel.app/path?ignored=1',
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      assert.equal(options.method, 'GET');
      assert.equal(options.cache, 'no-store');
      return response(artifact);
    },
  });
  assert.equal(requestedUrl, 'https://usd-impact-site-example.vercel.app/newsletter/weekly/2026-09-04.json');
  assert.equal(loaded.checksum, artifact.checksum);
}

{
  let preferencesCalls = 0;
  let enqueueCalls = 0;
  let deliverCalls = 0;
  let selectedEmail = null;
  const result = await runWeeklyNewsletterQaBatch({
    weekEnding: '2026-09-04',
    artifactBaseUrl: 'https://usd-impact-site-example.vercel.app',
    unsubscribeBaseUrl: 'https://usd-impact-site-example.vercel.app',
    environment,
    now: new Date('2026-09-05T08:00:00.000Z'),
    loadArtifact: async () => artifact,
    readPreferences: async ({ email }) => {
      preferencesCalls += 1;
      selectedEmail = email;
      return {
        weeklyNewsletter: { active: true, grant: { ...grant, email_normalized: email } },
        learningProgressUpdates: { active: false, grant: null },
      };
    },
    enqueue: async ({ candidate, artifact: supplied }) => {
      enqueueCalls += 1;
      assert.equal(candidate.recipientEmail, selectedEmail);
      assert.equal(supplied.checksum, artifact.checksum);
      return {
        created: true,
        outbox: { id: '123e4567-e89b-42d3-a456-426614174902', status: 'queued' },
      };
    },
    deliver: async ({ outbox, artifactLoader }) => {
      deliverCalls += 1;
      assert.equal(outbox.status, 'queued');
      const supplied = await artifactLoader();
      assert.equal(supplied.checksum, artifact.checksum);
      return {
        sent: true,
        state: 'accepted',
        reason: 'queued',
        outbox: { ...outbox, status: 'accepted' },
      };
    },
  });

  assert.equal(preferencesCalls, 1, 'QA batch limit must cap recipient evaluation');
  assert.equal(enqueueCalls, 1);
  assert.equal(deliverCalls, 1);
  assert.equal(result.selected, 1);
  assert.equal(result.accepted, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.failed, 0);
  assert.equal(result.results.length, 1);
  assert.match(result.results[0].recipientRef, /^[0-9a-f]{12}$/);
  assert.equal(JSON.stringify(result).includes(selectedEmail), false, 'batch result must not expose the recipient address');
}

{
  let enqueueCalls = 0;
  const result = await runWeeklyNewsletterQaBatch({
    weekEnding: '2026-09-04',
    artifactBaseUrl: 'https://usd-impact-site-example.vercel.app',
    unsubscribeBaseUrl: 'https://usd-impact-site-example.vercel.app',
    environment: {
      ...environment,
      WEEKLY_NEWSLETTER_QA_RECIPIENTS: 'qa@example.com',
    },
    now: new Date('2026-09-05T08:00:00.000Z'),
    loadArtifact: async () => artifact,
    readPreferences: async () => ({
      weeklyNewsletter: { active: false, grant: null },
      learningProgressUpdates: { active: false, grant: null },
    }),
    enqueue: async () => { enqueueCalls += 1; },
    deliver: async () => assert.fail('Inactive consent must never reach delivery.'),
  });
  assert.equal(enqueueCalls, 0);
  assert.equal(result.accepted, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.results[0].reason, 'weekly_newsletter_consent_not_active');
}

await assert.rejects(
  () => runWeeklyNewsletterQaBatch({
    weekEnding: '2026-09-04',
    artifactBaseUrl: 'https://usd-impact-site-example.vercel.app',
    unsubscribeBaseUrl: 'https://usd-impact-site-example.vercel.app',
    environment: { ...environment, VERCEL_ENV: 'production' },
    loadArtifact: async () => assert.fail('Production guard must run before artifact loading.'),
  }),
  (error) => error instanceof WeeklyNewsletterQaBatchError
    && error.code === 'PRODUCTION_WEEKLY_NEWSLETTER_QA_BLOCKED',
);

await assert.rejects(
  () => runWeeklyNewsletterQaBatch({
    weekEnding: '2026-09-04',
    artifactBaseUrl: 'https://usd-impact-site-example.vercel.app',
    unsubscribeBaseUrl: 'https://usd-impact-site-example.vercel.app',
    environment: { ...environment, WEEKLY_NEWSLETTER_QA_BATCH_ENABLED: 'false' },
  }),
  (error) => error instanceof WeeklyNewsletterQaBatchError
    && error.code === 'WEEKLY_NEWSLETTER_QA_BATCH_DISABLED'
    && error.status === 404,
);

await assert.rejects(
  () => runWeeklyNewsletterQaBatch({
    weekEnding: 'bad-date',
    artifactBaseUrl: 'https://usd-impact-site-example.vercel.app',
    unsubscribeBaseUrl: 'https://usd-impact-site-example.vercel.app',
    environment,
  }),
  (error) => error instanceof WeeklyNewsletterQaBatchError
    && error.code === 'INVALID_WEEKLY_NEWSLETTER_WEEK'
    && error.status === 400,
);

console.log('Weekly Newsletter guarded QA batch contract passed.');
