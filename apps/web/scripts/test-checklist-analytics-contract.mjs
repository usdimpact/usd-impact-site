import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const dashboard = await readFile(path.join(webRoot, 'src/pages/internal/checklist-analytics.astro'), 'utf8');
const layout = await readFile(path.join(webRoot, 'src/layouts/BaseLayout.astro'), 'utf8');
const astroConfig = await readFile(path.join(webRoot, 'astro.config.mjs'), 'utf8');
const vercelConfig = JSON.parse(await readFile(path.join(webRoot, 'vercel.json'), 'utf8'));

for (const required of [
  'type="password"',
  '/api/checklist-analytics',
  'Authorization: `Bearer ${reportToken}`',
  'Lifetime downloads',
  'Previous period',
  'Daily downloads',
  'Download CSV',
  'No attributed downloads yet.',
  '.analytics-dashboard[hidden] { display: none; }',
]) {
  assert.ok(dashboard.includes(required), `Checklist dashboard is missing: ${required}`);
}

for (const forbidden of ['localStorage', 'sessionStorage', 'document.cookie', 'innerHTML']) {
  assert.doesNotMatch(dashboard, new RegExp(forbidden.replace('.', '\\.'), 'i'));
}

assert.match(layout, /noindex && <meta name="robots" content="noindex, nofollow"/);
assert.match(astroConfig, /'\/internal\/checklist-analytics'/);
const rewriteMap = new Map(vercelConfig.rewrites.map((entry) => [entry.source, entry.destination]));
assert.equal(rewriteMap.get('/api/checklist-analytics'), '/api/telemetry?action=checklist-report');
const internalHeaders = vercelConfig.headers.find((entry) => entry.source === '/internal/(.*)')?.headers ?? [];
const internalHeaderMap = new Map(internalHeaders.map((entry) => [entry.key.toLowerCase(), entry.value]));
assert.equal(internalHeaderMap.get('cache-control'), 'private, no-store');
assert.equal(internalHeaderMap.get('x-robots-tag'), 'noindex, nofollow');

console.log('Checklist analytics dashboard contract passed.');
