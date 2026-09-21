import { inspectNewsletterPreviewReadiness } from '../src/lib/newsletter-preview-readiness.js';

const environment = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase();
if (environment !== 'preview') {
  console.log('Newsletter Preview readiness build probe skipped outside Vercel Preview.');
  process.exit(0);
}

const report = inspectNewsletterPreviewReadiness(process.env);
const failedKeys = report.checks.filter((item) => !item.ok).map((item) => item.key);
console.log(JSON.stringify({
  ready: report.ready,
  environment: report.environment,
  checked: report.checked,
  passed: report.passed,
  failed: report.failed,
  sharedQaRecipients: report.sharedQaRecipients,
  failedKeys,
}));

if (!report.ready) process.exit(1);
