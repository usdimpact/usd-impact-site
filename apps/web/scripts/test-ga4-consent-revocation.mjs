import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Deterministic, disconnected browser simulation: never inject a real Google tag.
const source = readFileSync(new URL('../src/components/GoogleAnalyticsClient.astro', import.meta.url), 'utf8');
const telemetry = readFileSync(new URL('../src/components/TelemetryClient.astro', import.meta.url), 'utf8');
const consent = readFileSync(new URL('../src/components/ConsentClient.astro', import.meta.url), 'utf8');
const scriptMatch = source.match(/<script define:vars=\{\{ measurementId \}\}>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, 'GA4 script must exist only in measurement-ID gated component');
assert.match(source, /if \(configured && typeof window\.gtag === 'function'\)/);
assert.match(source, /window\[DISABLE_KEY\] = true;/);
assert.match(source, /clearGaCookies\(\);/);
assert.match(telemetry, /if \(!analyticsAllowed\(\)\) return false;/);
assert.match(consent, /const enabledAndGranted = analyticsAvailable && nextPreference === 'granted'/);

const measurementId = 'G-TEST1234';
const scriptElements = [];
const cookieWrites = [];
const cookies = new Map([
  ['usd_impact_consent', 'v1.analytics-denied'],
  ['_ga', 'obsolete'],
  ['_ga_TEST1234', 'obsolete'],
]);
const document = {
  get cookie() {
    return [...cookies.entries()].map(([name, value]) => name + '=' + value).join('; ');
  },
  set cookie(value) {
    cookieWrites.push(value);
    const name = value.split('=')[0];
    if (/;\s*Max-Age=0(?:;|$)/.test(value)) cookies.delete(name);
    else cookies.set(name, value.slice(name.length + 1).split(';')[0]);
  },
  createElement: (tag) => {
    assert.equal(tag, 'script', 'only a Google script element may be constructed');
    return { id: '', src: '', async: false };
  },
  getElementById: (id) => scriptElements.find((script) => script.id === id) ?? null,
  head: {
    appendChild: (script) => {
      scriptElements.push(script);
      return script;
    },
  },
};
let analyticsGranted = false;
const listeners = new Map();
class FakeCustomEvent {
  constructor(type, { detail } = {}) {
    this.type = type;
    this.detail = detail;
  }
}
const window = {
  location: { hostname: 'www.usd-impact.com', protocol: 'https:' },
  USDImpactConsent: { analyticsAllowed: () => analyticsGranted },
  addEventListener(name, callback) {
    const callbacks = listeners.get(name) ?? [];
    callbacks.push(callback);
    listeners.set(name, callbacks);
  },
  dispatchEvent(event) {
    for (const callback of listeners.get(event.type) ?? []) callback(event);
    return true;
  },
};
const queued = () => (window.dataLayer ?? []).map((args) => Array.from(args));
const calls = (name, action) => queued().filter(([kind, state]) => kind === name && (action === undefined || state === action));
const assertAdsDenied = () => {
  for (const [, , settings] of calls('consent')) {
    assert.equal(settings.ad_storage, 'denied');
    assert.equal(settings.ad_user_data, 'denied');
    assert.equal(settings.ad_personalization, 'denied');
  }
};
const changePreference = (value) => {
  analyticsGranted = value;
  window.dispatchEvent(new FakeCustomEvent('usd-impact:consent-change'));
};

runInNewContext(scriptMatch[1], { measurementId, window, document, CustomEvent: FakeCustomEvent }, {
  filename: 'GoogleAnalyticsClient-inline.js',
  timeout: 1500,
});

// No opt-in: Google script and even a gtag/dataLayer shim must not be initialized.
assert.equal(scriptElements.length, 0, 'no Google tag before consent');
assert.equal(window.dataLayer, undefined, 'no Google queue before consent');
assert.equal(window.gtag, undefined, 'no Google API shim before consent');
assert.equal(window['ga-disable-' + measurementId], true);
assert.equal(cookies.has('_ga'), false, 'stale GA cookie cleaned without Google load');
assert.equal(cookies.has('_ga_TEST1234'), false);
assert.equal(cookies.has('usd_impact_consent'), true, 'essential consent cookie preserved');

