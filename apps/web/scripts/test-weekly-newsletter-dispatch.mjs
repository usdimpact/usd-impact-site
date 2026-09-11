import assert from 'node:assert/strict';
import { buildWeeklyNewsletterPayload } from '../src/lib/weekly-newsletter-contract.js';
import { evaluateWeeklyNewsletterCandidate } from '../src/lib/weekly-newsletter-candidate.js';
import { buildWeeklyNewsletterEditionArtifact } from '../src/lib/weekly-newsletter-edition.js';
import { createWeeklyNewsletterOutboxRecord } from '../src/lib/weekly-newsletter-outbox.js';
import {
  WeeklyNewsletterDispatchError,
  deliverWeeklyNewsletterOutbox,
  enqueueWeeklyNewsletterOutbox,
  loadWeeklyNewsletterEditionArtifact,
  resolveWeeklyNewsletterDispatchDecision,
} from '../src/lib/weekly-newsletter-dispatch.js';

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
const sourcePayload = buildWeeklyNewsletterPayload({ weeklyReport });
const artifact = buildWeeklyNewsletterEditionArtifact(sourcePayload);
const grant = Object.freeze({
  id: '123e4567-e89b-42d3-a456-426614174801',
  idempotency_key: `consent:v1:${'a'.repeat(64)}`,
  email_normalized: 'reader@example.com',
  user_id: null,
  purpose: 'weekly_newsletter',
  status: 'granted',
  consent_text_version: 'weekly-newsletter-v1',
  privacy_notice_version: 'privacy-2026-08-31',
  provider_contact_ref: null,
  captured_at: '2026-09-04T18:00:00.000Z',
});
const candidate = evaluateWeeklyNewsletterCandidate({
  payload: artifact.payload,
  consentGrant: grant,
  now: '2026-09-05T08:00:00.000Z',
});
const outbox = Object.freeze({
  id: '123e4567-e89b-42d3-a456-426614174802',
  ...createWeeklyNewsletterOutboxRecord({
    candidate,
    editionChecksum: artifact.checksum,
    consentCheckedAt: '2026-09-05T08:00:00.000Z',
  }),
  created_at: '2026-09-05T08:00:00.000Z',
  provider_message_ref: null,
  accepted_at: null,
});
const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  WEEKLY_NEWSLETTER_DISPATCH_ENABLED: 'true',
  WEEKLY_NEWSLETTER_DELIVERY_ENABLED: 'true',
  WEEKLY_NEWSLETTER_QA_RECIPIENTS: 'reader@example.com',
  WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL: 'https://usd-impact-site-example.vercel.app',
  WEEKLY_NEWSLETTER_PUBLIC_BASE_URL: 'https://usd-impact-site-example.vercel.app',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: ['sb', 'publishable', 'p'.repeat(24)].join('_'),
  SUPABASE_SECRET_KEY: ['sb', 'secret', 's'.repeat(24)].join('_'),
  MARKETING_OPT_IN_SECRET: ['moi', 'm'.repeat(43)].join('_'),
  RESEND_API_KEY: ['re', 'r'.repeat(32)].join('_'),
  RESEND_FROM_EMAIL: 'USD Impact <updates@updates.usd-impact.com>',
  RESEND_REPLY_TO: 'support@usd-impact.com',
});

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return payload == null ? '' : JSON.stringify(payload); },
  };
}

function scriptedFetch(steps) {
  let index = 0;
  const fetchImpl = async (url, options = {}) => {
    const step = steps[index++];
    assert.ok(step, `Unexpected database call ${index}: ${url}`);
    if (step.path) assert.match(url, step.path);
    if (step.method) assert.equal(options.method || 'GET', step.method);
    if (step.assert) step.assert({ url, options });
    const payload = typeof step.payload === 'function' ? step.payload({ url, options }) : step.payload;
    return response(payload, step.status || 200);
  };
  fetchImpl.assertDone = () => assert.equal(index, steps.length);
  return fetchImpl;
}

assert.deepEqual(
  resolveWeeklyNewsletterDispatchDecision(outbox, Date.parse('2026-09-05T08:00:00.000Z')),
  { action: 'send', reason: 'queued' },
);

{
  let requestedUrl = null;
  const loaded = await loadWeeklyNewsletterEditionArtifact({
    weekEnding: '2026-09-04',
    expectedChecksum: artifact.checksum,
    baseUrl: 'https://usd-impact-site-example.vercel.app/path?ignored=1',
    fetchImpl: async (url) => {
      requestedUrl = url;
      return response(artifact);
    },
  });
  assert.equal(requestedUrl, 'https://usd-impact-site-example.vercel.app/newsletter/weekly/2026-09-04.json');
  assert.equal(loaded.checksum, artifact.checksum);
}

