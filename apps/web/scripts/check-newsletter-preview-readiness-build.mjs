import { inspectNewsletterPreviewReadiness } from '../src/lib/newsletter-preview-readiness.js';

const environment = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase();
if (environment !== 'preview') {
  console.log('Newsletter Preview readiness build probe skipped outside Vercel Preview.');
  process.exit(0);
}

const originKeys = new Set([
  'WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL',
  'WEEKLY_NEWSLETTER_PUBLIC_BASE_URL',
  'PROGRESS_EMAIL_BASE_URL',
]);
const report = inspectNewsletterPreviewReadiness(process.env);
const failedKeys = report.checks.filter((item) => !item.ok).map((item) => item.key);
const substantiveFailures = failedKeys.filter((key) => !originKeys.has(key));

console.log(`Newsletter Preview substantive readiness: ${report.checked - substantiveFailures.length}/${report.checked}; substantive failures: ${substantiveFailures.length}; origin failures ignored for this diagnostic: ${failedKeys.length - substantiveFailures.length}.`);

if (substantiveFailures.length > 0) process.exit(1);