changePreference(false);
assert.equal(scriptElements.length, 0, 'rejection cannot create Google scripts');
assert.equal(window.dataLayer, undefined);
assert.equal(cookieWrites.some((v) => v.includes('Max-Age=0')), true);

// Consent accepted: initialize exactly one Google script with ads disabled.
changePreference(true);
assert.equal(window['ga-disable-' + measurementId], false);
assert.equal(scriptElements.length, 1);
assert.equal(scriptElements[0].id, 'usd-impact-ga4-script');
assert.equal(scriptElements[0].src, 'https://www.googletagmanager.com/gtag/js?id=' + measurementId);
assert.equal(scriptElements[0].async, true);
assert.equal(calls('consent', 'default').length, 1);
assert.equal(calls('config').length, 1);
assert.equal(calls('consent', 'default')[0][2].analytics_storage, 'granted');
assertAdsDenied();

window.dispatchEvent(new FakeCustomEvent('usd-impact:analytics-event', {
  detail: { eventName: 'quiz_start', details: { quizId: 'lesson-123' } },
}));
assert.equal(calls('event').length, 1, 'allowlisted analytics event works only after opt-in');

cookies.set('_ga', 'fresh-analytics-cookie');
cookies.set('_ga_TEST1234', 'fresh-analytics-cookie');
changePreference(false);
assert.equal(window['ga-disable-' + measurementId], true);
assert.equal(scriptElements.length, 1, 'revocation must not load an additional tag');
assert.equal(cookies.has('_ga'), false, 'previous GA cookie expired on revoke');
assert.equal(cookies.has('_ga_TEST1234'), false);
assert.equal(cookies.has('usd_impact_consent'), true);
assert.equal(calls('consent', 'update').at(-1)[2].analytics_storage, 'denied', 'latest update revokes analytics');
assert.equal(calls('consent', 'update').filter(([, , settings]) => settings.analytics_storage === 'denied').length, 1, 'exactly one denied update after withdrawal');
assertAdsDenied();

const queuedOnRevoke = queued().length;
window.dispatchEvent(new FakeCustomEvent('usd-impact:analytics-event', {
  detail: { eventName: 'quiz_start', details: { quizId: 'lesson-123' } },
}));
assert.equal(queued().length, queuedOnRevoke, 'post-withdrawal analytics events remain blocked');

changePreference(true);
assert.equal(window['ga-disable-' + measurementId], false, 're-consent clears opt-out flag');
assert.equal(scriptElements.length, 1, 're-consent does not double-load tag');
assert.equal(calls('config').length, 1, 're-consent does not double-configure the tag');
assert.equal(calls('consent', 'update').at(-1)[2].analytics_storage, 'granted', 'regrant restores analytics only');
assert.equal(calls('consent', 'update').filter(([, , settings]) => settings.analytics_storage === 'denied').length, 1, 'only the withdrawal transition denied analytics');
assertAdsDenied();
console.log('GA4 simulated consent lifecycle passed: deny -> accept -> revoke -> regrant, zero Google load before consent.');


