import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const read = (relativePath) => fs.readFile(path.join(webRoot, relativePath), 'utf8');

const [consent, layout, telemetry, ga4, privacy, notifications, pwaClient, astroConfig] = await Promise.all([
  read('src/components/ConsentClient.astro'),
  read('src/layouts/BaseLayout.astro'),
  read('src/components/TelemetryClient.astro'),
  read('src/components/GoogleAnalyticsClient.astro'),
  read('src/pages/privacy.md'),
  read('src/pages/account/notifications.astro'),
  read('src/components/PwaClient.astro'),
  read('astro.config.mjs'),
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
  'Google Analytics 4',
  'Advertising features and ad personalization are disabled',
]) {
  assert.ok(consent.includes(required));
}

assert.doesNotMatch(consent, /localStorage|sessionStorage|navigator\.userAgent|advertising identifier/i);
assert.match(consent, /let preference = readCookieValue\(\)/);
assert.match(consent, /const analyticsAllowed = \(\) => preference === 'granted'/);
assert.match(consent, /banner\.hidden = preference !== 'unset'/);
assert.match(consent, /id="privacy-consent-reject" class="privacy-consent-button privacy-consent-primary"/);
assert.match(consent, /id="privacy-consent-accept" class="privacy-consent-button privacy-consent-primary"/);

assert.match(layout, /import ConsentClient/);
assert.match(layout, /import GoogleAnalyticsClient/);
assert.match(layout, /id="privacy-settings-button"/);
const consentPosition = layout.indexOf('<ConsentClient />');
const ga4Position = layout.indexOf('<GoogleAnalyticsClient />');
const telemetryPosition = layout.indexOf('<TelemetryClient />');
assert.ok(consentPosition >= 0 && ga4Position > consentPosition && telemetryPosition > ga4Position);

const telemetryGuard = telemetry.indexOf('if (!analyticsAllowed()) return false;');
const telemetryRequest = telemetry.indexOf('fetch(TELEMETRY_ENDPOINT');
assert.ok(telemetryGuard >= 0 && telemetryRequest > telemetryGuard);

for (const requiredGa4 of [
  'PUBLIC_GA4_MEASUREMENT_ID',
  '/^G-[A-Z0-9]{4,32}$/',
  "if (!analyticsAllowed()) return;",
  'https://www.googletagmanager.com/gtag/js',
  "analytics_storage: 'granted'",
  "ad_storage: 'denied'",
  "ad_user_data: 'denied'",
  "ad_personalization: 'denied'",
  'allow_google_signals: false',
  'allow_ad_personalization_signals: false',
  'cookie_expires: COOKIE_MAX_AGE_SECONDS',
  'window[DISABLE_KEY] = true',
  "name === '_ga' || name.startsWith('_ga_')",
  'Max-Age=0',
]) {
  assert.ok(ga4.includes(requiredGa4));
}

const gaGuard = ga4.indexOf('if (!analyticsAllowed()) return;');
const gaScriptCreation = ga4.indexOf("document.createElement('script')");
assert.ok(gaGuard >= 0 && gaScriptCreation > gaGuard);
assert.doesNotMatch(ga4, /localStorage|sessionStorage|email|accountId|user_id|ads_data_redaction/i);

for (const requiredCsp of [
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://region1.google-analytics.com',
]) {
  assert.ok(astroConfig.includes(requiredCsp));
}

const privacyLower = privacy.toLowerCase();
for (const requiredDisclosure of [
  '`usd_impact_consent`',
  '`usd_impact_access`',
  '`usd_impact_refresh`',
  '`usd_impact_pkce`',
  '`_ga` and `_ga_*`',
  'up to 180 days',
  'up to one hour',
  'up to 30 days',
  'up to 10 minutes',
  'up to one year',
  'Cloudflare Turnstile',
  'optional analytics remains off',
  'Google Analytics 4',
  'Google Signals',
  'advertising personalization disabled',
  'Privacy settings',
  'does not use browser `localStorage` or `sessionStorage`',
]) {
  assert.ok(privacyLower.includes(requiredDisclosure.toLowerCase()));
}

assert.match(layout, /<PwaClient\s*\/>/);
assert.doesNotMatch(pwaClient, /navigator\.serviceWorker\.register/);
assert.match(pwaClient, /if \(!subscription\) await registration\.unregister\(\)/);
const enableHandler = notifications.indexOf("enableButton?.addEventListener('click'");
const permissionPrompt = notifications.indexOf('Notification.requestPermission()', enableHandler);
const registrationCall = notifications.indexOf('const registrationState = await ensureRegistration()', enableHandler);
assert.ok(enableHandler >= 0 && permissionPrompt > enableHandler && registrationCall > permissionPrompt);
assert.match(notifications, /registration\.unregister\(\)/);

console.log('Consent contract passed: default-denied analytics, consent-gated GA4, reversible choice, and essential-only default browser state.');
