import fs from 'node:fs';
import path from 'node:path';
import { inspectNewsletterPreviewReadiness } from '../src/lib/newsletter-preview-readiness.js';

const environment = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase();
if (environment !== 'preview') {
  console.log('Newsletter Preview readiness build probe skipped outside Vercel Preview.');
  process.exit(0);
}

const report = inspectNewsletterPreviewReadiness(process.env);
const payload = {
  ready: report.ready,
  environment: report.environment,
  checked: report.checked,
  passed: report.passed,
  failed: report.failed,
  sharedQaRecipients: report.sharedQaRecipients,
  failedKeys: report.checks.filter((item) => !item.ok).map((item) => item.key),
};

const target = path.join(process.cwd(), 'dist', 'newsletter', 'preview-readiness.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(payload)}\n`, 'utf8');
console.log(JSON.stringify(payload));