// Regression: Astro's define:vars GA4 script can run before ConsentClient's
// deferred module on EACH new document. A previously granted _ga identifier
// must not be expired during that gap; explicit reject still expires it.
const returningCookies = new Map([
  ['usd_impact_consent', 'v1.analytics-granted'],
  ['_ga', 'stable-client-id'],
  ['_ga_TEST1234', 'stable-stream-cookie'],
]);
const delayedPage = (granted) => {
  const writes = [];
  const scripts = [];
  const callbacks = new Map();
  let allowed = granted;
  const pageDoc = {
    get cookie() {
      return [...returningCookies.entries()].map(([key, value]) => key + '=' + value).join('; ');
    },
    set cookie(value) {
      writes.push(value);
      const name = value.split('=')[0];
      if (/;\s*Max-Age=0(?:;|$)/.test(value)) returningCookies.delete(name);
      else returningCookies.set(name, value.slice(name.length + 1).split(';')[0]);
    },
    getElementById(id) { return scripts.find((s) => s.id === id) ?? null; },
    createElement(tag) { assert.equal(tag, 'script'); return { id: '', src: '', async: false }; },
    head: { appendChild(script) { scripts.push(script); return script; } },
  };
  const pageWin = {
    location: { hostname: 'www.usd-impact.com', protocol: 'https:' },
    addEventListener(event, callback) {
      const list = callbacks.get(event) ?? [];
      list.push(callback);
      callbacks.set(event, list);
    },
    dispatchEvent(event) {
      for (const fn of callbacks.get(event.type) ?? []) fn(event);
    },
  };
  runInNewContext(scriptMatch[1], {
    measurementId, window: pageWin, document: pageDoc, CustomEvent: FakeCustomEvent,
  }, { filename: 'GA4-delayed-consent.js', timeout: 1500 });
  assert.equal(scripts.length, 0, 'deferred consent cannot load Google early');
  assert.equal(pageWin.gtag, undefined, 'no Google shim before consent-ready');
  assert.equal(pageWin.dataLayer, undefined, 'no Google queue before consent-ready');
  assert.equal(pageWin['ga-disable-' + measurementId], true, 'analytics disabled while consent API is pending');
  assert.deepEqual(writes, [], 'pending state must never touch existing cookies');
  assert.equal(returningCookies.get('_ga'), granted ? 'stable-client-id' : 'obsolete-id',
    'pending consent must not change the existing granted or obsolete client cookie');
  pageWin.USDImpactConsent = { analyticsAllowed: () => allowed };
  pageWin.dispatchEvent(new FakeCustomEvent('usd-impact:consent-ready'));
  if (allowed) {
    assert.equal(scripts.length, 1, 'consent-ready grants one Google tag');
    assert.equal(pageWin['ga-disable-' + measurementId], false);
    assert.equal(returningCookies.get('_ga'), 'stable-client-id', 'valid opt-in must preserve client identity');
    assert.equal(returningCookies.get('_ga_TEST1234'), 'stable-stream-cookie');
    assert.equal(writes.filter((v) => /Max-Age=0/.test(v)).length, 0,
      'no expired GA cookies on already-granted navigation');
  } else {
    assert.equal(scripts.length, 0, 'first-time reject cannot load Google');
    assert.equal(returningCookies.has('_ga'), false, 'reject deletes an obsolete GA cookie');
    assert.equal(returningCookies.has('_ga_TEST1234'), false);
  }
  return {
    win: pageWin, scripts, writes,
    withdraw() {
      allowed = false;
      pageWin.dispatchEvent(new FakeCustomEvent('usd-impact:consent-change'));
    },
  };
};
const homePage = delayedPage(true);
const privacyPage = delayedPage(true);
assert.equal(homePage.scripts.length, 1);
assert.equal(privacyPage.scripts.length, 1);
assert.equal(returningCookies.get('_ga'), 'stable-client-id',
  'returning consent survives simulated home-to-privacy full-document navigation');
privacyPage.withdraw();
assert.equal(returningCookies.has('_ga'), false, 'withdrawal deletes previously granted _ga');
assert.equal(returningCookies.has('_ga_TEST1234'), false);
assert.equal(Array.from(privacyPage.win.dataLayer ?? []).map((args) => Array.from(args))
  .filter(([a, b]) => a === 'consent' && b === 'update').at(-1)[2].analytics_storage, 'denied',
  'withdrawal still queues the explicit Google denied update');
assert.equal(returningCookies.has('usd_impact_consent'), true, 'privacy decision survives cleanup');
returningCookies.set('_ga', 'obsolete-id');
returningCookies.set('_ga_TEST1234', 'obsolete-stream-id');
delayedPage(false);
assert.equal(returningCookies.has('_ga'), false, 'denied consent-ready expires obsolete GA cookie');
console.log('GA4 delayed consent initialization passed: stable returning client ID across documents, revoked on withdrawal.');
