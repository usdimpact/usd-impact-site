import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const read = (relativePath) => fs.readFile(path.join(webRoot, relativePath), 'utf8');

const [
  consent,
  consentCopy,
  layout,
  telemetry,
  ga4,
  privacy,
  spanishPrivacy,
  spanishPublicPrivacy,
  spanishReviewLayout,
  spanishLegalLayout,
  notifications,
  pwaClient,
  astroConfig,
] = await Promise.all([
  read('src/components/ConsentClient.astro'),
  read('src/lib/consent-copy.js'),
  read('src/layouts/BaseLayout.astro'),
  read('src/components/TelemetryClient.astro'),
  read('src/components/GoogleAnalyticsClient.astro'),
  read('src/pages/privacy.md'),
  read('src/pages/internal/localization/spanish-privacy-review.md'),
  read('src/pages/es/privacy.md'),
  read('src/layouts/SpanishPrivacyReviewLayout.astro'),
  read('src/layouts/SpanishLegalLayout.astro'),
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
]) {
  assert.ok(consent.includes(required));
}

for (const requiredEnglishCopy of [
  "bannerTitle: 'Privacy choices'",
  "reject: 'Reject analytics'",
  "review: 'Review settings'",
  "accept: 'Accept analytics'",
  "save: 'Save choices'",
  'Google Analytics 4',
  'Advertising features and ad personalization are disabled',
]) {
  assert.ok(consentCopy.includes(requiredEnglishCopy));
}

for (const requiredSpanishCopy of [
  "bannerTitle: 'Opciones de privacidad'",
  "privacyLinkLabel: 'Leer el aviso de privacidad'",
  "reject: 'Rechazar analítica'",
  "review: 'Revisar opciones'",
  "accept: 'Aceptar analítica'",
  "settingsTitle: 'Opciones de privacidad'",
  "alwaysActive: 'Siempre activas'",
  "analyticsTitle: 'Analítica opcional'",
  "save: 'Guardar opciones'",
]) {
  assert.ok(consentCopy.includes(requiredSpanishCopy));
}

