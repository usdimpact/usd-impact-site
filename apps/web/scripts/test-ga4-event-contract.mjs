import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const read = (relativePath) => fs.readFile(path.join(webRoot, relativePath), 'utf8');

const [telemetry, ga4, privacy, model] = await Promise.all([
  read('src/components/TelemetryClient.astro'),
  read('src/components/GoogleAnalyticsClient.astro'),
  read('src/pages/privacy.md'),
  read('../../docs/analytics/ga4-event-model.md'),
]);

for (const required of [
  "const ANALYTICS_EVENT = 'usd-impact:analytics-event'",
  'new CustomEvent(ANALYTICS_EVENT',
  'detail: { eventName, details }',
]) {
  assert.ok(telemetry.includes(required));
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
  assert.ok(model.includes(`\`${eventName}\``));
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
  'payment',
]) {
  assert.doesNotMatch(ga4, new RegExp(forbidden, 'i'));
}

assert.match(model, /Purchase completion is intentionally excluded/i);
assert.match(model, /verified provider\/webhook-backed transaction/i);
assert.match(privacy, /checkout-funnel counts are aggregate events, not unique visitors and not evidence of a buyer or completed purchase/i);
assert.match(privacy, /does not intentionally send email addresses, account IDs, payment details, quiz answers/i);

console.log('GA4 event contract passed: consent-gated allowlist, bounded quiz parameters, and no browser-derived purchase conversion.');
