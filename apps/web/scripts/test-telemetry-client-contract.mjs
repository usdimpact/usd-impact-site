import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const client = await fs.readFile(path.join(webRoot, 'src/components/TelemetryClient.astro'), 'utf8');
const ga4 = await fs.readFile(path.join(webRoot, 'src/components/GoogleAnalyticsClient.astro'), 'utf8');
const layout = await fs.readFile(path.join(webRoot, 'src/layouts/BaseLayout.astro'), 'utf8');
const checkout = await fs.readFile(path.join(webRoot, 'src/pages/checkout/index.astro'), 'utf8');
const privacy = await fs.readFile(path.join(webRoot, 'src/pages/privacy.md'), 'utf8');
const eventModel = await fs.readFile(path.join(webRoot, '../../docs/analytics/ga4-event-model.md'), 'utf8');

for (const required of [
  "'checklist_download'",
  "'checkout_view'",
  "'checkout_button_click'",
  "'checkout_sign_in_redirect'",
  "'quiz_start'",
  "'quiz_complete'",
  "'quiz_retry'",
  "fetch(TELEMETRY_ENDPOINT",
  'keepalive: true',
  '.catch(() =>',
  'MutationObserver',
  'data-quiz-result-summary',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'usd-impact:checkout-sign-in-redirect',
  'usd-impact:analytics-event',
  'usd-impact:consent-change',
  'usd-impact:consent-ready',
  'USDImpactConsent',
  'analyticsAllowed',
  'if (!analyticsAllowed()) return false;',
  'readCampaign()',
  'new CustomEvent(ANALYTICS_EVENT',
  'detail: { eventName, details }',
]) {
  assert.ok(client.includes(required));
}

for (const forbidden of [
  'document.cookie',
  'navigator.userAgent',
  'localStorage',
  'sessionStorage',
  'referrer',
  'email',
  'selectedAnswer',
  'correctAnswer',
]) {
  assert.doesNotMatch(client, new RegExp(forbidden, 'i'));
}

for (const eventName of [
  'checklist_download',
  'checkout_view',
  'checkout_button_click',
  'checkout_sign_in_redirect',
  'quiz_start',
  'quiz_retry',
  'quiz_complete',
]) {
  assert.ok(ga4.includes(`'${eventName}'`));
  assert.ok(eventModel.includes(`\`${eventName}\``));
}

for (const required of [
  'ALLOWED_EVENTS',
  'QUIZ_ID_PATTERN',
  "if (!analyticsAllowed() || !(event instanceof CustomEvent)) return;",
  "ensureGtag()('event', eventName, params)",
  'params.quiz_id = quizId',
  'params.outcome = details.outcome',
  'params.score = score',
  'params.question_count = questionCount',
]) {
  assert.ok(ga4.includes(required));
}

for (const forbidden of [
  'email',
  'accountId',
  'user_id',
  'transaction_id',
]) {
  assert.doesNotMatch(ga4, new RegExp(forbidden, 'i'));
}

assert.match(layout, /import TelemetryClient/);
assert.match(layout, /<TelemetryClient\s*\/>/);
const consentGuard = client.indexOf('if (!analyticsAllowed()) return false;');
const campaignRead = client.indexOf('...readCampaign()');
const telemetryRequest = client.indexOf('fetch(TELEMETRY_ENDPOINT');
const analyticsDispatch = client.indexOf('new CustomEvent(ANALYTICS_EVENT');
assert.ok(consentGuard >= 0 && campaignRead > consentGuard && telemetryRequest > campaignRead && analyticsDispatch > telemetryRequest);

assert.match(checkout, /window\.dispatchEvent\(new Event\('usd-impact:checkout-sign-in-redirect'\)\)/);
assert.match(privacy, /checkout-page view, checkout-button click, or redirect to secure sign-in/i);
assert.match(privacy, /not unique visitors and not evidence of a buyer or completed purchase/i);
assert.match(privacy, /does not include[\s\S]*email addresses[\s\S]*account identifiers[\s\S]*payment details/i);
assert.match(privacy, /optional analytics remains off unless you select \*\*Accept analytics\*\*/i);
assert.match(eventModel, /Purchase completion is intentionally excluded/i);
assert.match(eventModel, /verified provider\/webhook-backed transaction/i);

console.log('Telemetry client contract passed: consented first-party events bridge to a bounded GA4 allowlist without browser-derived purchase conversion.');