assert.match(consent, /consentCopyForLocale/);
assert.match(consent, /privacyHref = locale === 'es' \? '\/es\/privacy\/' : '\/privacy\/'/);
assert.doesNotMatch(consent, /localStorage|sessionStorage|navigator\.userAgent|advertising identifier/i);
assert.match(consent, /let preference = readCookieValue\(\)/);
assert.match(consent, /const analyticsAllowed = \(\) => analyticsAvailable && preference === 'granted'/);
assert.match(consent, /const analyticsAvailable = banner\?\.dataset\.analyticsEnabled === 'true'/);
assert.match(consent, /const enabledAndGranted = analyticsAvailable && nextPreference === 'granted'/);
assert.match(consent, /data-analytics-enabled=\{analyticsAvailable \? 'true' : 'false'\}/);
assert.match(consent, /\{analyticsAvailable && \(\s*<button id="privacy-consent-accept"/);
assert.match(consent, /\{analyticsAvailable \? \(\s*<label class="privacy-consent-category" for="privacy-consent-analytics"/);
assert.match(consent, /<section class="privacy-consent-category" aria-labelledby="privacy-consent-analytics-unavailable-title"/);
assert.match(consent, /reject: 'Continuar sin analítica'/);
assert.match(consent, /unavailable: 'Desactivadas'/);
assert.match(consent, /save: 'Guardar sin analítica'/);
assert.match(consent, /analyticsAvailable \? baseCopy/);
assert.match(consent, /banner\.hidden = preference !== 'unset'/);
assert.match(consent, /id="privacy-consent-reject" class="privacy-consent-button privacy-consent-primary"/);
assert.match(consent, /id="privacy-consent-accept" class="privacy-consent-button privacy-consent-primary"/);

assert.match(layout, /import ConsentClient/);
assert.match(layout, /import GoogleAnalyticsClient/);
assert.match(layout, /id="privacy-settings-button"/);
assert.match(layout, /locale=\{locale\}/);
assert.match(layout, /analyticsEnabled=\{analyticsEnabled\}/);
assert.match(layout, /privacyHref=\{locale === 'es' \? '\/es\/privacy\/' : '\/privacy\/'\}/);
const consentPosition = layout.indexOf('<ConsentClient');
const ga4Position = layout.indexOf('<GoogleAnalyticsClient />');
const telemetryPosition = layout.indexOf('<TelemetryClient />');
assert.ok(consentPosition >= 0 && ga4Position > consentPosition && telemetryPosition > ga4Position);

// The first-visit notice stays a fixed overlay (no layout shift), but while it is shown the page reserves
// the space it covers so keyboard focus and the end of the page scroll clear of it.
const bannerRule = consent.match(/\.privacy-consent-banner \{([^}]*)\}/)?.[1] || '';
assert.match(bannerRule, /position:\s*fixed;/, 'consent notice must remain a fixed overlay');
assert.match(consent, /:global\(html\.privacy-consent-open\) \{ scroll-padding-bottom: var\(--privacy-consent-space, 0px\); \}/);
assert.match(consent, /:global\(html\.privacy-consent-open body\) \{ padding-bottom: var\(--privacy-consent-space, 0px\); \}/);
const sync = consent.slice(consent.indexOf('const syncBannerSpace = () => {'), consent.indexOf('const render = () => {'));
assert.match(sync, /if \(!banner \|\| banner\.hidden\) \{\s*root\.classList\.remove\('privacy-consent-open'\);\s*root\.style\.removeProperty\('--privacy-consent-space'\);/);
assert.match(sync, /root\.style\.setProperty\('--privacy-consent-space', `\$\{space\}px`\);/);
assert.match(sync, /new ResizeObserver\(syncBannerSpace\)\.observe\(banner\)/);
assert.match(sync, /window\.addEventListener\('resize', syncBannerSpace\);/);
assert.match(consent, /analyticsToggle\.checked = analyticsAllowed\(\);\n    syncBannerSpace\(\);\n  \};/, 'render must resync the reserved space');
assert.doesNotMatch(consent, /focusin|scrollIntoView|scrollBy\(|scrollTo\(|preventDefault\(\)/, 'no focus or scroll hijacking');

// Short viewports (landscape phones, 400% zoom): the notice stays compact, its three choices stay visible, only the text scrolls.
const shortRule = consent.match(/@media \(max-height: 560px\) \{([\s\S]*?)\n  \}/)?.[1] || '';
assert.match(shortRule, /\.privacy-consent-banner \{ max-height: 55vh; display: flex; flex-direction: column;/);
assert.match(shortRule, /\.privacy-consent-banner > div:first-child \{ min-height: 0; overflow-y: auto;/);
assert.match(shortRule, /\.privacy-consent-actions \{ flex: none; display: flex; flex-wrap: nowrap;/);
assert.doesNotMatch(shortRule, /position:\s*sticky/, 'actions must not overlay the notice text');
assert.ok(consent.lastIndexOf('@media (max-height: 560px)') > consent.lastIndexOf('@media (max-width: 520px)'), 'short-viewport rule must follow the narrow-width rule');

// About 400% zoom on laptop screens: heading plus at least one complete line stays readable, the privacy link
// stays on one line, choices stay in one row, and the notice leaves room above it for tall focused page elements.
const tinyRule = consent.match(/@media \(max-height: 300px\) \{([\s\S]*?)\n  \}/)?.[1] || '';
assert.match(tinyRule, /\.privacy-consent-banner \{ max-height: none; bottom: 4px;/);
assert.match(tinyRule, /\.privacy-consent-banner > div:first-child \{ max-height: max\(33px, calc\(100vh - 142px\)\); scroll-padding-top: 16px; \}/);
assert.match(tinyRule, /\.privacy-consent-banner > div:first-child strong \{ position: sticky; top: 0;/);
assert.match(tinyRule, /\.privacy-consent-banner p a \{ white-space: nowrap; \}/);
assert.match(tinyRule, /\.privacy-consent-actions \{ flex-wrap: nowrap;/);
assert.match(tinyRule, /\.privacy-consent-button \{ flex: 1 1 0; width: auto; min-height: 24px;/);
assert.doesNotMatch(tinyRule, /display:\s*none|visibility:\s*hidden/, 'notice text and choices must never be hidden');
assert.match(consent, /@media \(max-height: 560px\) \{\s*\.privacy-consent-banner > div:first-child a:focus-visible \{ outline: 2px solid #f3cc68; outline-offset: -2px; \}/, 'link focus indicator must stay inside the scrolling notice');
assert.ok(consent.lastIndexOf('@media (max-height: 300px)') > consent.lastIndexOf('@media (max-height: 560px)'), 'tiny-viewport rule must follow the short-viewport rule');

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

assert.match(privacy, /alternateLocaleHref: "\/es\/privacy\/"/);
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

for (const requiredSpanishDisclosure of [
  '`usd_impact_consent`',
  '`usd_impact_access`',
  '`usd_impact_refresh`',
  '`usd_impact_pkce`',
  '`_ga` y `_ga_*`',
  'máximo de 180 días',
  'hasta una hora',
  'hasta 30 días',
  'hasta 10 minutos',
  'hasta un año',
  'Cloudflare Turnstile',
  'analítica opcional permanece desactivada',
  'Google Analytics 4',
  'Google Signals',
  'personalización publicitaria',
  'Opciones de privacidad',
  '`localStorage` ni `sessionStorage`',
  'support@usd-impact.com',
  'KELA LEADS S.R.L.',
]) {
  assert.ok(spanishPublicPrivacy.toLowerCase().includes(requiredSpanishDisclosure.toLowerCase()));
}

assert.match(spanishPublicPrivacy, /# Aviso de privacidad/);
assert.match(spanishPublicPrivacy, /Versión en español aprobada por el propietario: 9 de octubre de 2026/);
assert.doesNotMatch(spanishPublicPrivacy, /REVISIÓN INTERNA|archivo de revisión|No es todavía el aviso público|NO PUBLICAR/i);
assert.match(spanishPrivacy, /aprobación de privacidad del propietario PASS/);
assert.match(spanishPrivacy, /No se realizó revisión jurídica externa/);
assert.match(spanishReviewLayout, /locale="es"/);
assert.match(spanishReviewLayout, /noindex/);
assert.doesNotMatch(spanishReviewLayout, /<ConsentClient|import ConsentClient/);
assert.match(spanishReviewLayout, /<BaseLayout/);
assert.match(layout, /<ConsentClient\s+locale=\{locale\}/);
assert.doesNotMatch(layout, /\{analyticsEnabled && \(\s*<ConsentClient/);
assert.match(layout, /\{analyticsEnabled && <GoogleAnalyticsClient \/>\}/);
assert.match(layout, /\{analyticsEnabled && <TelemetryClient \/>\}/);
assert.match(layout, /<button id="privacy-settings-button" class="footer-privacy-settings" type="button">Opciones de privacidad<\/button>/);
assert.equal((layout.match(/id="privacy-settings-button"/g) ?? []).length, 2, 'one settings button per mutually exclusive locale footer');
assert.match(spanishReviewLayout, /APROBADO POR EL PROPIETARIO/);
assert.match(spanishReviewLayout, /La analítica de <code>\/es<\/code> continúa deshabilitada/);
assert.match(spanishLegalLayout, /locale="es"/);
assert.match(spanishLegalLayout, /currentPath="\/es\/privacy\/"/);
assert.match(spanishLegalLayout, /alternateLocaleHref="\/privacy\/"/);
assert.match(layout, /<a href="\/es\/privacy\/">Privacidad<\/a>/);
assert.ok(astroConfig.includes("'/internal/localization/spanish-privacy-review'"));
assert.ok(!astroConfig.includes("'/es/privacy'"));

assert.match(layout, /<PwaClient\s*\/>/);
assert.doesNotMatch(pwaClient, /navigator\.serviceWorker\.register/);
assert.match(pwaClient, /if \(!subscription\) await registration\.unregister\(\)/);
const enableHandler = notifications.indexOf("enableButton?.addEventListener('click'");
const permissionPrompt = notifications.indexOf('Notification.requestPermission()', enableHandler);
const registrationCall = notifications.indexOf('const registrationState = await ensureRegistration()', enableHandler);
assert.ok(enableHandler >= 0 && permissionPrompt > enableHandler && registrationCall > permissionPrompt);
assert.match(notifications, /registration\.unregister\(\)/);

console.log('Consent contract passed: English behavior preserved; owner-approved Spanish privacy notice is public-ready while Spanish analytics remains disabled.');
