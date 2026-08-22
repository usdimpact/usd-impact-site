const VERSION = 'usd-impact-pwa-v1';
const NOTIFICATION_DEFAULTS = Object.freeze({
  title: 'USD Impact',
  body: 'A new USD Impact update is available.',
  url: '/',
});
const NOTIFICATION_ICON = '/assets/logo/USDImpact_Icon_Color_2048.png';

function boundedText(value, fallback, maximumLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maximumLength || /[\u0000-\u001F\u007F]/.test(text)) return fallback;
  return text;
}

function safeSameOriginPath(value) {
  try {
    const url = new URL(typeof value === 'string' ? value : '/', self.location.origin);
    if (url.origin !== self.location.origin) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

function parsePushPayload(data) {
  if (!data) return NOTIFICATION_DEFAULTS;
  try {
    const payload = data.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return NOTIFICATION_DEFAULTS;
    return payload;
  } catch {
    return NOTIFICATION_DEFAULTS;
  }
}

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

// Security-first service worker: every request stays network-only.
// Do not cache authenticated pages, API responses, entitlement-bearing URLs,
// Cloudflare Stream tokens, audiobook URLs, or time-sensitive market content.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event.data);
  const title = boundedText(payload.title, NOTIFICATION_DEFAULTS.title, 80);
  const body = boundedText(payload.body, NOTIFICATION_DEFAULTS.body, 240);
  const url = safeSameOriginPath(payload.url || NOTIFICATION_DEFAULTS.url);
  const tag = boundedText(payload.tag, '', 64);
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: NOTIFICATION_ICON,
    data: { url },
    ...(tag ? { tag } : {}),
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = safeSameOriginPath(event.notification?.data?.url);
  const target = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const current = windows.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });
    if (current) {
      if (typeof current.navigate === 'function') await current.navigate(target);
      return current.focus();
    }
    return self.clients.openWindow(target);
  })());
});
