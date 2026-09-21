import { inspectNewsletterPreviewReadiness } from '../src/lib/newsletter-preview-readiness.js';

const environment = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase();
if (environment !== 'preview') {
  console.log('Newsletter Preview readiness build probe skipped outside Vercel Preview.');
  process.exit(0);
}

const report = inspectNewsletterPreviewReadiness(process.env);
const supabaseCheck = report.checks.find((item) => item.key === 'SUPABASE_URL');
if (!supabaseCheck?.ok) process.exit(1);
console.log('Newsletter Preview canonical Development Supabase target check passed.');
