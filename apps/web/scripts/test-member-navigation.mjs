import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { SITE_NAVIGATION, navigationLinkIsActive, renderMemberMainMenu, memberMainMenuAssets } from '../src/lib/site-navigation.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const memberPaths = ['/guided-edition/', '/guided-edition/book/', '/guided-edition/audiobook/', '/guided-edition/video-library/'];
const menu = renderMemberMainMenu();
assert.match(menu, /<summary>Main menu<\/summary>/);
assert.match(menu, /aria-label="Main navigation"/);
for (const path of ['/', '/news/', '/account/', '/book/read-the-dollar-first/', ...memberPaths]) {
  assert.ok(menu.includes(`href="${path}"`), `Main menu must expose ${path}`);
}
assert.doesNotMatch(menu, /account\/sign-in|access_token|refresh_token/);
for (const group of SITE_NAVIGATION) {
  assert.equal(Object.isFrozen(group.links), true);
  for (const link of group.links) {
    assert.match(link.href, /^\/[a-z0-9/-]*\/$/);
    assert.ok(menu.includes(`href="${link.href}">${link.label}</a>`));
  }
}
assert.equal(navigationLinkIsActive('/guided-edition/audiobook/', '/guided-edition/'), false);
assert.equal(navigationLinkIsActive('/guided-edition/audiobook/track/one/', '/guided-edition/audiobook/'), true);
assert.equal(navigationLinkIsActive('/newsroom/', '/news/'), false);
assert.equal(navigationLinkIsActive('/news', '/news/'), true);
assert.match(memberMainMenuAssets(), /href="\/assets\/member-main-menu.css"/);
assert.match(memberMainMenuAssets(), /src="\/assets\/member-main-menu.js" defer/);

for (const path of ['../api/guided-edition.js', '../src/lib/audiobook-handler.js', '../src/lib/book-delivery-handler.js', '../src/lib/video-library-page.js']) {
  const source = await read(path);
  assert.match(source, /import \{ memberMainMenuAssets, renderMemberMainMenu \} from /, path);
  assert.match(source, /\$\{memberMainMenuAssets\(\)\}[\s\S]*<\/head>/, path);
  assert.match(source, /<header[\s\S]*\$\{renderMemberMainMenu\(\)\}[\s\S]*<\/header>/, path);
}
const layout = await read('../src/layouts/BaseLayout.astro');
for (const group of ['learnNavigation', 'updatesNavigation', 'libraryNavigation']) assert.ok(layout.includes(`${group}.links.map`));
assert.match(layout, /SITE_NAVIGATION, navigationLinkIsActive/);
assert.match(layout, /src="\/assets\/session-entry.js" defer/);
const publicAudio = await read('../src/pages/audiobook/read-the-dollar-first.astro');
assert.match(publicAudio, /const memberAudiobookPath = '\/guided-edition\/audiobook\/'/);
assert.equal((publicAudio.match(/href=\{memberAudiobookPath\}/g) || []).length, 2);
assert.doesNotMatch(publicAudio, /\/account\/sign-in\//);

const script = await read('../public/assets/session-entry.js');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const signedIn = (allowed = true, status = 'active') => ({ account: { id: '00000000-0000-4000-8000-000000000001', status }, paidAccess: { allowed } });
let cases = 0;
async function browser({ next = '/guided-edition/audiobook/', responseStatus = 200, body = signedIn(), error = null, pending = false, signInPage = true } = {}) {
  const attributes = new Map();
  const target = {};
  const form = { inert: false, contains: (node) => node === target, setAttribute: (key, value) => attributes.set(key, value), removeAttribute: (key) => attributes.delete(key) };
  const status = { dataset: {}, textContent: '' };
  const listeners = new Map();
  const windowListeners = new Map();
  const redirects = [];
  const requests = [];
  const timers = new Map();
  const document = {
    getElementById: (id) => id === 'passwordless-sign-in' ? (signInPage ? form : null) : id === 'sign-in-status' ? status : null,
    addEventListener: (name, handler, capture) => { assert.equal(capture, true); listeners.set(name, handler); },
    get cookie() { throw new Error('Browser script must not read authentication cookies'); },
  };
  const window = {
    location: { origin: 'https://www.usd-impact.com', search: `?next=${encodeURIComponent(next)}`, replace: (url) => redirects.push(url) },
    setTimeout: (fn) => { const key = timers.size + 1; timers.set(key, fn); return key; },
    clearTimeout: (key) => timers.delete(key),
    addEventListener: (name, handler) => windowListeners.set(name, handler),
    get localStorage() { throw new Error('Browser storage cannot authorize access'); },
  };
  let complete;
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (pending) await new Promise((resolve, reject) => {
      complete = resolve;
      options.signal.addEventListener('abort', () => reject(new Error('AbortError')), { once: true });
    });
    if (error) throw error;
    return { status: responseStatus, ok: responseStatus >= 200 && responseStatus < 300, json: async () => body };
  };
  vm.runInNewContext(script, { document, window, fetch, URL, URLSearchParams, AbortController }, { filename: 'session-entry.js' });
  await tick();
  return { form, status, redirects, requests, timers, listeners, windowListeners, target, complete: () => complete?.() };
}

