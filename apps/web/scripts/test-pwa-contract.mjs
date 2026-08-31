import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [manifestText, serviceWorker, layout, pwaClient, notificationPage] = await Promise.all([
  read('public/manifest.webmanifest'),
  read('public/sw.js'),
  read('src/layouts/BaseLayout.astro'),
  read('src/components/PwaClient.astro'),
  read('src/pages/account/notifications.astro'),
]);

const manifest = JSON.parse(manifestText);
assert.equal(manifest.name, 'USD Impact');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.scope, '/');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
assert.match(layout, /rel="manifest" href="\/manifest\.webmanifest"/);
assert.match(layout, /import PwaClient/);
assert.match(layout, /<PwaClient\s*\/>/);
assert.doesNotMatch(pwaClient, /navigator\.serviceWorker\.register/);
assert.match(pwaClient, /navigator\.serviceWorker\.getRegistration\('\/'\)/);
assert.match(pwaClient, /registration\.pushManager\.getSubscription/);
assert.match(pwaClient, /if \(!subscription\) await registration\.unregister\(\)/);
assert.match(pwaClient, /'\/account\/notifications'/);

// USD Impact PWA remains network-only. Protected content and entitlement-bearing
// URLs must never be persisted by the service worker.
assert.doesNotMatch(serviceWorker, /caches\.open\s*\(/);
assert.doesNotMatch(serviceWorker, /cache\.put\s*\(/);
assert.doesNotMatch(serviceWorker, /cache\.add(All)?\s*\(/);
assert.match(serviceWorker, /event\.respondWith\(fetch\(event\.request\)\)/);

// Push receipt is user-visible and notification navigation is constrained to
// this origin. Permission must only be requested from the explicit enable action.
assert.match(serviceWorker, /addEventListener\('push'/);
assert.match(serviceWorker, /registration\.showNotification/);
assert.match(serviceWorker, /addEventListener\('notificationclick'/);
assert.match(serviceWorker, /safeSameOriginPath/);
assert.match(notificationPage, /enableButton\?\.addEventListener\('click'/);
const permissionPrompt = notificationPage.indexOf('Notification.requestPermission()');
const enableHandler = notificationPage.indexOf("enableButton?.addEventListener('click'");
const serviceWorkerRegistration = notificationPage.indexOf("navigator.serviceWorker.register('/sw.js'");
const ensureRegistrationCall = notificationPage.indexOf('const registrationState = await ensureRegistration()', enableHandler);
assert.ok(enableHandler >= 0 && permissionPrompt > enableHandler);
assert.ok(serviceWorkerRegistration >= 0 && ensureRegistrationCall > permissionPrompt);
assert.match(notificationPage, /userVisibleOnly:\s*true/);
assert.match(notificationPage, /applicationServerKey:/);
assert.match(notificationPage, /registration\.unregister\(\)/);

console.log('PWA contract verified: network-only worker, legacy cleanup, explicit registration and Web Push opt-in.');
