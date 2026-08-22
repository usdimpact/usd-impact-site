import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [manifestText, serviceWorker, layout, pwaClient] = await Promise.all([
  read('public/manifest.webmanifest'),
  read('public/sw.js'),
  read('src/layouts/BaseLayout.astro'),
  read('src/components/PwaClient.astro'),
]);

const manifest = JSON.parse(manifestText);
assert.equal(manifest.name, 'USD Impact');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.scope, '/');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
assert.match(layout, /rel="manifest" href="\/manifest\.webmanifest"/);
assert.match(layout, /<PwaClient\s*\/>/);
assert.match(pwaClient, /navigator\.serviceWorker\.register\('\/sw\.js'/);

// Initial USD Impact PWA must remain network-only. Protected content and
// entitlement-bearing URLs must not be persisted by the service worker.
assert.doesNotMatch(serviceWorker, /caches\.open\s*\(/);
assert.doesNotMatch(serviceWorker, /cache\.put\s*\(/);
assert.doesNotMatch(serviceWorker, /cache\.add(All)?\s*\(/);
assert.match(serviceWorker, /event\.respondWith\(fetch\(event\.request\)\)/);

console.log('PWA contract verified: installable shell, network-only service worker.');