for (const path of [...memberPaths, '/news/', '/checkout/', '/guided-edition/video-library/?collection=funding#chapter']) {
  const result = await browser({ next: path });
  assert.deepEqual(result.redirects, [path]);
  assert.equal(result.requests.length, 1);
  assert.equal(result.requests[0].url, '/api/account-access');
  assert.equal(result.requests[0].options.credentials, 'same-origin');
  assert.equal(result.requests[0].options.cache, 'no-store');
  assert.equal(result.requests[0].options.method, undefined); // GET only; no sign-in email or grant.
  cases += 1;
}
const unpaid = await browser({ next: memberPaths[3], body: signedIn(false) });
assert.deepEqual(unpaid.redirects, [memberPaths[3]], 'The protected destination, not another login, decides unpaid access.'); cases += 1;
const inactive = await browser({ body: signedIn(false, 'suspended') });
assert.deepEqual(inactive.redirects, ['/account/']); cases += 1;
for (const options of [{ responseStatus: 401 }, { responseStatus: 503 }, { error: new Error('offline') }, { body: {} }, { body: { account: { id: 'id', status: 'active' }, paidAccess: { allowed: 'true' } } }]) {
  const result = await browser(options);
  assert.deepEqual(result.redirects, []);
  assert.equal(result.form.inert, false);
  assert.equal(result.requests.length, 1);
  assert.equal(result.timers.size, 0);
  cases += 1;
}
for (const next of ['', 'https://evil.invalid/', '//evil.invalid/', '/\\evil.invalid/', '/%5Cevil.invalid/', '/%2F%2Fevil.invalid/', '/%252F%252Fevil.invalid/', '/api/account?action=logout', '/auth/confirm/', '/account/sign-in/', '/account/sign-in?next=/news/', '/x/../account/sign-in/', '/account/%73ign-in/', '/account/%2573ign-in/', '/%61uth/session-ready/', '/news/%0Ainvalid', '/%E0%A4%A']) {
  const result = await browser({ next });
  assert.deepEqual(result.redirects, ['/account/'], `Unsafe/looping destination: ${next}`);
  cases += 1;
}
const blocked = await browser({ pending: true });
assert.equal(blocked.form.inert, true);
for (const type of ['click', 'submit']) {
  let prevented = false; let stopped = false;
  blocked.listeners.get(type)({ target: blocked.target, preventDefault: () => { prevented = true; }, stopImmediatePropagation: () => { stopped = true; } });
  assert.ok(prevented && stopped, 'Sign-in controls cannot act during the session check.');
}
blocked.complete(); await tick(); assert.equal(blocked.redirects.length, 1); cases += 1;
const timedOut = await browser({ pending: true });
[...timedOut.timers.values()][0](); await tick();
assert.equal(timedOut.form.inert, false); assert.equal(timedOut.redirects.length, 0); assert.equal(timedOut.status.dataset.state, 'error'); cases += 1;
const restored = await browser({ responseStatus: 401 });
restored.windowListeners.get('pageshow')({ persisted: true }); await tick();
assert.equal(restored.requests.length, 2); assert.equal(restored.form.inert, false); cases += 1;
const publicPage = await browser({ signInPage: false });
assert.equal(publicPage.requests.length, 0); cases += 1;

console.log(`Shared member navigation and session-entry contracts passed (${cases} browser-state cases).`);
