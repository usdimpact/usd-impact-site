import { inspectNewsletterPreviewReadiness } from '../src/lib/newsletter-preview-readiness.js';

const environment = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase();
if (environment !== 'preview') process.exit(0);

const keys = new Set([
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_BRANCH_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'EMAIL_READINESS_LEDGER_ENABLED',
  'PROGRESS_EMAIL_READINESS_ENABLED',
  'PROGRESS_EMAIL_DISPATCH_ENABLED',
  'PROGRESS_EMAIL_DELIVERY_ENABLED',
  'PROGRESS_EMAIL_QA_BATCH_ENABLED',
  'MARKETING_OPT_IN_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_REPLY_TO',
  'PROGRESS_EMAIL_QA_RECIPIENTS',
  'PROGRESS_EMAIL_QA_BATCH_LIMIT',
  'PROGRESS_EMAIL_BASE_URL',
]);
const report = inspectNewsletterPreviewReadiness(process.env);
const failed = report.checks.filter((item) => keys.has(item.key) && !item.ok).map((item) => item.key);
if (failed.length > 0) throw new Error(`Learning Progress Preview dependency readiness failed: ${failed.join(', ')}`);
console.log('Learning Progress Preview dependency readiness passed.');
