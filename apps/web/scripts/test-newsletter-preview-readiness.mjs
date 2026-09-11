import assert from 'node:assert/strict';
import {
  NewsletterPreviewReadinessError,
  inspectNewsletterPreviewReadiness,
  requireNewsletterPreviewReadiness,
} from '../src/lib/newsletter-preview-readiness.js';

const PREVIEW_HOST = 'usd-impact-site-preview-test-usd-impact.vercel.app';
const PREVIEW_ORIGIN = `https://${PREVIEW_HOST}`;
const QA_EMAIL = 'owner@example.com';
const MARKETING_SECRET = `moi_${'m'.repeat(43)}`;
const RESEND_KEY = `re_${'a'.repeat(32)}`;
const SUPABASE_SECRET = `sb_secret_${'s'.repeat(24)}`;
const CRON_SECRET = 'c'.repeat(40);
const BYPASS_SECRET = 'b'.repeat(32);

const validEnvironment = Object.freeze({
  VERCEL_ENV: 'preview',
  VERCEL_URL: PREVIEW_HOST,
  VERCEL_AUTOMATION_BYPASS_SECRET: BYPASS_SECRET,
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'p'.repeat(24)}`,
  SUPABASE_SECRET_KEY: SUPABASE_SECRET,
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  EMAIL_OPT_IN_REQUEST_ENABLED: 'true',
  EMAIL_OPT_IN_DELIVERY_ENABLED: 'true',
  WEEKLY_NEWSLETTER_DISPATCH_ENABLED: 'true',
  WEEKLY_NEWSLETTER_DELIVERY_ENABLED: 'true',
  WEEKLY_NEWSLETTER_QA_BATCH_ENABLED: 'true',
  PROGRESS_EMAIL_READINESS_ENABLED: 'true',
  PROGRESS_EMAIL_DISPATCH_ENABLED: 'true',
  PROGRESS_EMAIL_DELIVERY_ENABLED: 'true',
  PROGRESS_EMAIL_QA_BATCH_ENABLED: 'true',
  MARKETING_OPT_IN_SECRET: MARKETING_SECRET,
  RESEND_API_KEY: RESEND_KEY,
  RESEND_FROM_EMAIL: 'USD Impact <updates@updates.usd-impact.com>',
  RESEND_REPLY_TO: 'support@usd-impact.com',
  CRON_SECRET,
  EMAIL_OPT_IN_QA_RECIPIENTS: QA_EMAIL,
  WEEKLY_NEWSLETTER_QA_RECIPIENTS: QA_EMAIL,
  PROGRESS_EMAIL_QA_RECIPIENTS: QA_EMAIL,
  WEEKLY_NEWSLETTER_QA_BATCH_LIMIT: '1',
  PROGRESS_EMAIL_QA_BATCH_LIMIT: '1',
  WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL: PREVIEW_ORIGIN,
  WEEKLY_NEWSLETTER_PUBLIC_BASE_URL: PREVIEW_ORIGIN,
  PROGRESS_EMAIL_BASE_URL: PREVIEW_ORIGIN,
});

function failedKeys(report) {
  return report.checks.filter((item) => !item.ok).map((item) => item.key);
}

const ready = inspectNewsletterPreviewReadiness(validEnvironment);
assert.equal(ready.ready, true);
assert.equal(ready.environment, 'preview');
assert.equal(ready.failed, 0);
assert.equal(ready.passed, ready.checked);
assert.equal(ready.sharedQaRecipients, 1);
assert(ready.checks.every((item) => item.ok));

const serializedReady = JSON.stringify(ready);
for (const sensitive of [MARKETING_SECRET, RESEND_KEY, SUPABASE_SECRET, CRON_SECRET, BYPASS_SECRET, QA_EMAIL]) {
  assert.equal(serializedReady.includes(sensitive), false, `Readiness report must not expose ${sensitive.slice(0, 8)}...`);
}
assert.equal(serializedReady.includes('VERCEL_AUTOMATION_BYPASS_SECRET'), true);
assert.equal(serializedReady.includes('MARKETING_OPT_IN_SECRET'), true);
assert.equal(serializedReady.includes('RESEND_API_KEY'), true);
assert.equal(serializedReady.includes('SUPABASE_SECRET_KEY'), true);
assert.equal(serializedReady.includes('CRON_SECRET'), true);

{
  const report = inspectNewsletterPreviewReadiness({ ...validEnvironment, VERCEL_ENV: 'production' });
  assert.equal(report.ready, false);
  assert(failedKeys(report).includes('VERCEL_ENV'));
}

{
  const report = inspectNewsletterPreviewReadiness({
    ...validEnvironment,
    VERCEL_AUTOMATION_BYPASS_SECRET: '',
  });
  assert.equal(report.ready, false);
  assert(failedKeys(report).includes('VERCEL_AUTOMATION_BYPASS_SECRET'));
}

{
  const report = inspectNewsletterPreviewReadiness({
    ...validEnvironment,
    SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
  });
  assert.equal(report.ready, false);
  assert(failedKeys(report).includes('SUPABASE_URL'));
}

{
  const report = inspectNewsletterPreviewReadiness({
    ...validEnvironment,
    WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL: 'https://usd-impact-site-other-preview-usd-impact.vercel.app',
    WEEKLY_NEWSLETTER_PUBLIC_BASE_URL: 'https://usd-impact-site-other-preview-usd-impact.vercel.app',
    PROGRESS_EMAIL_BASE_URL: 'https://usd-impact-site-other-preview-usd-impact.vercel.app',
  });
  const failures = failedKeys(report);
  assert(failures.includes('WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL'));
  assert(failures.includes('WEEKLY_NEWSLETTER_PUBLIC_BASE_URL'));
  assert(failures.includes('PROGRESS_EMAIL_BASE_URL'));
}

{
  const report = inspectNewsletterPreviewReadiness({
    ...validEnvironment,
    EMAIL_OPT_IN_QA_RECIPIENTS: 'optin@example.com',
    WEEKLY_NEWSLETTER_QA_RECIPIENTS: 'weekly@example.com',
    PROGRESS_EMAIL_QA_RECIPIENTS: 'progress@example.com',
  });
  assert.equal(report.sharedQaRecipients, 0);
  assert(failedKeys(report).includes('QA_RECIPIENT_INTERSECTION'));
  const serialized = JSON.stringify(report);
  assert(!serialized.includes('optin@example.com'));
  assert(!serialized.includes('weekly@example.com'));
  assert(!serialized.includes('progress@example.com'));
}

{
  const report = inspectNewsletterPreviewReadiness({
    ...validEnvironment,
    PROGRESS_EMAIL_DELIVERY_ENABLED: 'false',
  });
  assert(failedKeys(report).includes('PROGRESS_EMAIL_DELIVERY_ENABLED'));
}

{
  const report = inspectNewsletterPreviewReadiness({
    ...validEnvironment,
    RESEND_FROM_EMAIL: 'USD Impact <updates@example.net>',
  });
  assert(failedKeys(report).includes('RESEND_FROM_EMAIL'));
}

{
  const report = inspectNewsletterPreviewReadiness({
    ...validEnvironment,
    WEEKLY_NEWSLETTER_QA_BATCH_LIMIT: '2',
  });
  assert(failedKeys(report).includes('WEEKLY_NEWSLETTER_QA_BATCH_LIMIT'));
}

{
  const report = inspectNewsletterPreviewReadiness({
    ...validEnvironment,
    VERCEL_URL: 'usd-impact-site-preview-test-usd-impact.example.com',
  });
  const failures = failedKeys(report);
  assert(failures.includes('VERCEL_URL'));
  assert(failures.includes('WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL'));
  assert(failures.includes('WEEKLY_NEWSLETTER_PUBLIC_BASE_URL'));
  assert(failures.includes('PROGRESS_EMAIL_BASE_URL'));
}

assert.doesNotThrow(() => requireNewsletterPreviewReadiness(validEnvironment));
assert.throws(
  () => requireNewsletterPreviewReadiness({
    ...validEnvironment,
    EMAIL_OPT_IN_DELIVERY_ENABLED: 'false',
    RESEND_API_KEY: '',
  }),
  (error) => {
    assert(error instanceof NewsletterPreviewReadinessError);
    assert.equal(error.code, 'NEWSLETTER_PREVIEW_NOT_READY');
    assert(error.report);
    assert.equal(error.report.ready, false);
    const failures = failedKeys(error.report);
    assert(failures.includes('EMAIL_OPT_IN_DELIVERY_ENABLED'));
    assert(failures.includes('RESEND_API_KEY'));
    const serialized = JSON.stringify(error.report);
    assert(!serialized.includes(MARKETING_SECRET));
    assert(!serialized.includes(SUPABASE_SECRET));
    assert(!serialized.includes(BYPASS_SECRET));
    assert(!serialized.includes(QA_EMAIL));
    return true;
  },
);

console.log('Newsletter Preview readiness contract passed.');
