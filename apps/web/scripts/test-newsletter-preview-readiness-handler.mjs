import assert from 'node:assert/strict';
import { handleNewsletterPreviewReadinessRequest } from '../src/lib/newsletter-preview-readiness-handler.js';

const QA_EMAIL = 'owner@example.com';
const MARKETING_SECRET = `moi_${'m'.repeat(43)}`;
const RESEND_KEY = `re_${'a'.repeat(32)}`;
const SUPABASE_SECRET = `sb_secret_${'s'.repeat(24)}`;
const CRON_SECRET = 'c'.repeat(40);
const BYPASS_SECRET = 'b'.repeat(32);

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: null,
    body: '',
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), String(value));
    },
    end(value = '') {
      this.body = String(value);
    },
  };
}

function request(method = 'POST') {
  return { method, headers: { authorization: 'Bearer test-cron-token' } };
}

const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  VERCEL_URL: 'usd-impact-site-preview-test-usd-impact.vercel.app',
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
  WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL: 'https://usd-impact-site-preview-test-usd-impact.vercel.app',
  WEEKLY_NEWSLETTER_PUBLIC_BASE_URL: 'https://usd-impact-site-preview-test-usd-impact.vercel.app',
  PROGRESS_EMAIL_BASE_URL: 'https://usd-impact-site-preview-test-usd-impact.vercel.app',
});

{
  const res = responseRecorder();
  await handleNewsletterPreviewReadinessRequest(request(), res, {
    environment,
    authorize: () => true,
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.failed, 0);
  assert.equal(payload.sharedQaRecipients, 1);
  assert(payload.checks.every((item) => item.ok));
  for (const sensitive of [QA_EMAIL, MARKETING_SECRET, RESEND_KEY, SUPABASE_SECRET, CRON_SECRET, BYPASS_SECRET]) {
    assert.equal(res.body.includes(sensitive), false);
  }
}

{
  const res = responseRecorder();
  await handleNewsletterPreviewReadinessRequest(request('GET'), res, {
    environment,
    authorize: () => true,
  });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.get('allow'), 'POST');
}

{
  const res = responseRecorder();
  await handleNewsletterPreviewReadinessRequest(request(), res, {
    environment,
    authorize: () => false,
  });
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).code, 'SCHEDULER_AUTHORIZATION_REQUIRED');
}

{
  const res = responseRecorder();
  await handleNewsletterPreviewReadinessRequest(request(), res, {
    environment: { ...environment, VERCEL_ENV: 'production' },
    authorize: () => assert.fail('Non-Preview request must fail before authorization.'),
  });
  assert.equal(res.statusCode, 404);
  assert.equal(JSON.parse(res.body).code, 'NEWSLETTER_PREVIEW_READINESS_NOT_AVAILABLE');
}

{
  const res = responseRecorder();
  await handleNewsletterPreviewReadinessRequest(request(), res, {
    environment: { ...environment, PROGRESS_EMAIL_DELIVERY_ENABLED: 'false' },
    authorize: () => true,
  });
  assert.equal(res.statusCode, 503);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, false);
  assert(payload.checks.some((item) => item.key === 'PROGRESS_EMAIL_DELIVERY_ENABLED' && item.ok === false));
  assert.equal(res.body.includes(QA_EMAIL), false);
  assert.equal(res.body.includes(MARKETING_SECRET), false);
  assert.equal(res.body.includes(BYPASS_SECRET), false);
}

{
  const res = responseRecorder();
  await handleNewsletterPreviewReadinessRequest(request(), res, {
    environment,
    authorize: () => true,
    inspect: () => {
      throw Object.assign(new Error('inspection failed'), { code: 'SYNTHETIC_FAILURE' });
    },
  });
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).code, 'NEWSLETTER_PREVIEW_READINESS_FAILED');
}

console.log('Protected Newsletter Preview readiness handler contract passed.');
