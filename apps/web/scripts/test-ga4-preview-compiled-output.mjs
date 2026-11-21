import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This test runs after an isolated Astro Preview build on the CI runner.
// We deliberately supply a fictional GA4 ID to prove Preview fails closed.
assert.equal(process.env.VERCEL_ENV, 'preview');
assert.equal(process.env.PUBLIC_GA4_MEASUREMENT_ID, 'G-TEST1234');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const pages = [
  { file: 'privacy/index.html', analyticsAvailable: true },
  { file: 'terms/index.html', analyticsAvailable: true },
  { file: 'es/privacy/index.html', analyticsAvailable: false },
];

for (const { file, analyticsAvailable } of pages) {
  const html = readFileSync(path.join(root, file), 'utf8');
  assert.match(html, /id="privacy-consent-banner"/);
  assert.match(html, new RegExp('data-analytics-enabled="' + analyticsAvailable + '"'));
  assert.doesNotMatch(html, /id="usd-impact-ga4-config"/);
  assert.doesNotMatch(html, /data-ga4-measurement-id=/);
  assert.doesNotMatch(html, /G-TEST1234/);
}
const jsDir = path.join(root, '_astro');
let checkedBundles = 0;
for (const entry of readdirSync(jsDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  const bundle = readFileSync(path.join(jsDir, entry.name), 'utf8');
  assert.doesNotMatch(bundle, /G-TEST1234/, 'Preview client JS must never contain a GA4 measurement ID');
  checkedBundles += 1;
}
assert.ok(checkedBundles > 0, 'Expected built Astro JavaScript modules');
console.log('PASS: 3 compiled Preview pages have no GA4 config, synthetic ID absent from ' + checkedBundles + ' client JS bundles.');
