import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectNewsletterPreviewReadiness } from '../src/lib/newsletter-preview-readiness.js';

const environment = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase();
if (environment !== 'preview') process.exit(0);

const keys = [
  'EMAIL_READINESS_LEDGER_ENABLED',
  'PROGRESS_EMAIL_READINESS_ENABLED',
  'PROGRESS_EMAIL_DISPATCH_ENABLED',
  'PROGRESS_EMAIL_DELIVERY_ENABLED',
  'PROGRESS_EMAIL_QA_BATCH_ENABLED',
];
const report = inspectNewsletterPreviewReadiness(process.env);
const byKey = new Map(report.checks.map((item) => [item.key, Boolean(item.ok)]));
const payload = Object.freeze({
  schemaVersion: 1,
  checks: Object.freeze(keys.map((key) => Object.freeze({ key, ok: byKey.get(key) === true }))),
});
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'dist', '_qa');
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'progress-readiness.json'), `${JSON.stringify(payload)}\n`, 'utf8');
console.log('Wrote non-secret Learning Progress Preview readiness evidence.');
