import assert from 'node:assert/strict';
import vm from 'node:vm';
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
assert.doesNotMatch(pwaClient, /getSubscription\(\)\.catch\(\(\) => null\)/);
assert.match(pwaClient, /subscription check failed; preserving registration/);
assert.match(pwaClient, /'\/account\/notifications'/);

const pwaScript = pwaClient.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(pwaScript, 'PWA client inline script must be extractable for behavior tests.');

const runCleanup = async ({ registration }) => {
  let loadHandler;
  let unregisterCalls = 0;
  let warningCalls = 0;
  const trackedRegistration = registration
    ? {
        ...registration,
        unregister: async () => {
          unregisterCalls += 1;
          return true;
        },
      }
    : undefined;

  vm.runInNewContext(pwaScript, {
    navigator: {
      serviceWorker: {
        getRegistration: async () => trackedRegistration,
      },
    },
    window: {
      location: { pathname: '/' },
      addEventListener: (name, handler) => {
        if (name === 'load') loadHandler = handler;
      },
    },
    console: {
      warn: () => {
        warningCalls += 1;
      },
    },
  });

  assert.equal(typeof loadHandler, 'function');
  await loadHandler();
  return { unregisterCalls, warningCalls };
};

assert.deepEqual(await runCleanup({ registration: undefined }), {
  unregisterCalls: 0,
  warningCalls: 0,
});
assert.deepEqual(await runCleanup({
  registration: {
    pushManager: { getSubscription: async () => ({ endpoint: 'https://push.example/subscribed' }) },
  },
}), {
  unregisterCalls: 0,
  warningCalls: 0,
});
assert.deepEqual(await runCleanup({
  registration: {
    pushManager: { getSubscription: async () => null },
  },
}), {
  unregisterCalls: 1,
  warningCalls: 0,
});
assert.deepEqual(await runCleanup({
  registration: {
    pushManager: { getSubscription: async () => { throw new Error('transient lookup failure'); } },
  },
}), {
  unregisterCalls: 0,
  warningCalls: 1,
});

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

console.log('PWA contract verified: network-only worker, fail-safe legacy cleanup, explicit registration and Web Push opt-in.');
