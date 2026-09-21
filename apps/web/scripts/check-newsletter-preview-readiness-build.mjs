import { inspectNewsletterPreviewReadiness } from '../src/lib/newsletter-preview-readiness.js';

const environment = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase();
if (environment !== 'preview') process.exit(0);

const group = new Set([
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'EMAIL_READINESS_LEDGER_ENABLED',
  'EMAIL_OPT_IN_REQUEST_ENABLED',
  'EMAIL_OPT_IN_DELIVERY_ENABLED',
  'WEEKLY_NEWSLETTER_DISPATCH_ENABLED',
  'WEEKLY_NEWSLETTER_DELIVERY_ENABLED',
  'WEEKLY_NEWSLETTER_QA_BATCH_ENABLED',
  'PROGRESS_EMAIL_READINESS_ENABLED',
  'PROGRESS_EMAIL_DISPATCH_ENABLED',
  'PROGRESS_EMAIL_DELIVERY_ENABLED',
  'PROGRESS_EMAIL_QA_BATCH_ENABLED',
]);
const report = inspectNewsletterPreviewReadiness(process.env);
if (report.checks.some((item) => group.has(item.key) && !item.ok)) process.exit(1);
console.log('Newsletter Preview database-key and feature-flag readiness group passed.');
