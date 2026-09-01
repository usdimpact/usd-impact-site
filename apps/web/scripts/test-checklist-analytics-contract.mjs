import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const dashboard = await readFile(path.join(webRoot, 'src/pages/internal/checklist-analytics.astro'), 'utf8');
const telemetryApi = await readFile(path.join(webRoot, 'api/telemetry.js'), 'utf8');
const layout = await readFile(path.join(webRoot, 'src/layouts/BaseLayout.astro'), 'utf8');
const astroConfig = await readFile(path.join(webRoot, 'astro.config.mjs'), 'utf8');
const vercelConfig = JSON.parse(await readFile(path.join(webRoot, 'vercel.json'), 'utf8'));

for (const required of [
  'Checklist and checkout-funnel activity',
  'type="password"',
  '/api/checklist-analytics',
  'requestReport(`/api/telemetry?${checkoutQuery}`)',
  "action: 'checkout-funnel-report'",
  'Authorization: `Bearer ${reportToken}`',
  "cache: 'no-store'",
  'Aggregate event counts; not unique visitors and not buyer evidence.',
  'Lifetime downloads',
  'Previous period',
  'Daily downloads',
  'Download checklist CSV',
  'Lifetime checkout views',
  'Selected-period views',
  'View-to-click rate',
  'Click-to-sign-in rate',
  'Daily checkout funnel',
  'Download checkout CSV',
  'No attributed checkout events yet.',
  'const [checklistReport, checkoutReport] = await Promise.all([',
  "tokenInput.value = '';",
  '.analytics-dashboard[hidden] { display: none; }',
]) {
  assert.ok(dashboard.includes(required), `Analytics dashboard is missing: ${required}`);
}

for (const forbidden of [
  'localStorage',
  'sessionStorage',
  'document.cookie',
  'innerHTML',
  'TELEMETRY_REPORT_TOKEN',
  'NEWSFEED_BEARER_TOKEN',
  'KV_REST_API_TOKEN',
  'CRON_SECRET',
  '/api/commerce',
]) {
  assert.doesNotMatch(dashboard, new RegExp(forbidden.replaceAll('.', '\\.')), `Dashboard must not contain ${forbidden}.`);
}

assert.doesNotMatch(dashboard, /method\s*:\s*['"]POST['"]/);
assert.match(telemetryApi, /if \(requestedAction === 'checkout-funnel-report'\) return handleCheckoutFunnelReport\(request, response\);/);
assert.match(telemetryApi, /eventSemantics: 'Aggregate event counts; not unique visitors and not buyer evidence\.'/);
assert.match(telemetryApi, /const endpointToken = process\.env\.TELEMETRY_REPORT_TOKEN \|\| process\.env\.NEWSFEED_BEARER_TOKEN;/);
assert.match(layout, /noindex && <meta name="robots" content="noindex, nofollow"/);
assert.match(astroConfig, /'\/internal\/checklist-analytics'/);
const rewriteMap = new Map(vercelConfig.rewrites.map((entry) => [entry.source, entry.destination]));
assert.equal(rewriteMap.get('/api/checklist-analytics'), '/api/telemetry?action=checklist-report');
assert.equal(rewriteMap.has('/api/checkout-funnel-analytics'), false);
const internalHeaders = vercelConfig.headers.find((entry) => entry.source === '/internal/(.*)')?.headers ?? [];
const internalHeaderMap = new Map(internalHeaders.map((entry) => [entry.key.toLowerCase(), entry.value]));
assert.equal(internalHeaderMap.get('cache-control'), 'private, no-store');
assert.equal(internalHeaderMap.get('x-robots-tag'), 'noindex, nofollow');

console.log('Checklist and checkout analytics dashboard contract passed.');
