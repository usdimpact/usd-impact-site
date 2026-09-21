import { inspectNewsletterPreviewReadiness } from '../src/lib/newsletter-preview-readiness.js';

const environment = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase();
if (environment !== 'preview') process.exit(0);

const report = inspectNewsletterPreviewReadiness(process.env);
const failed = report.checks.filter((item) => !item.ok).map((item) => item.key);
if (failed.length > 0) throw new Error(`Newsletter Preview readiness failed: ${failed.join(', ')}`);
console.log('Newsletter Preview readiness passed.');
