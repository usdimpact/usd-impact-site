import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const read = (relativePath) => fs.readFile(path.join(webRoot, relativePath), 'utf8');

const [consent, layout, telemetry, privacy, notifications, pwaClient] = await Promise.all([
  read('src/components/ConsentClient.astro'),
  read('src/layouts/BaseLayout.astro'),
  read('src/components/TelemetryClient.astro'),
  read('src/pages/privacy.md'),
  read('src/pages/account/notifications.astro'),
  read('src/components/PwaClient.astro'),
]);

for (const required of [
  "const CONSENT_COOKIE_NAME = 'usd_impact_consent'",
  "const CONSENT_VERSION = 'v1'",
  '60 * 60 * 24 * 180',
  '.analytics-granted',
  '.analytics-denied',
  'SameSite=Lax',
  "window.location.protocol === 'https:'",
  'usd-impact:consent-change',
  'usd-impact:consent-ready',
  'USDImpactConsent',
  'analyticsAllowed',
  'Reject analytics',
  'Review settings',
  'Accept analytics',
  'Save choices',
]) {
  assert.match(consent, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.doesNotMatch(consent, /localStorage|sessionStorage|navigator\.userAgent|advertising identifier/i);
assert.match(consent, /let preference = readCookieValue\(\)/);
assert.match(consent, /const analyticsAllowed = \(\) => preference === 'granted'/);
assert.match(consent, /banner\.hidden = preference !== 'unset'/);
assert.match(consent, /id="privacy-consent-reject" class="privacy-consent-button privacy-consent-primary"/);
assert.match(consent, /id="privacy-consent-accept" class="privacy-consent-button privacy-consent-primary"/);

assert.match(layout, /import ConsentClient/);
assert.match(layout, /id="privacy-settings-button"/);
const consentPosition = layout.indexOf('<ConsentClient />');
const telemetryPosition = layout.indexOf('<TelemetryClient />');
assert.ok(consentPosition >= 0 && telemetryPosition > consentPosition);

const telemetryGuard = telemetry.indexOf('if (!analyticsAllowed()) return false;');
const telemetryRequest = telemetry.indexOf('fetch(TELEMETRY_ENDPOINT');
assert.ok(telemetryGuard >= 0 && telemetryRequest > telemetryGuard);

for (const requiredDisclosure of [
  '`usd_impact_consent`',
  '`usd_impact_access`',
  '`usd_impact_refresh`',
  '`usd_impact_pkce`',
  'up to 180 days',
  'up to one hour',
  'up to 30 days',
  'up to 10 minutes',
  'Cloudflare Turnstile',
  'aggregate analytics remains off',
  'Privacy settings',
  'does not use browser `localStorage` or `sessionStorage`',
]) {
  assert.match(privacy, new RegExp(requiredDisclosure.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}

assert.match(layout, /<PwaClient\s*\/>/);
assert.doesNotMatch(pwaClient, /navigator\.serviceWorker\.register/);
assert.match(pwaClient, /if \(!subscription\) await registration\.unregister\(\)/);
const enableHandler = notifications.indexOf("enableButton?.addEventListener('click'");
const permissionPrompt = notifications.indexOf('Notification.requestPermission()', enableHandler);
const registrationCall = notifications.indexOf('const registrationState = await ensureRegistration()', enableHandler);
assert.ok(enableHandler >= 0 && permissionPrompt > enableHandler && registrationCall > permissionPrompt);
assert.match(notifications, /registration\.unregister\(\)/);

console.log('Consent contract passed: default-denied analytics, reversible choice, essential-only browser state.');
