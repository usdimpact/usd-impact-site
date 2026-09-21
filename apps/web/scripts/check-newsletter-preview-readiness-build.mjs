import { inspectNewsletterPreviewReadiness } from '../src/lib/newsletter-preview-readiness.js';

const environment = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase();
if (environment !== 'preview') process.exit(0);

const keys = new Set(['EMAIL_READINESS_LEDGER_ENABLED']);
const report = inspectNewsletterPreviewReadiness(process.env);
if (report.checks.some((item) => keys.has(item.key) && !item.ok)) process.exit(1);
console.log('Newsletter Preview ledger flag check passed.');
