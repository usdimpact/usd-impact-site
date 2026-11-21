import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CI-only, built-output test: GA4 is optional for an explicitly Production
// build. The full npm run build (including verify-production-build.mjs) must
// already have succeeded. No vendor requests, real IDs or deployments.
assert.equal(process.env.VERCEL_ENV, 'production');
assert.equal(process.env.PUBLIC_GA4_MEASUREMENT_ID, '');

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const htmlPaths = [];
const scriptPaths = [];
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(filename);
    else if (entry.isFile() && filename.endsWith('.html')) htmlPaths.push(filename);
    else if (entry.isFile() && filename.endsWith('.js')) scriptPaths.push(filename);
  }
}
visit(dist);
assert.ok(htmlPaths.length >= 100, 'Expected a real compiled site, not a minimal fixture');
assert.ok(scriptPaths.length > 0, 'Expected compiled client JavaScript');

for (const filename of htmlPaths) {
  const html = readFileSync(filename, 'utf8');
  assert.doesNotMatch(html, /id=["']usd-impact-ga4-config["']/,
    'GA4-off Production must not publish a GA4 DOM config: ' + filename);
  assert.doesNotMatch(html, /data-ga4-measurement-id=/,
    'GA4-off Production must not publish a measurement attribute: ' + filename);
  assert.doesNotMatch(html, /G-TEST1234/,
    'Previous synthetic fixture must not survive this build: ' + filename);
}
for (const filename of scriptPaths) {
  const js = readFileSync(filename, 'utf8');
  assert.doesNotMatch(js, /G-TEST1234/,
    'Previous synthetic GA4 fixture must not survive in JS: ' + filename);
}
assert.match(readFileSync(path.join(dist, 'privacy/index.html'), 'utf8'),
  /data-analytics-enabled="true"/,
  'English consent remains available for independently gated first-party analytics');
assert.match(readFileSync(path.join(dist, 'es/privacy/index.html'), 'utf8'),
  /data-analytics-enabled="false"/,
  'Spanish analytics stays disabled');
console.log('PASS: Production GA4-off full build; ' + htmlPaths.length +
  ' HTML pages and ' + scriptPaths.length +
  ' JS assets contain no synthetic GA4 ID or GA4 config bridge.');
