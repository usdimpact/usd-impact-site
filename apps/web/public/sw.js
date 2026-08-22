const VERSION = 'usd-impact-pwa-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('usd-impact-pwa-') && key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

// Security-first initial service worker: every request stays network-only.
// Do not cache authenticated pages, API responses, entitlement-bearing URLs,
// Cloudflare Stream tokens, audiobook URLs, or time-sensitive market content.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});
