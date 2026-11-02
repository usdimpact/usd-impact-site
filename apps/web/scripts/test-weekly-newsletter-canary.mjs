import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// Issue #620 release hold: Vercel's committed cron topology must not silently
// activate Weekly Newsletter or Learning Progress fan-out. Check the effective
// same-origin rewrite target, not merely the cron's original path.
const vercelConfiguration = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
function resolvedCronUrl(path, rewrites) {
  let current = new URL(path, CANARY_ORIGIN);
  const visited = new Set();
  for (let hop = 0; hop < 8; hop += 1) {
    if (current.origin !== CANARY_ORIGIN || visited.has(current.pathname)) {
      throw new Error('Cron URL has an external or cyclic rewrite.');
    }
    visited.add(current.pathname);
    const rewrite = rewrites.find((item) => item.source === current.pathname);
    if (!rewrite) return current;
    const target = new URL(rewrite.destination, CANARY_ORIGIN);
    for (const [key, value] of current.searchParams) target.searchParams.set(key, value);
    current = target;
  }
  throw new Error('Cron rewrite chain exceeds the bounded review limit.');
}
function assertNoLifecycleEmailCron(configuration) {
  assert.ok(Array.isArray(configuration.crons), 'Vercel cron inventory must be explicit.');
  assert.ok(Array.isArray(configuration.rewrites), 'Vercel rewrites must be inspectable.');
  const forbidden = configuration.crons.filter(({ path }) => {
    const target = resolvedCronUrl(path, configuration.rewrites);
    // The existing Daily Learning scheduler is distinct from the consented
    // Learning Progress inactivity email and must not be misclassified.
    if (target.pathname === '/api/waitlist') {
      return target.searchParams.get('action') !== 'daily-learning-dispatch';
    }
    return /newsletter|progress[-_]email|learning[-_]progress|email[-_](subscribe|confirm|dispatch)|marketing[-_]opt[-_]in/i
      .test(target.pathname + target.search);
  });
  assert.deepEqual(forbidden, [], 'Issue #620 HOLD: no Weekly Newsletter or Learning Progress delivery cron is approved.');
}
assertNoLifecycleEmailCron(vercelConfiguration);
cases += 1;

for (const forbiddenPath of [
  '/api/weekly-newsletter-dispatch',
  '/api/waitlist?action=progress-email-dispatch',
]) {
  assert.throws(
    () => assertNoLifecycleEmailCron({
      ...vercelConfiguration,
      crons: [...vercelConfiguration.crons, { path: forbiddenPath, schedule: '0 7 * * 1' }],
    }),
    /Issue #620 HOLD/,
  );
  cases += 1;
}
assert.throws(
  () => assertNoLifecycleEmailCron({
    ...vercelConfiguration,
    crons: [...vercelConfiguration.crons, { path: '/api/lifecycle-alias', schedule: '0 7 * * 1' }],
    rewrites: [
      ...vercelConfiguration.rewrites,
      { source: '/api/lifecycle-alias', destination: '/api/waitlist?action=weekly-newsletter-dispatch' },
    ],
  }),
  /Issue #620 HOLD/,
);
cases += 1;

// Guard the explicit purpose-specific unsubscribe route and its privacy headers.
// This is source-contract QA, not a live unsubscribe or opt-in request.
const rewrite = (source) => vercelConfiguration.rewrites.find((item) => item.source === source)?.destination;
assert.equal(rewrite('/email/unsubscribe'), '/api/waitlist?action=marketing-email-unsubscribe');
assert.equal(rewrite('/api/resend-webhook'), '/api/waitlist?action=resend-webhook');
const unsubscribeHeaders = vercelConfiguration.headers.find((item) => item.source === '/email/unsubscribe')?.headers ?? [];
for (const [key, value] of [
  ['Cache-Control', 'private, no-store'],
  ['X-Robots-Tag', 'noindex, nofollow'],
  ['Referrer-Policy', 'no-referrer'],
]) {
  assert.equal(unsubscribeHeaders.find((header) => header.key === key)?.value, value);
}
cases += 1;

// A hard-coded Production activation value is a release operation, not a
// source-only review. Preserve the otherwise-live ledger/preferences controls.
const lifecycleSendingFlags = [
  'WEEKLY_NEWSLETTER_PRODUCTION_ENABLED', 'WEEKLY_NEWSLETTER_DISPATCH_ENABLED',
  'WEEKLY_NEWSLETTER_DELIVERY_ENABLED', 'WEEKLY_NEWSLETTER_QA_BATCH_ENABLED',
  'PROGRESS_EMAIL_PRODUCTION_ENABLED', 'PROGRESS_EMAIL_DISPATCH_ENABLED',
  'PROGRESS_EMAIL_DELIVERY_ENABLED', 'PROGRESS_EMAIL_QA_BATCH_ENABLED',
  'EMAIL_OPT_IN_PRODUCTION_APPROVED', 'EMAIL_OPT_IN_REQUEST_ENABLED',
  'EMAIL_OPT_IN_DELIVERY_ENABLED',
];
function assertNoHardcodedEmailActivation(configuration) {
  for (const flag of lifecycleSendingFlags) {
    const value = String(configuration.env?.[flag] ?? '').trim().toLowerCase();
    assert.notEqual(value, 'true', 'Issue #620 HOLD: do not hard-code email activation in vercel.json.');
  }
}
assertNoHardcodedEmailActivation(vercelConfiguration);
for (const flag of lifecycleSendingFlags) {
  assert.throws(() => assertNoHardcodedEmailActivation({
    ...vercelConfiguration, env: { ...vercelConfiguration.env, [flag]: ' TRUE ' },
  }), /Issue #620 HOLD/);
}
cases += lifecycleSendingFlags.length + 1;

// A GitHub Actions schedule is another possible delivery fan-out trigger.
// Inspect only these purpose-specific workflow entrypoints; unrelated native
// Daily Learning, Daily News, and maintenance schedules remain untouched.
const heldEmailWorkflows = [
  'weekly-newsletter-dispatch.yml', 'weekly-newsletter-qa-batch.yml',
  'progress-email-dispatch.yml', 'progress-email-qa-batch.yml',
  'email-opt-in-delivery.yml', 'newsletter-preview-readiness.yml',
];
function assertNoScheduledEmailWorkflow(yamlText) {
  assert.match(yamlText, /^on:\s*$/m, 'Workflow trigger block must be explicit.');
  assert.doesNotMatch(yamlText, /^\s{2}schedule\s*:|^on:\s*\[[^\n]*\bschedule\b/m,
    'Issue #620 HOLD: lifecycle email workflows cannot add scheduled fan-out.');
}
for (const filename of heldEmailWorkflows) {
  const source = readFileSync(new URL(`../../../.github/workflows/${filename}`, import.meta.url), 'utf8');
  assertNoScheduledEmailWorkflow(source);
  assert.throws(() => assertNoScheduledEmailWorkflow(source.replace(/^on:\s*$/m, 'on:\n  schedule:\n    - cron: "0 7 * * 1"')),
    /Issue #620 HOLD/);
}
cases += heldEmailWorkflows.length * 2;

console.log(`Weekly canary core: ${cases} scenarios passed; only mocks used, no network or live writes.`);
