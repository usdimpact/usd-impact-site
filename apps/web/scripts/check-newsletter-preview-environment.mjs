import { inspectNewsletterPreviewReadiness } from '../src/lib/newsletter-preview-readiness.js';

const NEWSLETTER_BRANCH = 'integration/newsletter-system-convergence';
const commitRef = String(process.env.VERCEL_GIT_COMMIT_REF ?? '').trim();

if (commitRef !== NEWSLETTER_BRANCH) {
  console.log('Newsletter Preview environment gate skipped outside the governed QA branch.');
  process.exit(0);
}

const report = inspectNewsletterPreviewReadiness(process.env);
const failed = report.checks.filter((item) => !item.ok);

console.log(`Newsletter Preview environment gate: ${report.passed}/${report.checked} checks passed; shared QA recipients: ${report.sharedQaRecipients}.`);

if (failed.length > 0) {
  console.error(`Newsletter Preview environment gate failed: ${failed.map((item) => item.key).join(', ')}.`);
  process.exit(1);
}

console.log('Newsletter Preview environment gate passed.');
