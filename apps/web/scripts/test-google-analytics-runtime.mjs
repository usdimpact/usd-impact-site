import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const component = readFileSync(new URL('../src/components/GoogleAnalyticsClient.astro', import.meta.url), 'utf8');
const implicitInlineScript = /<script\b[^>]*(?:define:vars|is:inline)/i;
assert.doesNotMatch(component, implicitInlineScript);
for (const fixture of ['<script define:vars={id}>', '<SCRIPT DEFINE:VARS={id}>', '<ScRiPt Is:InLiNe>']) {
  assert.match(fixture, implicitInlineScript, 'Inline-source checks must not depend on HTML case');
}
assert.match(component, /<span id="usd-impact-ga4-config" hidden data-measurement-id=\{measurementId\}>/);
const match = component.match(/<script>([\s\S]*?)<\/script>/i);
assert.ok(match, 'GA4 must use an Astro-processed script');
const script = new vm.Script(match[1], { filename: 'google-analytics-client-fixture.js' });
const ID = 'G-CSPTEST01';
const CONFIG_ID = 'usd-impact-ga4-config';
const SCRIPT_ID = 'usd-impact-ga4-script';
const EVENT = 'usd-impact:analytics-event';
const json = (value) => JSON.parse(JSON.stringify(value));
let cases = 0;
function harness({ id = ID, consent, present = true, existingGtag = false } = {}) {
  let granted = consent;
  const elements = new Map();
  if (present) elements.set(CONFIG_ID, { getAttribute: (name) => name === 'data-measurement-id' ? id : null });
  const listeners = new Map();
  const appended = [];
  const cookies = [];
  const calls = [];
  const window = {
    location: { hostname: 'preview.example.test' },
    addEventListener(name, handler) {
      listeners.set(name, [...(listeners.get(name) ?? []), handler]);
    },
  };
  if (existingGtag) window.gtag = (...args) => calls.push(args);
  if (consent !== undefined) window.USDImpactConsent = { analyticsAllowed: () => granted };
  const document = {
    getElementById: (name) => elements.get(name) ?? null,
    createElement(name) { assert.equal(name, 'script'); return {}; },
    head: { appendChild(element) { appended.push(element); elements.set(element.id, element); } },
  };
  Object.defineProperty(document, 'cookie', {
    get: () => '_ga=synthetic; _ga_CSPTEST01=synthetic; essential=keep',
    set: (value) => cookies.push(value),
  });
  class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }
  const networkDenied = () => { throw new Error('Network must never be invoked by the runtime fixture'); };
  script.runInNewContext({ window, document, CustomEvent, fetch: networkDenied,
    XMLHttpRequest: networkDenied, WebSocket: networkDenied }, { timeout: 1000 });
  const emit = (name, detail, custom = true) => {
    const event = custom ? new CustomEvent(name, { detail }) : { type: name, detail };
    for (const handler of listeners.get(name) ?? []) handler(event);
  };
  const allCalls = () => json(existingGtag ? calls : (window.dataLayer ?? []).map((args) => Array.from(args)));
  return {
    window, appended, cookies, listeners,
    calls: allCalls,
    events: () => allCalls().filter((args) => args[0] === 'event'),
    emit,
    setConsent(value, name = 'usd-impact:consent-change') {
      granted = value;
      window.USDImpactConsent = { analyticsAllowed: () => granted };
      emit(name, { analytics: value });
    },
  };
}
function test(name, fn) { fn(); cases += 1; }
for (const consent of [undefined, false, 'true', 1, null]) {
  test(`strict consent: ${String(consent)}`, () => {
    const h = harness({ consent });
    h.emit(EVENT, { eventName: 'checkout_view', details: {} });
    assert.equal(h.appended.length, 0);
    assert.deepEqual(h.calls(), []);
    assert.equal(h.window[`ga-disable-${ID}`], true);
    assert.equal(h.cookies.length, 8);
    assert(h.cookies.every((cookie) => /^_ga(?:_CSPTEST01)?=;/.test(cookie) && cookie.includes('Max-Age=0')));
  });
}
for (const id of ['', 'G-ABC', 'G-test123', 'G-TEST\n', 'G-TEST ', ' G-TEST', 'G-TEST<script>', `G-${'A'.repeat(33)}`]) {
  test('invalid config is completely inert', () => {
    const h = harness({ id, consent: true });
    assert.equal(h.appended.length + h.cookies.length + h.listeners.size, 0);
    assert.deepEqual(h.calls(), []);
  });
}
test('absent config is inert', () => {
  const h = harness({ present: false, consent: true });
  assert.equal(h.appended.length + h.cookies.length + h.listeners.size, 0);
});
for (const consent of [undefined, false, true]) {
  test('grant, repeat, revoke and regrant', () => {
    const h = harness({ consent });
    h.setConsent(true, 'usd-impact:consent-ready');
    h.setConsent(true);
    assert.equal(h.appended.length, 1);
    assert.equal(h.appended[0].id, SCRIPT_ID);
    assert.equal(h.appended[0].src, `https://www.googletagmanager.com/gtag/js?id=${ID}`);
    assert.equal(h.appended[0].async, true);
    assert.equal(h.calls().filter((args) => args[0] === 'config').length, 1);
    assert.equal(h.window[`ga-disable-${ID}`], false);
    const config = h.calls().find((args) => args[0] === 'config');
    assert.deepEqual(config, ['config', ID, {
      allow_google_signals: false, allow_ad_personalization_signals: false,
      anonymize_ip: true, cookie_expires: 31536000, send_page_view: true,
    }]);
    for (const args of h.calls().filter((args) => args[0] === 'consent')) {
      assert.deepEqual(args[2], { analytics_storage: 'granted', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied' });
    }
    h.setConsent(false);
    assert.equal(h.window[`ga-disable-${ID}`], true);
    const before = h.calls().length;
    h.emit(EVENT, { eventName: 'checkout_view', details: {} });
    assert.equal(h.calls().length, before);
    h.setConsent(true);
    assert.equal(h.window[`ga-disable-${ID}`], false);
    assert.equal(h.appended.length, 1);
    assert.equal(h.calls().filter((args) => args[0] === 'config').length, 1);
  });
}
const allowedEvents = ['checklist_download', 'checkout_view', 'checkout_button_click',
  'checkout_sign_in_redirect', 'quiz_start', 'quiz_retry', 'quiz_complete',
  'waitlist_submission_success', 'daily_learning_subscribe_success', 'library_section_view'];
for (const eventName of allowedEvents) {
  test(eventName, () => {
    const h = harness({ consent: true });
    h.emit(EVENT, { eventName, details: {
      quizId: 'synthetic-quiz', format: 'video', outcome: 'pass', score: 3, questionCount: 4,
      email: 'not-forwarded@example.test', user_id: 'not-forwarded', arbitrary: 'not-forwarded',
    } });
    const event = h.events().at(-1);
    assert.equal(event[1], eventName);
    assert(!JSON.stringify(event).includes('not-forwarded'));
    const expected = eventName === 'quiz_complete'
      ? { quiz_id: 'synthetic-quiz', outcome: 'pass', score: 3, question_count: 4 }
      : eventName.startsWith('quiz_') ? { quiz_id: 'synthetic-quiz' }
        : eventName === 'library_section_view' ? { format: 'video' } : {};
    assert.deepEqual(event[2], expected);
  });
}
test('unknown and non-custom events rejected', () => {
  const h = harness({ consent: true });
  for (const eventName of ['purchase', 'login', '__proto__', '', 42]) h.emit(EVENT, { eventName, details: {} });
  h.emit(EVENT, { eventName: 'checkout_view', details: {} }, false);
  assert.deepEqual(h.events(), []);
});
for (const details of [{}, { quizId: '<bad>' }, { quizId: 'valid', outcome: 'pass', score: 5, questionCount: 4 },
  { quizId: 'valid', outcome: 'other', score: 1, questionCount: 4 },
  { quizId: 'valid', outcome: 'pass', score: 1.5, questionCount: 4 },
  { quizId: 'valid', outcome: 'pass', score: 0, questionCount: 1001 }]) {
  test('invalid quiz data rejected', () => {
    const h = harness({ consent: true });
    h.emit(EVENT, { eventName: 'quiz_complete', details });
    assert.deepEqual(h.events(), []);
  });
}
test('invalid library format rejected', () => {
  const h = harness({ consent: true });
  h.emit(EVENT, { eventName: 'library_section_view', details: { format: 'unknown' } });
  assert.deepEqual(h.events(), []);
});
test('existing gtag preserved', () => {
  const h = harness({ consent: true, existingGtag: true });
  h.emit(EVENT, { eventName: 'checkout_view', details: {} });
  assert.equal(h.events().length, 1);
  assert.deepEqual(json(h.window.dataLayer), []);
});
console.log(`GA4 runtime: ${cases} synthetic cases passed; no network or real consent state used.`);
