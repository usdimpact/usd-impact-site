import assert from 'node:assert/strict';
import {
  CANARY_CHECKSUM, CANARY_WEEK, CANARY_ORIGIN, CANARY_DATABASE, CANARY_TRUE_FLAGS,
  canaryRequestId, executeWeeklyCanary,
} from '../src/lib/weekly-newsletter-canary.js';

export const USER = Object.freeze({ id: '123e4567-e89b-42d3-a456-426614174000', email: 'owner@example.com' });
export const ENV = Object.freeze({
  VERCEL_ENV: 'production', SUPABASE_URL: CANARY_DATABASE,
  ...Object.fromEntries(CANARY_TRUE_FLAGS.map((key) => [key, 'true'])),
  EMAIL_OPT_IN_QA_RECIPIENTS: USER.email, WEEKLY_NEWSLETTER_QA_RECIPIENTS: USER.email,
  WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL: CANARY_ORIGIN, WEEKLY_NEWSLETTER_PUBLIC_BASE_URL: CANARY_ORIGIN,
  MARKETING_OPT_IN_SECRET: ['moi', 'm'.repeat(64)].join('_'),
  RESEND_WEBHOOK_SECRET: ['whsec', 'w'.repeat(24)].join('_'),
});
export const NOW = new Date('2026-09-20T18:00:00Z');
const grant = { id: USER.id, email_normalized: USER.email, status: 'granted', purpose: 'weekly_newsletter' };
const source = { checksum: CANARY_CHECKSUM, payload: { weekEnding: CANARY_WEEK, subject: 'Controlled fixture' } };
let cases = 0;
export function harness({ active = false } = {}) {
  const calls = [];
  let weeklyClaimed = false;
  let optInClaimed = false;
  const ports = {
    validateConfiguration: async () => { calls.push('validate'); },
    loadSource: async () => source,
    readPreferences: async () => ({ weeklyNewsletter: { active, grant: active ? grant : null } }),
    readState: async () => ({ weekly: weeklyClaimed ? [{ status: 'queued' }] : [], confirmations: optInClaimed ? [{ status: 'queued' }] : [] }),
    evaluateCandidate: () => ({ eligible: true, recipientEmail: USER.email }),
    verifyUnsubscribe: async () => { calls.push('inspect-unsubscribe'); },
    prepareOptIn: async (input) => {
      calls.push('prepare');
      assert.equal(input.email, USER.email);
      assert.equal(input.purpose, 'weekly_newsletter');
      assert.equal(input.requestId, canaryRequestId(USER.id, USER.email));
      const created = !optInClaimed;
      optInClaimed = true;
      return { created, outbox: { recipient_email_normalized: USER.email, payload: { purpose: 'weekly_newsletter' } } };
    },
    deliverOptIn: async () => { calls.push('confirmation-send'); return { state: 'accepted', sent: true }; },
    enqueue: async (input) => {
      calls.push('enqueue');
      assert.equal(input.environment, ENV);
      assert.equal(input.artifact.checksum, CANARY_CHECKSUM);
      const created = !weeklyClaimed;
      weeklyClaimed = true;
      return { created, outbox: { recipient_email_normalized: USER.email, payload: { editionChecksum: CANARY_CHECKSUM } } };
    },
    deliverWeekly: async (input) => {
      calls.push('weekly-send');
      assert.equal(input.artifactBaseUrl, CANARY_ORIGIN);
      assert.equal(input.unsubscribeBaseUrl, CANARY_ORIGIN);
      return { state: 'accepted', sent: true };
    },
  };
  return { ports, calls, input: { user: USER, environment: ENV, now: NOW, ports } };
}
const writes = (calls) => calls.filter((call) => ['prepare', 'enqueue', 'weekly-send', 'confirmation-send'].includes(call));
async function reject(input, code) {
  await assert.rejects(() => executeWeeklyCanary(input), (error) => error.code === code);
  cases += 1;
}