{
  const inserted = { ...outbox };
  const fetchImpl = scriptedFetch([{
    method: 'POST',
    path: /notification_outbox\?on_conflict=idempotency_key/,
    assert: ({ options }) => {
      const body = JSON.parse(options.body);
      assert.equal(body.message_id, 'weekly_newsletter');
      assert.equal(body.consent_purpose, 'weekly_newsletter');
      assert.deepEqual(body.payload, { weekEnding: '2026-09-04', editionChecksum: artifact.checksum });
      assert.equal(Object.hasOwn(body, 'status'), false);
      assert.equal(Object.hasOwn(body, 'attempt_count'), false);
    },
    payload: [inserted],
  }]);
  const result = await enqueueWeeklyNewsletterOutbox({
    candidate,
    artifact,
    consentCheckedAt: '2026-09-05T08:00:00.000Z',
    environment,
    fetchImpl,
  });
  assert.equal(result.created, true);
  assert.equal(result.outbox.id, outbox.id);
  fetchImpl.assertDone();
}

{
  const fetchImpl = scriptedFetch([
    { path: /marketing_consent_events\?id=eq\./, payload: [grant] },
    { path: /status=eq\.withdrawn&related_grant_id=eq\./, payload: [] },
    { path: /status=in\.\(hard_bounced,complained,suppressed\)/, payload: [] },
    { path: /message_id=eq\.weekly_newsletter&status=in\.\(accepted,delivered\)/, payload: [] },
    { method: 'PATCH', path: /notification_outbox\?id=eq\./, payload: ({ options }) => [{ ...outbox, ...JSON.parse(options.body) }] },
    { method: 'PATCH', path: /notification_outbox\?id=eq\./, payload: ({ options }) => [{ ...outbox, status: 'sending', attempt_count: 1, ...JSON.parse(options.body) }] },
  ]);
  let sent = null;
  const result = await deliverWeeklyNewsletterOutbox({
    outbox,
    environment,
    databaseFetch: fetchImpl,
    artifactLoader: async () => artifact,
    now: () => new Date('2026-09-05T08:00:00.000Z'),
    adapterFactory: () => ({
      async send(message) {
        sent = message;
        return { state: 'accepted', messageRef: 'weekly-provider-1', occurredAt: '2026-09-05T08:00:00.000Z' };
      },
    }),
  });
  assert.equal(result.sent, true);
  assert.equal(result.state, 'accepted');
  assert.equal(sent.to[0], 'reader@example.com');
  assert.equal(sent.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(sent.text, /not a forecast or trading signal/i);
  fetchImpl.assertDone();
}

{
  const withdrawal = { id: '123e4567-e89b-42d3-a456-426614174803', related_grant_id: grant.id };
  const fetchImpl = scriptedFetch([
    { path: /marketing_consent_events\?id=eq\./, payload: [grant] },
    { path: /status=eq\.withdrawn&related_grant_id=eq\./, payload: [withdrawal] },
    {
      method: 'PATCH',
      path: /notification_outbox\?id=eq\./,
      assert: ({ options }) => assert.deepEqual(JSON.parse(options.body), { status: 'cancelled', error_code: 'CONSENT_WITHDRAWN' }),
      payload: ({ options }) => [{ ...outbox, ...JSON.parse(options.body) }],
    },
  ]);
  const result = await deliverWeeklyNewsletterOutbox({
    outbox,
    environment,
    databaseFetch: fetchImpl,
    artifactLoader: async () => artifact,
    adapterFactory: () => assert.fail('Withdrawn consent must block provider creation.'),
    now: () => new Date('2026-09-05T08:00:00.000Z'),
  });
  assert.equal(result.sent, false);
  assert.equal(result.state, 'cancelled');
  assert.equal(result.reason, 'consent_not_active');
  fetchImpl.assertDone();
}

await assert.rejects(
  () => deliverWeeklyNewsletterOutbox({
    outbox,
    environment: { ...environment, VERCEL_ENV: 'production' },
    artifactLoader: async () => assert.fail('Production guard must run before artifact loading.'),
    databaseFetch: async () => assert.fail('Production guard must run before database access.'),
    now: () => new Date('2026-09-05T08:00:00.000Z'),
  }),
  (error) => error instanceof WeeklyNewsletterDispatchError
    && error.code === 'PRODUCTION_WEEKLY_NEWSLETTER_DISPATCH_BLOCKED',
);

console.log('Weekly Newsletter Development dispatch worker contract passed.');