for (const key of CANARY_TRUE_FLAGS) {
  for (const value of [undefined, 'false', true, 'TRUE', ' true ', '']) {
    const h = harness();
    const r = await executeWeeklyCanary({ ...h.input, environment: { ...ENV, [key]: value } });
    assert.equal(r.ready, false);
    assert.ok(r.issues.includes(key));
    assert.equal(writes(h.calls).length, 0);
    cases += 1;
  }
}
for (const value of ['', 'one@example.com,two@example.com', `${USER.email},`, 'invalid']) {
  const h = harness();
  await reject({ ...h.input, environment: { ...ENV, EMAIL_OPT_IN_QA_RECIPIENTS: value } }, 'CANARY_ALLOWLIST_INVALID');
}
for (const value of ['preview', 'development', '', 'Production']) {
  await reject({ ...harness().input, environment: { ...ENV, VERCEL_ENV: value } }, 'CANARY_NOT_AVAILABLE');
}
await reject({ ...harness().input, environment: { ...ENV, EMAIL_OPT_IN_QA_RECIPIENTS: 'other@example.com' } }, 'CANARY_ALLOWLIST_MISMATCH');
for (const user of [null, { ...USER, id: 'not-a-uuid' }, { ...USER, email: 'someone@example.com' }]) {
  await reject({ ...harness().input, user }, 'CANARY_NOT_AUTHORIZED');
}
for (const active of [false, true]) {
  const h = harness({ active });
  const result = await executeWeeklyCanary(h.input);
  assert.equal(result.canSend, active);
  assert.equal(result.canRequestConfirmation, !active);
  assert.deepEqual(writes(h.calls), []);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(ENV.MARKETING_OPT_IN_SECRET), false);
  assert.equal(serialized.includes(USER.email), false);
  cases += 1;
}
for (const operation of ['send-weekly', 'request-confirmation']) {
  await reject({ ...harness({ active: true }).input, operation }, 'CANARY_EXPLICIT_CONFIRMATION_REQUIRED');
}
for (const override of [
  { PROGRESS_EMAIL_DELIVERY_ENABLED: 'true' },
  { PROGRESS_EMAIL_PRODUCTION_ENABLED: ' TRUE ' },
  { WEEKLY_NEWSLETTER_QA_BATCH_ENABLED: 'true' },
  { SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co' },
  { WEEKLY_NEWSLETTER_PUBLIC_BASE_URL: 'https://example.com' },
  { MARKETING_OPT_IN_SECRET: 'not-valid' },
  { RESEND_WEBHOOK_SECRET: '' },
]) {
  const h = harness({ active: true });
  await reject({ ...h.input, operation: 'send-weekly', confirmed: true, environment: { ...ENV, ...override } }, 'CANARY_CONFIGURATION_INCOMPLETE');
  assert.deepEqual(writes(h.calls), []);
}
for (const now of [new Date('2026-09-17'), new Date('2026-09-25')]) {
  await reject({ ...harness().input, now }, 'CANARY_EDITION_WINDOW_CLOSED');
}
{
  const h = harness({ active: true });
  h.ports.loadSource = async () => ({ ...source, checksum: '0'.repeat(64) });
  await reject({ ...h.input, operation: 'send-weekly', confirmed: true }, 'CANARY_SOURCE_CHANGED');
  assert.deepEqual(writes(h.calls), []);
}
for (const preference of [null, { weeklyNewsletter: { active: true, grant: null } }, { weeklyNewsletter: { active: 'true' } }]) {
  const h = harness();
  h.ports.readPreferences = async () => preference;
  await reject(h.input, 'CANARY_CONSENT_STATE_INVALID');
}
{
  const h = harness();
  h.ports.readPreferences = async () => ({ weeklyNewsletter: { active: true, grant: { ...grant, purpose: 'book_availability' } } });
  await reject(h.input, 'CANARY_CONSENT_MISMATCH');
}
{
  const h = harness();
  await reject({ ...h.input, operation: 'send-weekly', confirmed: true }, 'CANARY_CONFIRMED_CONSENT_REQUIRED');
  assert.deepEqual(writes(h.calls), []);
}
{
  const h = harness({ active: true });
  h.ports.verifyUnsubscribe = async () => { throw new Error('unavailable'); };
  await assert.rejects(() => executeWeeklyCanary({ ...h.input, operation: 'send-weekly', confirmed: true }));
  assert.deepEqual(writes(h.calls), []);
  cases += 1;
}
for (const status of ['queued', 'sending', 'accepted', 'delivered', 'retry_scheduled', 'terminal_failed', 'cancelled']) {
  const h = harness({ active: true });
  h.ports.readState = async () => ({ weekly: [{ status }], confirmations: [] });
  const r = await executeWeeklyCanary({ ...h.input, operation: 'send-weekly', confirmed: true });
  assert.equal(r.sent, false);
  assert.deepEqual(writes(h.calls), []);
  cases += 1;
}
for (const operation of ['request-confirmation', 'send-weekly']) {
  const h = harness({ active: operation === 'send-weekly' });
  const results = await Promise.all(Array.from({ length: 30 }, () => executeWeeklyCanary({ ...h.input, operation, confirmed: true })));
  const sendName = operation === 'send-weekly' ? 'weekly-send' : 'confirmation-send';
  assert.equal(h.calls.filter((call) => call === sendName).length, 1);
  assert.equal(results.filter((result) => result.sent === true).length, 1);
  assert.equal((await executeWeeklyCanary({ ...h.input, operation, confirmed: true })).sent, false);
  cases += 1;
}
{
  const h = harness({ active: true });
  let attempts = 0;
  h.ports.deliverWeekly = async () => { attempts += 1; throw new Error('ambiguous provider result'); };
  await assert.rejects(() => executeWeeklyCanary({ ...h.input, operation: 'send-weekly', confirmed: true }));
  const result = await executeWeeklyCanary({ ...h.input, operation: 'send-weekly', confirmed: true });
  assert.equal(result.sent, false);
  assert.equal(attempts, 1);
  cases += 1;
}
console.log(`Weekly canary core: ${cases} scenarios passed; only mocks used, no network or live writes.`);
